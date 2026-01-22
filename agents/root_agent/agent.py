import os
from google.adk.agents import SequentialAgent

os.environ["AZURE_OPENAI_API_KEY"] = (
    "ZWZkNzNhMzQtNTI3OS00NWFlLWJlOWItMzE4YWJhOWFhZTdiNDRmM2MzNTUtOTE1_A52D_1eb65fdf-9643-417f-9974-ad72cae0e10f"
)
os.environ["AZURE_OPENAI_ENDPOINT"] = (
    "https://llm-proxy.us-east-2.int.infra.intelligence.webex.com/azure/v1"
)
os.environ["AZURE_API_VERSION"] = "2024-10-21"

from analyze_agent.agent import analyze_agent
from search_agent.agent import search_agent
from visualAgent.agent import sequence_diagram_agent

root_agent = SequentialAgent(
    name="MicorserviceLogAnalyzerAgent",
    sub_agents=[search_agent, analyze_agent, sequence_diagram_agent],
    description="Executes a sequence of log searching and analysis agents.",
)

