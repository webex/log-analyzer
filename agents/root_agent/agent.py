import os
from google.adk.agents import SequentialAgent
from opik.integrations.adk import OpikTracer, track_adk_agent_recursive

os.environ["AZURE_OPENAI_API_KEY"] = (
    "MTk1ZjBmZjMtMTczZS00ZTFlLWE2N2EtN2I2MDVlMWMzZDgyZjRhODgxYWItNWNl_A52D_1eb65fdf-9643-417f-9974-ad72cae0e10f"
)
os.environ["AZURE_OPENAI_ENDPOINT"] = (
    "https://llm-proxy.us-east-2.int.infra.intelligence.webex.com/azure/v1"
)
os.environ["AZURE_API_VERSION"] = "2024-10-21"

from analyze_agent.agent import analyze_agent
from search_agent.agent import search_agent

opik_tracer = OpikTracer()

root_agent = SequentialAgent(
    name="MicorserviceLogAnalyzerAgent",
    sub_agents=[search_agent, analyze_agent],
    description="Executes a sequence of log searching and analysis agents.",
)

track_adk_agent_recursive(root_agent, opik_tracer)
