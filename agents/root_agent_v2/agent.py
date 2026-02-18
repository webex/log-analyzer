"""
Root Agent v2 — Sequential pipeline using search_agent_v2 and analyze_agent_v2.

Pipeline: search_agent_v2 → analyze_agent_v2 → sequence_diagram_agent

Run standalone:  adk web agents/root_agent_v2
"""

import os
import logging
from pathlib import Path

from dotenv import load_dotenv
from google.adk.agents import SequentialAgent

# Load environment variables from agents/.env
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# ═══════════════════════════════════════════════════════════════════════════════
# Import sub-agents
# ═══════════════════════════════════════════════════════════════════════════════

from search_agent_v2.agent import search_agent
from analyze_agent_v2.agent import analyze_agent
from visualAgent.agent import sequence_diagram_agent

logging.info("✓ root_agent_v2: All sub-agents imported successfully")

# ═══════════════════════════════════════════════════════════════════════════════
# Root Agent
# ═══════════════════════════════════════════════════════════════════════════════

root_agent = SequentialAgent(
    name="MicroserviceLogAnalyzerV2",
    sub_agents=[search_agent, analyze_agent, sequence_diagram_agent],
    description=(
        "Executes a full log analysis pipeline: "
        "exhaustive BFS search → analysis (calling/contact-center routing) → "
        "PlantUML sequence diagram generation."
    ),
)
