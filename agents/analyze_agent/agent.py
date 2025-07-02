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

# root_agent = Agent(
#     model=LiteLlm(
#         model="azure/gpt-4o",
#         api_key=os.environ["AZURE_OPENAI_API_KEY"],
#         api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
#         api_version=os.environ["AZURE_API_VERSION"],
#     ),
#     name="opensearch_mcp_analyser_agent",
#     instruction='''Analyse the provided JSON data and provide a clear summary:''',
# )

def analyze_json_file(json_file_path):
    try:
        with open(json_file_path, 'r') as file:
            json_data = json.load(file)
        
        # Convert JSON to string for the agent
        json_string = json.dumps(json_data, indent=2)
        
        # Create the prompt with the JSON data
        prompt = f"Analyze the following JSON data and provide insights about logs. Provide temporal analysis highlighting different endpoints and segregation of microservices. If any errors are present, provide its detailed analysis:\n\n{json_string}"
        
        # Use LiteLLM directly
        response = litellm.completion(
            model="azure/gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            api_key=os.environ["AZURE_OPENAI_API_KEY"],
            api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_version=os.environ["AZURE_API_VERSION"],
        )
        
        return response.choices[0].message.content
        
    except FileNotFoundError:
        return f"Error: File '{json_file_path}' not found."
    except json.JSONDecodeError as e:
        return f"Error: Invalid JSON format - {e}"
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    result = analyze_json_file("/Users/lgoel/Documents/asdfghj/webex_js_sdk_logs.json")
    print("Analysis Result:")
    print(result)
