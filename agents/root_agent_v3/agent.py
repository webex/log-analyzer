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
# from query_analyzer.agent import query_analyzer
from chat_agent.agent import chat_agent
from query_router.agent import query_router


from oauth_manager import get_token_manager_machine

oauth_manager = get_token_manager_machine()
oauth_manager.initialize()

# ═══════════════════════════════════════════════════════════════════════════════
# Root Agent
# ═══════════════════════════════════════════════════════════════════════════════

root_agent = SequentialAgent(
    name="root_agent_v3",
    sub_agents=[query_router, chat_agent],
    description=(
        "Root orchestrator: routes queries through the search pipeline "
        "and chat agent in sequence."
    ),
)