# 🛠️ Microservice Log Analyzer

An AI-powered tool that helps analyze microservice logs. Built with a multi-agent architecture powered by Google’s Agent Development Kit (ADK) and OpenSearch-MCP integration.

---

## 🚀 Getting Started

### 1. 📁 Clone the Repository

```bash
git clone <your-repo-url>
cd microservice-log-analyzer
```

---

### 2. 🔧 Configure MCP Server

- Open:  
  `search_agent/agent.py`

- Locate the `MCPToolset` configuration.

- Update:
  - `command` → Path to your local **UV** binary.
  - `args` → Full path to your local `opensearch-mcp-server-py` repository.

```python
MCPToolset(
    command="/path/to/your/uv",
    args=["/full/path/to/opensearch-mcp-server-py"]
)
```

- Make sure required environment variables for OpenSearch/MCP are set properly.

---

### 3. 🎨 Set Up the Frontend UI

```bash
cd log-analyzer-frontend
npm install
npm run dev
```

The UI will be available at [http://localhost:3000](http://localhost:3000).

---

### 4. 🔐 Get and Use Webex Bearer Token (for LiteLLM)

> **Note**: The Webex bearer token is required to authenticate **LiteLLM**, which powers the LLM backend used for natural language analysis.

#### Steps to Get the Token:

1. Visit the internal Webex Developer Portal:  
   [https://developer-portal-intb.ciscospark.com](https://developer-portal-intb.ciscospark.com)

2. Log in with your Cisco credentials.

3. After login, a **Bearer Token** will be generated automatically.

4. **Copy** the token shown in the Authorization field.

#### Set the Token for LiteLLM:

You can provide the token via environment variable or directly in your agent code.

**Option A: Set as environment variable**
```bash
export LITELLM_API_KEY="Bearer <your-webex-token>"
```

**Option B: Hardcode into agent (not recommended for production)**
```python
llm = ChatOpenAI(openai_api_key="Bearer <your-webex-token>", ...)
```

> Make sure `LITELLM_API_KEY` is accessible wherever LiteLLM is initialized in the agent stack (typically in `root_agent/agent.py`).

---

### 5. ✍️ Configure LLM Usage

In `agents/root_agent/agent.py`:

```python
import os
llm = ChatOpenAI(openai_api_key=os.getenv("LITELLM_API_KEY"), ...)
```

Ensure your bearer token is stored in `LITELLM_API_KEY`.

---

### 6. 🧠 Start the Backend

run:

```bash
cd agents
adk web
```

This will launch the backend agent system using the Agent Development Kit (ADK).

---

## ✅ You're All Set!

- **Frontend:** http://localhost:3000  
- **Backend:** Running with ADK and LiteLLM  
- **LLM Auth:** Via Webex bearer token  

---

## 📬 Contributing
Found a bug or want to improve this project? Open a pull request or issue.
