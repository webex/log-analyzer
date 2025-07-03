import os
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.mcp_tool.mcp_toolset import (
    MCPToolset,
    StdioServerParameters,
    StdioConnectionParams,
)

search_agent = LlmAgent(
    model=LiteLlm(
        model="azure/gpt-4o",
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.environ["AZURE_API_VERSION"],
    ),
    name="search_agent",
    output_key="search_results",
    instruction='''Query OpenSearch MCP server for logs.
    Given a webex tracking id like "webex-js-sdk_2b08d954-8cf8-460c-bf91-b9dddb1d8533_12", use the following schema to track it.
    
  {
    "query": {
      "term": {
        "fields.WEBEX_TRACKINGID.keyword": "<tracking id>"
    }
    },
    "size": 10000,
    "sort": [
      {
        "@timestamp": {
          "order": "asc"
        }
      }
    ]
  }
  
  If the tracking ID includes wildcards like "webex-js-sdk_2b08d954-8cf8-460c-bf91-b9dddb1d8533_*", use the following schema:

  {
    "query": {
      "wildcard": {
        "fields.WEBEX_TRACKINGID.keyword": "<tracking id>"
    }
    },
    "size": 10000,
    "sort": [
      {
        "@timestamp": {
          "order": "asc"
        }
      }
    ]
  }



  The index to search is "logstash-wxm-app"
  
  The response should be the entire JSON response from the OpenSearch server. SHOW ALL THE LOGS DONT HIDE ANYTHING.''',
    tools=[
        MCPToolset(
            connection_params=StdioConnectionParams(
                timeout=300.0,
                server_params=StdioServerParameters(
                    command="/Users/sarangsa/.local/bin/uv",
                    args=[
                        "--directory",
                        "/Users/sarangsa/Code/microservice-log-analyzer/opensearch-mcp-server-py",
                        "run",
                        "--",
                        "python",
                        "-m",
                        "mcp_server_opensearch",
                    ],
                    env={
                        "OPENSEARCH_URL": "https://logs-api-ci-wxm-app.o.webex.com/",
                        "OPENSEARCH_OAUTH_NAME": "MicroserviceLogAnalyzer",
                        "OPENSEARCH_OAUTH_PASSWORD": "RWLM.dufh.03.AUGI.dknp.36.BEFP.bcwm.1567",
                        "OPENSEARCH_OAUTH_CLIENT_ID": "C652d21a85854402b5bd7b2207ef96575e47bbb5c168008eeaba51ec7d8e37e93",
                        "OPENSEARCH_OAUTH_CLIENT_SECRET": "84ec522d2e99bdf8ac2386c44210f1e921f7cab0f65db734f27798ea43545788",
                        "OPENSEARCH_OAUTH_SCOPE": "lma-logging:serviceowners_read",
                        "OPENSEARCH_OAUTH_BEARER_TOKEN_URL": "https://idbroker.webex.com/idb/token/6078fba4-49d9-4291-9f7b-80116aab6974/v2/actions/GetBearerToken/invoke",
                        "OPENSEARCH_OAUTH_TOKEN_URL": "https://idbroker.webex.com/idb/oauth2/v1/access_token",
                    },
                ),
            ),
            tool_filter=["SearchIndexTool"],
        ),
    ],
)
