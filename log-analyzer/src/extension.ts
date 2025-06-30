// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { LogAnalyzerViewProvider } from './LogAnalyzerViewProvider';
import { McpService } from './McpService';
import { McpServerProvider } from './McpServerProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "microservice-log-analyzer" is now active!');

	// Register MCP server definition provider first
	const mcpServerProvider = new McpServerProvider();
	context.subscriptions.push(
		vscode.lm.registerMcpServerDefinitionProvider('opensearch-mcp-server', mcpServerProvider)
	);

	// Initialize MCP service
	const mcpService = McpService.getInstance();

	// Register the webview view provider
	const provider = new LogAnalyzerViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			LogAnalyzerViewProvider.viewType, 
			provider,
			{
				webviewOptions: {
					retainContextWhenHidden: true
				}
			}
		)
	);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('microservice-log-analyzer.refresh', async () => {
			vscode.window.showInformationMessage('Refreshing Log Analyzer...');
			// Trigger a refresh of the MCP connection
			try {
				await mcpService.initialize();
				vscode.window.showInformationMessage('MCP connection refreshed successfully');
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to refresh MCP connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('microservice-log-analyzer.search', async () => {
			const trackingId = await vscode.window.showInputBox({
				prompt: 'Enter tracking ID to search for',
				placeHolder: 'e.g., webex-js-sdk_2b08d954-8cf8-460c-bf91-b9dddb1d8533_12'
			});
			
			if (trackingId) {
				vscode.window.showInformationMessage(`Searching for tracking ID: ${trackingId}`);
				// The actual search will be handled by the webview
			}
		})
	);

	// Ensure provider is disposed when extension deactivates
	context.subscriptions.push(provider);

	console.log('Microservice Log Analyzer extension activated with MCP integration');
}

// This method is called when your extension is deactivated
export function deactivate() {
// Clean up MCP service resources
const mcpService = McpService.getInstance();
mcpService.dispose();

console.log('Microservice Log Analyzer extension deactivated');
}
