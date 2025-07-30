# 🛠️ Microservice Log Analyzer

An AI-powered tool that helps analyze microservice logs. Built with a multi-agent architecture powered by Google’s Agent Development Kit (ADK) and OpenSearch-MCP integration.

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <https://sqbu-github.cisco.com/WebexDevPlatform/microservice-log-analyzer.git>
cd microservice-log-analyzer
```

---
### 2. Install dependencies
- Ensure you have Python>= 3.10 installed.

- Install Node.js>= 18 and pnpm

- Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

- Install python dependencies:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure MCP Server

- Open:  
  `search_agent/agent.py`

- Locate the `MCPToolset` configuration.

- Update:
  - `command` → Path to your local **UV** binary. 
      refer to: https://www.uvicorn.org/#quickstart
  - `args` → Full path to your local `opensearch-mcp-server-py` repository.

```python
MCPToolset(
    command="/path/to/your/uv",
    args=["/full/path/to/opensearch-mcp-server-py"]
)
```

- Make sure required environment variables for OpenSearch/MCP are set properly.

---

### 4. Set Up the Frontend UI

```bash
cd log-analyzer-frontend
pnpm install
pnpm run dev
```

The UI will be available at [http://localhost:3000](http://localhost:3000).

---

### 5. Configure LLM Usage

> **Note**: The Webex bearer token is required to authenticate **LiteLLM**, which powers the LLM backend used for natural language analysis.

#### Steps to Get the Token:

1. Visit the internal Webex Developer Portal:  
   [https://developer-portal-intb.ciscospark.com](https://developer-portal-intb.ciscospark.com)

2. Log in with your Cisco credentials.

3. After login, a **Bearer Token** will be generated automatically.

4. **Copy** the token shown in the Authorization field.

### Setup:
In `agents/root_agent/agent.py`:
Copy your bearer token in os.environ["AZURE_OPENAI_API_KEY"]=("...your token...")

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
