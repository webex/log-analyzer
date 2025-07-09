import os  
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm

analyze_agent = LlmAgent(
    model=LiteLlm(
        model="azure/gpt-4.1",
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.environ["AZURE_API_VERSION"],
    ),
    name="analyze_agent",
    instruction='''You are a network analyst expert in http, webRTC, SIP, SDP and other related protocols. 
    Analyze the following logs and provide detailed insights in layman terms. 
    Provide temporal analysis highlighting critical endpoints. 
    Provide segregation of all the various microservices like wdm, mobius, cpapi, mercury being used in the sessions. 
    If any errors are present in the logs, provide its detailed analysis, including potential causes and fixes for a user

    {search_results}''',
)