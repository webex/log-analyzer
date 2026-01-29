import os
from pathlib import Path
from dotenv import load_dotenv
from google.adk.agents import SequentialAgent

# Load environment variables from agents/.env
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

from analyze_agent.agent import analyze_agent
from search_agent.agent import search_agent
from visualAgent.agent import sequence_diagram_agent

root_agent = SequentialAgent(
    name="MicroserviceLogAnalyzerAgent",
    sub_agents=[search_agent, analyze_agent, sequence_diagram_agent],
    description="Executes a sequence of log searching and analysis agents.",
)

