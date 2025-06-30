import * as vscode from "vscode";

export interface SearchResult {
  _index: string;
  _id: string;
  _score: number;
  _source: {
    owner?: string;
    datacenter?: string;
    target?: string[];
    message: string;
    environment?: string;
    tags?: string[];
    instanceIndex?: string;
    hostname?: string;
    buildNumber?: string;
    data_sensitivity?: string;
    fields?: {
      eventType?: string;
      logger_name?: string;
      broadworksCorrelationInfo?: string;
      sipCallId?: string;
      version?: string;
      caller_line_number?: number;
      nodeId?: string;
      localAlias?: string;
      caller_class_name?: string;
      DEVICE_ID?: string;
      caller_file_name?: string;
      level_value?: number;
      caller_method_name?: string;
      WEBEX_TRACKINGID?: string;
      id?: string;
      thread_name?: string;
      level?: string;
      [key: string]: any;
    };
    canary?: string;
    log_level?: string;
    "@timestamp": string;
  };
}

export interface CountResponse {
  count: number;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
}

export interface SearchResponse {
  took?: number;
  timed_out?: boolean;
  num_reduce_phases?: number;
  _shards?: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: {
      value: number;
      relation: string;
    };
    max_score: number;
    hits: SearchResult[];
  };
}

export class McpService {
  private static instance: McpService;
  private isConnected = false;
  private statusCallbacks: ((status: boolean) => void)[] = [];
  private readonly DEFAULT_INDEX = "logstash-wxm-app-*";

  // Retry configuration
  private readonly RETRY_CONFIG = {
    maxAttempts: 10,
    initialDelay: 1000,    // 1 second
    maxDelay: 30000,       // 30 seconds
    backoffMultiplier: 1.5
  };

  // Retry state
  private retryCount = 0;
  private retryTimeout?: NodeJS.Timeout;
  private isRetrying = false;

  private constructor() {}

  public static getInstance(): McpService {
    if (!McpService.instance) {
      McpService.instance = new McpService();
    }
    return McpService.instance;
  }

  public async initialize(): Promise<void> {
    // Clear any existing retry timeout
    this.clearRetryTimeout();
    
    // Reset retry count for fresh initialization
    this.retryCount = 0;
    
    // Start retry logic
    await this.initializeWithRetry();
  }

