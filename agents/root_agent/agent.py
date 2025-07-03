import os
from google.adk.agents import SequentialAgent
from analyze_agent.agent import analyze_agent
from search_agent.agent import search_agent

os.environ["AZURE_OPENAI_API_KEY"] = (
    "MDczZDFmMDQtNDkwMC00ZDM2LWI1OGItY2YzMDlhZDMyYzA2N2U4YWRhNGEtM2U1_A52D_1eb65fdf-9643-417f-9974-ad72cae0e10f"
)
os.environ["AZURE_OPENAI_ENDPOINT"] = (
    "https://llm-proxy.us-east-2.int.infra.intelligence.webex.com/azure/v1"
)
os.environ["AZURE_API_VERSION"] = "2024-12-01-preview"

root_agent = SequentialAgent(
    name="MicorserviceLogAnalyzerAgent",
    sub_agents=[search_agent, analyze_agent],
    description="Executes a sequence of log searching and analysis agents.",
)
