import os  
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

analyze_agent = LlmAgent(
    model=LiteLlm(
        model="azure/gpt-4o",
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.environ["AZURE_API_VERSION"],
    ),
    name="analyze_agent",
    instruction='''Analyze the following JSON data and provide insights about logs. 
    Provide temporal analysis highlighting different endpoints and segregation of microservices. 
    If any errors are present, provide its detailed analysis:
    {search_results}''',
)