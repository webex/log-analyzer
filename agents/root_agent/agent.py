from google.adk.agents import SequentialAgent

# ./adk_agent_samples/mcp_agent/agent.py
import os  
from google.adk.agents import LlmAgent
from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm

import json
import litellm

MODEL_GPT_4O = "azure/gpt-4o-mini"

os.environ["AZURE_OPENAI_API_KEY"] = (
    "Y2Y1YTNiYjctYzU4Ni00YWRlLWFiMjYtYjQyZmZkZWEzY2E0NmI2MWM4ZmEtMDNh_A52D_1eb65fdf-9643-417f-9974-ad72cae0e10f"
)
os.environ["AZURE_OPENAI_ENDPOINT"] = (
    "https://llm-proxy.us-east-2.int.infra.intelligence.webex.com/azure/v1"
)
os.environ["AZURE_API_VERSION"] = "2024-12-01-preview"

# litellm._turn_on_debug()

analyze_agent = Agent(
    model=LiteLlm(
        model="azure/gpt-4o",
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.environ["AZURE_API_VERSION"],
    ),
    name="opensearch_mcp_analyser_agent",
    instruction='''Analyze the following JSON data and provide insights about logs. 
    Provide temporal analysis highlighting different endpoints and segregation of microservices. 
    If any errors are present, provide its detailed analysis:
    {search_results}''',
)

# def analyze_json_file(json_file_path):
#     try:
#         with open(json_file_path, 'r') as file:
#             json_data = json.load(file)
        
#         # Convert JSON to string for the agent
#         json_string = json.dumps(json_data, indent=2)
        
#         # Create the prompt with the JSON data
#         prompt = f"Analyze the following JSON data and provide insights about logs. Provide temporal analysis highlighting different endpoints and segregation of microservices. If any errors are present, provide its detailed analysis:\n\n{json_string}"
        
#         # Use LiteLLM directly
#         response = litellm.completion(
#             model="azure/gpt-4o",
#             messages=[{"role": "user", "content": prompt}],
#             api_key=os.environ["AZURE_OPENAI_API_KEY"],
#             api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
#             api_version=os.environ["AZURE_API_VERSION"],
#         )
        
#         return response.choices[0].message.content
        
#     except FileNotFoundError:
#         return f"Error: File '{json_file_path}' not found."
#     except json.JSONDecodeError as e:
#         return f"Error: Invalid JSON format - {e}"
#     except Exception as e:
#         return f"Error: {e}"

# if __name__ == "__main__":
#     result = analyze_json_file("/Users/lgoel/Documents/asdfghj/webex_js_sdk_logs.json")
#     print("Analysis Result:")
#     print(result)

# ./adk_agent_samples/mcp_agent/agent.py
import os  # Required for path operations
from google.adk.agents import LlmAgent
from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.mcp_tool.mcp_toolset import (
    MCPToolset,
    StdioServerParameters,
    StdioConnectionParams,
)
import litellm

MODEL_GPT_4O = "azure/gpt-4o-mini"

os.environ["AZURE_OPENAI_API_KEY"] = (
    "Y2Y1YTNiYjctYzU4Ni00YWRlLWFiMjYtYjQyZmZkZWEzY2E0NmI2MWM4ZmEtMDNh_A52D_1eb65fdf-9643-417f-9974-ad72cae0e10f"
)
os.environ["AZURE_OPENAI_ENDPOINT"] = (
    "https://llm-proxy.us-east-2.int.infra.intelligence.webex.com/azure/v1"
)
os.environ["AZURE_API_VERSION"] = "2024-12-01-preview"

litellm._turn_on_debug()

search_agent = LlmAgent(
    model=LiteLlm(
        model="azure/gpt-4o",
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.environ["AZURE_API_VERSION"],
    ),
    name="opensearch_mcp_agent",
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
  
  The index to search is "logstash-wxm-app"
  
  The response should be the entire JSON response from the OpenSearch server.''',
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


root_agent = SequentialAgent(
    name="MicorserviceLogAnalyzerAgent",
    sub_agents=[search_agent, analyze_agent],
    description="Executes a sequence of log searching and analysis agents.",
)