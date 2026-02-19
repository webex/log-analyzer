# Agents — AI context for the microservice-log-analyzer agents

Use this file when working in the `agents/` folder. It describes structure, conventions, and how agents integrate.

---

## Purpose

The agents implement an **AI-powered log analysis pipeline** for Webex microservice logs (Mobius, SSE, MSE, WxCAS, etc.). They use **Google ADK (Agent Development Kit)** and **OpenSearch** to search logs, analyze HTTP/SIP/WebRTC flows, and produce markdown analysis plus PlantUML sequence diagrams.

---

## Folder layout

```
agents/
├── AGENT.md                    # This file
├── .env                        # Local env (not committed; copy from .env.example)
├── .env.example                # Template for OPENSEARCH_*, AZURE_OPENAI_*
├── requirements.txt            # Python deps (adk, opensearch-py, etc.)
├── oauth_manager.py             # Shared OAuth/OpenSearch token handling (if used)
│
├── root_agent/                 # Legacy root (sequential pipeline)
├── root_agent_v2/              # Main entry: SequentialAgent pipeline (use this)
├── search_agent/               # Legacy search (MCP-based)
├── search_agent_v2/           # Exhaustive BFS search agent (OpenSearch direct)
├── analyze_agent/             # Legacy analysis
├── analyze_agent_v2/          # Analysis + routing (calling vs contact center)
└── visualAgent/               # PlantUML sequence diagram agent
```

- **Entry point for the app**: `root_agent_v2/agent.py` — defines `root_agent` as a `SequentialAgent` that runs: **search_agent_v2 → analyze_agent_v2 → sequence_diagram_agent**.
- **Run locally**: From repo root, `adk web agents/root_agent_v2` (or run the ADK server that mounts this app).

---

## Pipeline (v2)

1. **search_agent_v2** (`search_agent_v2/agent.py`)
   - **Role**: Exhaustive BFS log search.
   - **Input**: User message (JSON search params: field, value, time range, services, region, env).
   - **Behavior**: Starts from given IDs, queries OpenSearch indexes directly (no MCP subprocess), extracts IDs from hits via LLM, repeats with new IDs (BFS), parallelizes independent searches.
   - **Output (state keys)**: `mobius_logs`, `sse_mse_logs`, `wxcas_logs` (JSON strings of `_source` lists), `search_summary` (totals, depth, IDs searched, search_history).
   - **Auth**: Uses `OpenSearchTokenManager` and env vars (prod vs int via suffix `_INT`).

2. **analyze_agent_v2** (`analyze_agent_v2/agent.py`)
   - **Role**: Route by `serviceIndicator`, then run calling or contact-center analysis.
   - **Input**: State from search_agent_v2 (`mobius_logs`, `sse_mse_logs`, `wxcas_logs`, `search_summary`).
   - **Sub-agents**: `calling_agent` (WebRTC Calling), `contact_center_agent` (Contact Center). Each is an `LlmAgent` with long instructions (HTTP/SIP/media, endpoints, output structure).
   - **Skills**: `mobius_error_id_skill` (toolset) for looking up Mobius error/call IDs from `references/mobius_error_ids.md`; used by `calling_agent` only.
   - **Output**: `analyze_results` (markdown).

3. **visualAgent** (`visualAgent/agent.py`)
   - **Role**: Generate PlantUML sequence diagram from analysis context.
   - **Output**: `sequence_diagram` (PlantUML source). The frontend displays this as “Charts” (rendered via Mermaid/PlantUML).

---

## Conventions

- **Env**: All agents load `agents/.env` via `Path(__file__).parent.parent / ".env"`. Never commit secrets; use `.env.example` as template.
- **Models**: Azure OpenAI via `LiteLlm` with `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, and `extra_headers={"x-cisco-app": "microservice-log-analyzer"}`.
- **State contract**: search_agent_v2 sets the state keys consumed by analyze_agent_v2. Changing key names or shapes must be done in both.
- **Skills**: ADK skills live under `analyze_agent_v2/skills/<skill_name>/` with a `SKILL.md` and optional `references/`. Use `load_skill_from_dir` and `skill_toolset.SkillToolset`.

---

## Key files to touch when…

- **Changing pipeline order or agents**: `root_agent_v2/agent.py`.
- **Changing search logic or OpenSearch indexes**: `search_agent_v2/agent.py`.
- **Changing analysis instructions or routing**: `analyze_agent_v2/agent.py`.
- **Adding/changing Mobius error semantics**: `analyze_agent_v2/skills/mobius_error_id_skill/references/mobius_error_ids.md` and the skill’s `SKILL.md`.
- **Changing sequence diagram rules**: `visualAgent/agent.py`.

---

## Frontend integration

The UI lives in **`log-analyzer-frontend/`** (see that folder’s `AGENT.md`). It talks to the ADK server with:
- **App name**: `root_agent` (session-manager uses this; ensure ADK is serving the same app — either `root_agent` or `root_agent_v2` depending on deployment).
- **Endpoints**: POST session create, POST `/run` with `appName`, `userId`, `sessionId`, `newMessage` (user message is JSON search params).
- **Event parsing**: Frontend parses events by `author` (e.g. search agents, `calling_agent`/`contact_center_agent`, `sequence_diagram_agent`) to extract logs, analysis text, and diagram code.

Keep agent names and event shapes in sync with the frontend’s `page.tsx` event handling (author names and `content.parts` structure).
