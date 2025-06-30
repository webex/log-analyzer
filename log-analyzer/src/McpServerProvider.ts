import * as vscode from 'vscode';

export class McpServerProvider implements vscode.McpServerDefinitionProvider<vscode.McpStdioServerDefinition> {
    
    async provideMcpServerDefinitions(token: vscode.CancellationToken): Promise<vscode.McpStdioServerDefinition[]> {
        // Return the opensearch MCP server definition with your specific configuration
        return [
            new vscode.McpStdioServerDefinition(
                'OpenSearch MCP Server',
                '/Users/sarangsa/.local/bin/uv',
                [
                    '--directory',
                    '/Users/sarangsa/Code/eigengravy/opensearch-mcp-server-py',
                    'run',
                    '--',
                    'python',
                    '-m',
                    'mcp_server_opensearch'
                ],
                {
                    OPENSEARCH_URL: 'https://logs-api-ci-wxm-app.o.webex.com/',
                    OPENSEARCH_OAUTH_NAME: 'MicroserviceLogAnalyzer',
                    OPENSEARCH_OAUTH_PASSWORD: 'RWLM.dufh.03.AUGI.dknp.36.BEFP.bcwm.1567',
                    OPENSEARCH_OAUTH_CLIENT_ID: 'C652d21a85854402b5bd7b2207ef96575e47bbb5c168008eeaba51ec7d8e37e93',
                    OPENSEARCH_OAUTH_CLIENT_SECRET: '84ec522d2e99bdf8ac2386c44210f1e921f7cab0f65db734f27798ea43545788',
                    OPENSEARCH_OAUTH_SCOPE: 'lma-logging:serviceowners_read',
                    OPENSEARCH_OAUTH_BEARER_TOKEN_URL: 'https://idbroker.webex.com/idb/token/6078fba4-49d9-4291-9f7b-80116aab6974/v2/actions/GetBearerToken/invoke',
                    OPENSEARCH_OAUTH_TOKEN_URL: 'https://idbroker.webex.com/idb/oauth2/v1/access_token'
                },
                '1.0.0'
            )
        ];
    }

    async resolveMcpServerDefinition(
        server: vscode.McpStdioServerDefinition, 
        token: vscode.CancellationToken
    ): Promise<vscode.McpStdioServerDefinition> {
        // Return the server as-is, no additional resolution needed
        return server;
    }
}
