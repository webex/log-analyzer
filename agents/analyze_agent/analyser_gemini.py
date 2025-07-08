import os
from google.adk.agents import Agent
import google.generativeai as genai

os.environ["GEMINI_API_KEY"] = ("AIzaSyDoPDDW6EsTfT2zl9gyBo_riP1DgjNwUDg")
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model= genai.GenerativeModel('gemini-1.5-flash')

root_agent = Agent(
    model="gemini-1.5-flash",
    name="opensearch_mcp_analyser_agent_gemini",
    instruction='''You are a network analyst expert in http, webRTC, SIP, SDP and other related protocols. Analyze the following logs and provide detailed insights in layman terms. Provide temporal analysis highlighting critical endpoints. Provide segregation of all the microservices like wdm, mobius, cpapi, mercury etc being used in the session. If any errors are present in the logs, provide its detailed analysis, including potential causes and fixes for a user.''',
)