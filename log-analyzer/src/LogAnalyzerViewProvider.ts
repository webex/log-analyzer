import * as vscode from 'vscode';
import { McpService, SearchResponse } from './McpService';

interface McpStatus {
    connected: boolean;
    serverName: string;
    error?: string;
}

export class LogAnalyzerViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'logAnalyzerView';
    private _view?: vscode.WebviewView;
    private mcpService: McpService;
    private analysisCache: Map<string, string> = new Map();

    constructor(private readonly _extensionUri: vscode.Uri) {
        this.mcpService = McpService.getInstance();
        // Don't initialize here - do it after webview is ready
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'search':
                        await this.handleSearch(message.trackingId);
                        break;
                    case 'generateAnalysis':
                        await this.handleAnalysisGeneration(message.searchResults, message.trackingId);
                        break;
                }
            },
            undefined,
            []
        );

        // Listen for MCP status changes BEFORE initializing
        this.mcpService.onStatusChange((status) => {
            console.log(`MCP status changed: ${status}`);
            this.updateMcpStatus(status);
        });

        // Send initial MCP status (current status)
        this.updateMcpStatus(this.mcpService.getConnectionStatus());

        // Now initialize MCP service - this will trigger status updates
        this.mcpService.initialize().catch((error) => {
            console.error('MCP initialization failed:', error);
            this.updateMcpStatus(false);
        });
    }

    private async handleSearch(trackingId: string) {
        if (!trackingId.trim()) {
            vscode.window.showWarningMessage('Please enter a tracking ID');
            return;
        }

        try {
            // Send loading state to webview
            this._view?.webview.postMessage({
                type: 'searchStarted'
            });

            const results = await this.mcpService.searchLogs(trackingId);
            
            // Send results to webview
            this._view?.webview.postMessage({
                type: 'searchResults',
                results: results,
                trackingId: trackingId
            });

        } catch (error) {
            console.error('Search failed:', error);
            
            // Send error to webview
            this._view?.webview.postMessage({
                type: 'searchError',
                error: error instanceof Error ? error.message : 'Search failed'
            });

            vscode.window.showErrorMessage(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async handleMcpRetry() {
        try {
            await this.mcpService.initialize();
        } catch (error) {
            console.error('MCP retry failed:', error);
            vscode.window.showErrorMessage(`Failed to reconnect to MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private updateMcpStatus(connected: boolean) {
        this._view?.webview.postMessage({
            type: 'mcpStatus',
            status: {
                connected: connected,
                serverName: 'opensearch-mcp',
                error: connected ? undefined : 'MCP server not connected'
            }
        });
    }

    public dispose() {
        // Clean up resources if needed
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'style.css'));

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <link href="${styleUri}" rel="stylesheet">
                <title>Log Analyzer</title>
            </head>
            <body>
                <div class="app-container">
                    <div class="header-section">
                        <div class="header-top">
                            <div class="logo">
                                <svg class="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="6" cy="6" r="3" fill="var(--vscode-charts-blue)" opacity="0.2"/>
                                    <circle cx="18" cy="6" r="3" fill="var(--vscode-charts-blue)" opacity="0.2"/>
                                    <circle cx="12" cy="18" r="3" fill="var(--vscode-charts-blue)" opacity="0.2"/>
                                    <path d="M8.5 7.5L15.5 7.5" stroke="var(--vscode-charts-blue)" stroke-width="1.5"/>
                                    <path d="M8.5 8.5L10.5 16" stroke="var(--vscode-charts-blue)" stroke-width="1.5"/>
                                    <path d="M15.5 8.5L13.5 16" stroke="var(--vscode-charts-blue)" stroke-width="1.5"/>
                                    <circle cx="12" cy="12" r="3" stroke="var(--vscode-charts-green)" fill="none" stroke-width="2"/>
                                    <path d="14.5 14.5L16.5 16.5" stroke="var(--vscode-charts-green)" stroke-width="2"/>
                                </svg>
                                <h2>Log Analyzer</h2>
                            </div>
                            <div class="mcp-status-compact" id="mcpStatus">
                                <div class="status-dot" id="statusIndicator" title="MCP Connection Status"></div>
                            </div>
                        </div>
                    </div>

                    <div class="search-section">
                        <div class="input-group">
                            <label for="trackingId" class="label">Tracking ID</label>
                            <input 
                                type="text" 
                                id="trackingId" 
                                class="input" 
                                placeholder="Enter tracking ID (e.g., webex-js-sdk_...)"
                                autocomplete="off"
                            />
                        </div>
                        <button id="searchBtn" class="btn btn-primary">
                            <svg class="btn-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="21 21l-4.35-4.35"></path>
                            </svg>
                            Search Logs
                        </button>
                    </div>

                    <div class="recent-searches-section" id="recentSearchesSection">
                        <div class="recent-header">
                            <h3>Recent Searches</h3>
                            <button id="clearAllRecentsBtn" class="btn btn-link">Clear All</button>
                        </div>
                        <ul class="recent-list" id="recentList"></ul>
                    </div>

                    <button id="backToHomeBtn" class="btn btn-secondary" style="display:none;margin-bottom:12px;">
                        ← Back to Home
                    </button>

                    <div class="results-section" id="resultsSection">
                        <div class="results-header">
                            <h3>Search Results</h3>
                            <div class="results-count" id="resultsCount">0 results</div>
                        </div>
                        <div class="tab-container">
                            <div class="tabs">
                                <button class="tab-button active" data-tab="logs">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14,2 14,8 20,8"></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"></line>
                                        <line x1="16" y1="17" x2="8" y2="17"></line>
                                        <polyline points="10,9 9,9 8,9"></polyline>
                                    </svg>
                                    Logs
                                </button>
                                <button class="tab-button" data-tab="analysis">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                    </svg>
                                    Analysis
                                </button>
                            </div>
                            <div class="tab-content">
                                <div class="tab-panel active" id="logsPanel">
                                    <div class="results-container">
                                        <div class="results-content" id="resultsContent">
                                            <div class="empty-state">
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                                    <circle cx="11" cy="11" r="8"></circle>
                                                    <path d="21 21l-4.35-4.35"></path>
                                                </svg>
                                                <p>Enter a tracking ID to search for logs</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="tab-panel" id="analysisPanel">
                                    <div class="analysis-container">
                                        <div class="analysis-content" id="analysisContent">
                                            <div class="empty-state">
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                                                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                                                </svg>
                                                <p>AI analysis will appear here after searching logs</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private normalizeTrackingId(trackingId: string): string {
        return (trackingId || '').trim().toLowerCase();
    }

    private async handleAnalysisGeneration(searchResults: any, trackingId: string) {
        const cacheKey = this.normalizeTrackingId(trackingId);
        if (this.analysisCache.has(cacheKey)) {
            this._view?.webview.postMessage({
                type: 'analysisResult',
                analysis: this.analysisCache.get(cacheKey),
                trackingId: trackingId
            });
            return;
        }
        try {
            const analysisText = await this.generateLogAnalysis(searchResults, trackingId);
            this.analysisCache.set(cacheKey, analysisText);
            this._view?.webview.postMessage({
                type: 'analysisResult',
                analysis: analysisText,
                trackingId: trackingId
            });
        } catch (error) {
            console.error('Analysis generation failed:', error);
            this._view?.webview.postMessage({
                type: 'analysisError',
                error: error instanceof Error ? error.message : 'Failed to generate analysis'
            });
        }
    }

    private async generateLogAnalysis(searchResults: any, trackingId: string): Promise<string> {
        try {
            // Check if Language Model API is available
            const models = await vscode.lm.selectChatModels({ family: 'gpt-4o' });
            if (models.length === 0) {
                throw new Error('No language models available. Please ensure you have access to VS Code Copilot.');
            }

            const model = models[0];
            const hits = searchResults.hits?.hits || [];
            
            if (hits.length === 0) {
                return '# Analysis\n\nNo logs found for the specified tracking ID.';
            }

            // Prepare log data for analysis
            const logSummary = this.prepareLogsForAnalysis(hits, trackingId);
            
            // Create chat request
            const prompt = this.createAnalysisPrompt(logSummary, trackingId);
            
            const chatMessage = vscode.LanguageModelChatMessage.User(prompt);

            const response = await model.sendRequest(
                [chatMessage],
                {},
                new vscode.CancellationTokenSource().token
            );

            let analysisText = '';
            for await (const fragment of response.text) {
                analysisText += fragment;
            }

            return analysisText;
        } catch (error) {
            console.error('Language model request failed:', error);
            throw new Error(`Analysis generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private prepareLogsForAnalysis(hits: any[], trackingId: string): string {
        const logEntries = hits.slice(0, 50).map(hit => { // Limit to first 50 logs to avoid token limits
            const source = hit._source;
            const fields = source.fields || {};
            
            return {
                timestamp: source['@timestamp'],
                level: fields.level || source.log_level || 'INFO',
                service: source.hostname || fields.nodeId || 'Unknown',
                message: source.message || 'No message',
                datacenter: source.datacenter,
                environment: source.environment,
                thread: fields.thread_name,
                class: fields.caller_class_name,
                method: fields.caller_method_name
            };
        });

        return JSON.stringify({
            trackingId,
            totalLogs: hits.length,
            logEntries
        }, null, 2);
    }

    private createAnalysisPrompt(logData: string, trackingId: string): string {
        return `You are an expert system administrator and software engineer analyzing microservice logs. Please analyze the following log data for tracking ID "${trackingId}" and provide insights in markdown format.

Log Data:
\`\`\`json
${logData}
\`\`\`

Please provide a comprehensive analysis that includes:

1. **Executive Summary** - Brief overview of what happened
2. **Timeline** - Key events in chronological order
3. **Service Interaction** - Which services were involved and how they interacted
4. **Error Analysis** - Any errors, warnings, or issues found
5. **Performance Insights** - Any performance-related observations
6. **Recommendations** - Suggestions for investigation or improvements

Focus on:
- Identifying patterns and anomalies
- Correlating events across services
- Highlighting potential issues or root causes
- Providing actionable insights

Use clear markdown formatting with headers, bullet points, and code blocks where appropriate. Keep the analysis concise but thorough.`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