  private async initializeWithRetry(): Promise<void> {
    try {
      console.log(`MCP initialization attempt ${this.retryCount + 1}/${this.RETRY_CONFIG.maxAttempts}`);
      
      // Check if language models and MCP tools are available
      await this.checkMcpConnection();
      
      // Success! Clear retry state and set connected
      this.clearRetryTimeout();
      this.isRetrying = false;
      this.setConnectionStatus(true);
      console.log("MCP service initialized successfully");
      
    } catch (error) {
      console.error(`MCP initialization attempt ${this.retryCount + 1} failed:`, error);
      this.setConnectionStatus(false);
      
      // Check if we should retry
      if (this.retryCount < this.RETRY_CONFIG.maxAttempts - 1) {
        this.retryCount++;
        this.isRetrying = true;
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.RETRY_CONFIG.initialDelay * Math.pow(this.RETRY_CONFIG.backoffMultiplier, this.retryCount - 1),
          this.RETRY_CONFIG.maxDelay
        );
        
        console.log(`Retrying MCP initialization in ${delay}ms (attempt ${this.retryCount + 1}/${this.RETRY_CONFIG.maxAttempts})`);
        
        // Schedule next retry
        this.retryTimeout = setTimeout(() => {
          this.initializeWithRetry();
        }, delay);
      } else {
        console.error("MCP initialization failed after maximum retries");
        this.isRetrying = false;
        // Don't throw error - let the user try to search and see what happens
      }
    }
  }

  private clearRetryTimeout(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = undefined;
    }
  }

  public dispose(): void {
    this.clearRetryTimeout();
    this.statusCallbacks = [];
  }

  public isCurrentlyRetrying(): boolean {
    return this.isRetrying;
  }

  private async checkMcpConnection(): Promise<void> {
    try {
      // Check if language models are available
      const models = await vscode.lm.selectChatModels({
        vendor: "copilot",
        family: "gpt-4o",
      });

      if (models.length === 0) {
        throw new Error("No suitable language model available for MCP");
      }

      console.log(`Found ${models.length} suitable language models`);

      // Check if MCP tools are available
      const availableTools = vscode.lm.tools;
      console.log(`Available MCP tools: ${availableTools.length}`);

      if (availableTools.length > 0) {
        // Log available tools for debugging
        availableTools.forEach((tool) => {
          console.log(`Available tool: ${tool.name} (${tool.description})`);
        });

        // Look for OpenSearch-related tools
        const opensearchTools = availableTools.filter(
          (tool) =>
            tool.name.toLowerCase().includes("opensearch") ||
            tool.name.includes("mcp_opensearch")
        );

        if (opensearchTools.length > 0) {
          console.log(`Found ${opensearchTools.length} OpenSearch MCP tools`);
          return; // Connection successful
        } else {
          console.log(
            "No OpenSearch MCP tools found, but other MCP tools are available"
          );
          return; // Still consider it connected
        }
      } else {
        throw new Error("No MCP tools available");
      }
    } catch (error) {
      throw new Error(`MCP connection check failed: ${error}`);
    }
  }

  public onStatusChange(callback: (status: boolean) => void): void {
    this.statusCallbacks.push(callback);
  }

  private setConnectionStatus(status: boolean): void {
    this.isConnected = status;
    this.statusCallbacks.forEach((callback) => callback(status));
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  private buildCountQuery(trackingId: string): any {
    const isWildcard = trackingId.includes("*");

    if (isWildcard) {
      return {
        query: {
          wildcard: {
            "fields.WEBEX_TRACKINGID.keyword": trackingId,
          },
        },
      };
    } else {
      return {
        query: {
          term: {
            "fields.WEBEX_TRACKINGID.keyword": trackingId,
          },
        },
      };
    }
  }

  private buildSearchQuery(trackingId: string, size: number): any {
    const isWildcard = trackingId.includes("*");

    if (isWildcard) {
      return {
        query: {
          wildcard: {
            "fields.WEBEX_TRACKINGID.keyword": trackingId,
          },
        },
        sort: [
          {
            "@timestamp": {
              order: "asc",
            },
          },
        ],
        size: size,
      };
    } else {
      return {
        query: {
          term: {
            "fields.WEBEX_TRACKINGID.keyword": trackingId,
          },
        },
        sort: [
          {
            "@timestamp": {
              order: "asc",
            },
          },
        ],
        size: size,
      };
    }
  }

  private async callMcpCountTool(trackingId: string): Promise<CountResponse> {
    try {
      // Find the OpenSearch MCP count tool
      const countTool = vscode.lm.tools.find(
        (tool) => tool.name === "mcp_opensearch-mc_CountTool"
      );

      if (!countTool) {
        throw new Error(
          "OpenSearch count tool not found in available MCP tools"
        );
      }

      const queryBody = this.buildCountQuery(trackingId);

      // Prepare tool parameters according to the MCP server schema
      const toolParameters = {
        index: this.DEFAULT_INDEX,
        body: queryBody,
        opensearch_url: "https://logs-api-ci-wxm-app.o.webex.com/",
      };

      console.log(
        `Calling MCP tool: ${countTool.name} with parameters:`,
        toolParameters
      );

      // Invoke the tool directly
      const toolResult = await vscode.lm.invokeTool(
        countTool.name,
        {
          input: toolParameters,
          toolInvocationToken: undefined,
        },
        new vscode.CancellationTokenSource().token
      );

      console.log("Count tool result:", toolResult);

      // Parse the tool result - handle MCP response structure
      if (toolResult && typeof toolResult === "object" && toolResult !== null) {
        // Check if it's the MCP response structure with content array
        if (
          "content" in toolResult &&
          Array.isArray((toolResult as any).content) &&
          (toolResult as any).content.length > 0
        ) {
          const contentItem = (toolResult as any).content[0];
          if (
            contentItem &&
            typeof contentItem === "object" &&
            contentItem !== null &&
            "value" in contentItem &&
            typeof contentItem.value === "string"
          ) {
            try {
              const parsed = JSON.parse(contentItem.value);
              if (parsed.count !== undefined) {
                return {
                  count: parsed.count,
                  _shards: parsed._shards || {
                    total: 1,
                    successful: 1,
                    skipped: 0,
                    failed: 0,
                  },
                };
              }
            } catch (parseError) {
              console.error(
                "Failed to parse MCP content value as JSON:",
                parseError
              );
            }
          }
        }

        // Fallback: check if it's already the expected format
        if ("count" in toolResult) {
          return {
            count: (toolResult as any).count as number,
            _shards: (toolResult as any)._shards || {
              total: 1,
              successful: 1,
              skipped: 0,
              failed: 0,
            },
          };
        }
      }

      // If toolResult is a string, try to parse it as JSON
      if (typeof toolResult === "string") {
        try {
          const parsed = JSON.parse(toolResult);
          if (parsed.count !== undefined) {
            return {
              count: parsed.count,
              _shards: parsed._shards || {
                total: 1,
                successful: 1,
                skipped: 0,
                failed: 0,
              },
            };
          }
        } catch (parseError) {
          console.error("Failed to parse tool result as JSON:", parseError);
        }
      }

      throw new Error(
        `Unexpected tool result format: ${JSON.stringify(toolResult)}`
      );
    } catch (error) {
      console.error("Error calling MCP count tool:", error);
      throw error;
    }
  }

  private async callMcpSearchTool(
    trackingId: string,
    size: number
  ): Promise<SearchResponse> {
    try {
      // Find the OpenSearch MCP search tool
      const searchTool = vscode.lm.tools.find(
        (tool) => tool.name === "mcp_opensearch-mc_SearchIndexTool"
      );

      if (!searchTool) {
        throw new Error(
          "OpenSearch search tool not found in available MCP tools"
        );
      }

      const queryBody = this.buildSearchQuery(trackingId, size);

      // Prepare tool parameters according to the MCP server schema
      const toolParameters = {
        index: this.DEFAULT_INDEX,
        query: queryBody,
        opensearch_url: "https://logs-api-ci-wxm-app.o.webex.com/",
      };

      console.log(
        `Calling MCP tool: ${searchTool.name} with parameters:`,
        toolParameters
      );

      // Invoke the tool directly
      const toolResult = await vscode.lm.invokeTool(
        searchTool.name,
        {
          input: toolParameters,
          toolInvocationToken: undefined,
        },
        new vscode.CancellationTokenSource().token
      );

      console.log("Search tool result:", toolResult);

      // Parse the tool result - handle MCP response structure
      if (toolResult && typeof toolResult === "object" && toolResult !== null) {
        // Check if it's the MCP response structure with content array
        if (
          "content" in toolResult &&
          Array.isArray((toolResult as any).content) &&
          (toolResult as any).content.length > 0
        ) {
          const contentItem = (toolResult as any).content[0];
          if (
            contentItem &&
            typeof contentItem === "object" &&
            contentItem !== null &&
            "value" in contentItem &&
            typeof contentItem.value === "string"
          ) {
            try {
              // The MCP response includes a descriptive prefix before the JSON
              // Extract the JSON part from the formatted string
              let jsonString = contentItem.value;

              // Look for the start of JSON (first opening brace)
              const jsonStartIndex = jsonString.indexOf("{");
              if (jsonStartIndex !== -1) {
                jsonString = jsonString.substring(jsonStartIndex);
              }

              const parsed = JSON.parse(jsonString);
              if (parsed.hits) {
                return parsed as SearchResponse;
              }
            } catch (parseError) {
              console.error(
                "Failed to parse MCP content value as JSON:",
                parseError
              );
              console.error("Raw content value:", contentItem.value);
            }
          }
        }

        // Fallback: check if it's already the expected format
        if ("hits" in toolResult) {
          return toolResult as SearchResponse;
        }
      }

      // If toolResult is a string, try to parse it as JSON
      if (typeof toolResult === "string") {
        try {
          // Handle formatted string case here too
          let jsonString: string = toolResult;
          const jsonStartIndex = jsonString.indexOf("{");
          if (jsonStartIndex !== -1) {
            jsonString = jsonString.substring(jsonStartIndex);
          }

          const parsed = JSON.parse(jsonString);
          if (parsed.hits) {
            return parsed as SearchResponse;
          }
        } catch (parseError) {
          console.error("Failed to parse tool result as JSON:", parseError);
        }
      }

      throw new Error(
        `Unexpected tool result format: ${JSON.stringify(toolResult)}`
      );
    } catch (error) {
      console.error("Error calling MCP search tool:", error);
      throw error;
    }
  }

  public async searchLogs(trackingId: string): Promise<SearchResponse> {
    try {
      // Step 1: Get count of results using CountTool
      console.log(`Step 1: Getting count for tracking ID: ${trackingId}`);
      const countResponse = await this.callMcpCountTool(trackingId);
      console.log(`Count response: ${countResponse.count} results found`);

      // If we got here, MCP connection is working
      if (!this.isConnected) {
        this.setConnectionStatus(true);
      }

      if (countResponse.count === 0) {
        return {
          took: 0,
          timed_out: false,
          _shards: countResponse._shards,
          hits: {
            total: {
              value: 0,
              relation: "eq",
            },
            max_score: 0,
            hits: [],
          },
        };
      }

      // Step 2: Search with the count as size using SearchIndexTool
      console.log(`Step 2: Searching with size: ${countResponse.count}`);
      const searchResponse = await this.callMcpSearchTool(
        trackingId,
        countResponse.count
      );
      console.log(
        `Search response: ${searchResponse.hits.hits.length} logs returned`
      );

      return searchResponse;
    } catch (error) {
      console.error("Error searching logs:", error);
      // Set connection status to false if search fails
      this.setConnectionStatus(false);
      throw error;
    }
  }
}
