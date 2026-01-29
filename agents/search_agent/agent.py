import os
import shutil
from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.mcp_tool.mcp_toolset import (
    MCPToolset,
    StdioServerParameters,
    StdioConnectionParams,
)

UV_PATH = "/opt/homebrew/bin/uv"

# Agent 1: Search Mobius logs in wxm-app indexes
wxm_search_agent = LlmAgent(
    model=LiteLlm(
        model="azure/gpt-4.1",
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.environ["AZURE_API_VERSION"],
    ),
    name="wxm_search_agent",
    output_key="mobius_logs",
    instruction="""
You are the Mobius Log Search Agent. Your job is to search for Mobius microservice logs in the logstash-wxm-app indexes.

**1. Core Task:**
Search the appropriate `logstash-wxm-app` indexes based on the selected regions:
- US region: `logstash-wxm-app`
- EU region: `logstash-wxm-app-eu1`

Check the user's region selection and ONLY search the indexes for the selected regions.

**2. Searchable Fields:**
*   `fields.WEBEX_TRACKINGID.keyword`
*   `fields.mobiusCallId.keyword`
*   `fields.sipCallId.keyword`
*   `fields.localSessionId.keyword`
*   `fields.remoteSessionId.keyword`
*   `fields.USER_ID.keyword`
*   `fields.DEVICE_ID.keyword`
*   `@timestamp`
*   `message`

**3. Query Construction:**

**CRITICAL**: Make separate tool calls based on selected regions:
- If "us" is selected: query `logstash-wxm-app`
- If "eu" is selected: query `logstash-wxm-app-eu1`
- If both are selected: make 2 separate tool calls (one for each index)

Always include Mobius service filter and sort by timestamp ascending:

```json
{
  "index": "logstash-wxm-app",
  "query": {
    "query": {
      "bool": {
        "must": [
          <your identifier query here>,
          { "wildcard": { "tags": "*mobius*" } }
        ]
      }
    },
    "size": 10000,
    "sort": [ { "@timestamp": { "order": "asc" } } ]
  }
}
```

**4. Query Logic:**
- **Exact Match**: Use `term` query for exact IDs
- **Pattern Match**: Use `wildcard` for IDs with `*`
- **Session ID**: If provided, search BOTH `localSessionId` and `remoteSessionId` with `bool` `should` clause
- **Multiple Conditions**: Combine with `bool` `must`

**5. Output:**
Save the entire JSON response from both indexes to agent state for session extraction.
Display: "Found X Mobius logs from wxm-app indexes. Extracting session information..."

**6. Examples:**

Tracking ID search:
```json
{
  "index": "logstash-wxm-app",
  "query": {
    "query": {
      "bool": {
        "must": [
          { "wildcard": { "fields.WEBEX_TRACKINGID.keyword": "webex-js-sdk_2b08d954-8cf8-460c-bf91-b9dddb1d8533_*" } },
          { "wildcard": { "tags": "*mobius*" } }
        ]
      }
    },
    "size": 10000,
    "sort": [ { "@timestamp": { "order": "asc" } } ]
  }
}
```

Session ID search (search in both local and remote):
```json
{
  "index": "logstash-wxm-app",
  "query": {
    "query": {
      "bool": {
        "must": [
          {
            "bool": {
              "should": [
                { "term": { "fields.localSessionId.keyword": "abc123xyz" } },
                { "term": { "fields.remoteSessionId.keyword": "abc123xyz" } }
              ]
            }
          },
          { "wildcard": { "tags": "*mobius*" } }
        ]
      }
    },
    "size": 10000,
    "sort": [ { "@timestamp": { "order": "asc" } } ]
  }
}
```
""",
    tools=[
        MCPToolset(
            connection_params=StdioConnectionParams(
                timeout=1000.0,
                server_params=StdioServerParameters(
                    command=UV_PATH,
                    args=[
                        "--directory",
                        "/Users/pkesari/Desktop/WorkProjects/microservice-log-analyzer/opensearch-mcp-server-py",
                        "run",
                        "--",
                        "python",
                        "-m",
                        "mcp_server_opensearch",
                    ],
                    env={
                        "OPENSEARCH_OAUTH_TOKEN": "ZTViYjE2ZTMtNGE0OS00YzJhLThiMTItYWY4YTA2NDIyOTJmNmNkNjE5N2UtZmEz_PF84_6078fba4-49d9-4291-9f7b-80116aab6974",
                        "OPENSEARCH_OAUTH_NAME": "MicroserviceLogAnalyzer",
                        "OPENSEARCH_OAUTH_PASSWORD": "QBLP.qsxh.16.VIKL.cdwz.38.CZKP.rtwm.3467",
                        "OPENSEARCH_OAUTH_CLIENT_ID": "C652d21a85854402b5bd7b2207ef96575e47bbb5c168008eeaba51ec7d8e37e93",
                        "OPENSEARCH_OAUTH_CLIENT_SECRET": "84ec522d2e99bdf8ac2386c44210f1e921f7cab0f65db734f27798ea43545788",
                        "OPENSEARCH_OAUTH_SCOPE": "lma-logging:serviceowners_read lma-logging:wxcalling_read",
                        "OPENSEARCH_OAUTH_BEARER_TOKEN_URL": "https://idbroker.webex.com/idb/token/6078fba4-49d9-4291-9f7b-80116aab6974/v2/actions/GetBearerToken/invoke",
                        "OPENSEARCH_OAUTH_TOKEN_URL": "https://idbroker.webex.com/idb/oauth2/v1/access_token",
                    },
                ),
            ),
            tool_filter=["SearchIndexTool"],
        ),
    ],
)

# Agent 2: Extract session ID from Mobius logs
session_extractor_agent = LlmAgent(
    model=LiteLlm(
        model="azure/gpt-4.1",
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.environ["AZURE_API_VERSION"],
    ),
    name="session_extractor_agent",
    output_key="extracted_session_id",
    instruction="""
You are the Session ID Extraction Agent. Your job is to extract valid session IDs from Mobius logs.

**1. Core Task:**
Analyze the Mobius logs from the previous agent ({mobius_logs}) and extract the session ID to use for SSE/MSE log searches.

**2. Session ID Characteristics:**
- Session IDs are alphanumeric strings (not the dummy "0000000000000000" values)
- They appear in fields like `localSessionId` or `remoteSessionId` in Mobius logs
- They may also appear in log message content
- Look for actual non-zero session identifiers

**3. Extraction Logic:**
1. First check if the original user request already contained a session ID - if so, use that
2. Otherwise, parse the Mobius logs JSON response:
   - Look in `_source.fields.localSessionId` 
   - Look in `_source.fields.remoteSessionId`
   - Parse `_source.message` content for session ID patterns
3. Ignore dummy values like "0000000000000000" or all-zero patterns
4. Extract the first valid, non-dummy session ID found

**4. Output Format:**
You MUST output in this exact format:
```
EXTRACTED_SESSION_ID: <the_actual_session_id>
```

If no valid session ID is found, output:
```
EXTRACTED_SESSION_ID: NONE
```

**5. Important Notes:**
- Be thorough in parsing the log messages - session IDs can appear in various formats
- Prioritize session IDs from structured fields over those in message text
- Only extract alphanumeric session IDs that are clearly identifiers
- Display to user: "Extracted session ID: <id>. Searching SSE/MSE logs..."
""",
)

# Agent 3: Search SSE/MSE logs in wxcalling indexes
wxcalling_search_agent = LlmAgent(
    model=LiteLlm(
        model="azure/gpt-4.1",
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.environ["AZURE_API_VERSION"],
    ),
    name="wxcalling_search_agent",
    output_key="sse_mse_logs",
    instruction="""
You are the SSE/MSE Log Search Agent. Your job is to search for SSE and MSE microservice logs using the extracted session ID.

**1. Core Task:**
Search the appropriate `logstash-wxcalling` indexes based on the selected regions:
- US region: `logstash-wxcalling`
- EU region: `logstash-wxcallingeuc1`

Check the user's region selection and ONLY search the indexes for the selected regions.

**2. Input:**
Read the extracted session ID from {extracted_session_id}. 
- If it says "EXTRACTED_SESSION_ID: NONE", skip the search and return empty results
- Otherwise, use the extracted session ID for wildcard message search

**3. Query Construction:**

**CRITICAL**: Make separate tool calls based on selected regions:
- If "us" is selected: query `logstash-wxcalling`
- If "eu" is selected: query `logstash-wxcallingeuc1`
- If both are selected: make 2 separate tool calls (one for each index)

Use wildcard search on the `message` field with the session ID and filter for SSE/MSE services:

```json
{
  "index": "logstash-wxcalling",
  "query": {
    "query": {
      "bool": {
        "must": [
          { "wildcard": { "message": "*<session_id>*" } },
          {
            "bool": {
              "should": [
                { "wildcard": { "tags": "*sse*" } },
                { "wildcard": { "tags": "*mse*" } }
              ]
            }
          }
        ]
      }
    },
    "size": 10000,
    "sort": [ { "@timestamp": { "order": "asc" } } ]
  }
}
```

**4. Output:**
Save the entire JSON response from both indexes to agent state.
Display: "Found X SSE/MSE logs. Preparing comprehensive analysis..."

**5. Important:**
- Always use wildcard for message search to catch session ID in various contexts
- Filter for BOTH sse and mse tags using `bool` `should`
- Sort by timestamp ascending for chronological analysis
- If no session ID was extracted, return empty results gracefully
""",
    tools=[
        MCPToolset(
            connection_params=StdioConnectionParams(
                timeout=1000.0,
                server_params=StdioServerParameters(
                    command=UV_PATH,
                    args=[
                        "--directory",
                        "/Users/pkesari/Desktop/WorkProjects/microservice-log-analyzer/opensearch-mcp-server-py",
                        "run",
                        "--",
                        "python",
                        "-m",
                        "mcp_server_opensearch",
                    ],
                    env={
                        "OPENSEARCH_OAUTH_TOKEN": "ZTViYjE2ZTMtNGE0OS00YzJhLThiMTItYWY4YTA2NDIyOTJmNmNkNjE5N2UtZmEz_PF84_6078fba4-49d9-4291-9f7b-80116aab6974",
                        "OPENSEARCH_OAUTH_NAME": "MicroserviceLogAnalyzer",
                        "OPENSEARCH_OAUTH_PASSWORD": "QBLP.qsxh.16.VIKL.cdwz.38.CZKP.rtwm.3467",
                        "OPENSEARCH_OAUTH_CLIENT_ID": "C652d21a85854402b5bd7b2207ef96575e47bbb5c168008eeaba51ec7d8e37e93",
                        "OPENSEARCH_OAUTH_CLIENT_SECRET": "84ec522d2e99bdf8ac2386c44210f1e921f7cab0f65db734f27798ea43545788",
                        "OPENSEARCH_OAUTH_SCOPE": "lma-logging:serviceowners_read lma-logging:wxcalling_read",
                        "OPENSEARCH_OAUTH_BEARER_TOKEN_URL": "https://idbroker.webex.com/idb/token/6078fba4-49d9-4291-9f7b-80116aab6974/v2/actions/GetBearerToken/invoke",
                        "OPENSEARCH_OAUTH_TOKEN_URL": "https://idbroker.webex.com/idb/oauth2/v1/access_token",
                    },
                ),
            ),
            tool_filter=["SearchIndexTool"],
        ),
    ],
)

# Agent 4: Extract SSE Call-ID from SSE/MSE logs
sse_callid_extractor_agent = LlmAgent(
    model=LiteLlm(
        model="azure/gpt-4.1",
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.environ["AZURE_API_VERSION"],
    ),
    name="sse_callid_extractor_agent",
    output_key="extracted_sse_callid",
    instruction="""
You are the SSE Call-ID Extraction Agent. Your job is to extract SSE Call-ID from SIP SSE logs.

**1. Core Task:**
Analyze the SSE/MSE logs from the previous agent ({sse_mse_logs}) and extract the SSE Call-ID for WxCAS log searches.

**2. SSE Call-ID Pattern:**
- SSE Call-IDs follow the pattern: `SSE` followed by digits, then `@`, then IP address
- Example: `SSE0520080392201261106889615@10.249.187.80`
- Regex pattern: `SSE[0-9]+@[0-9.]+`
- They appear in SIP message headers as `Call-ID:` field

**3. Extraction Logic:**
1. Parse the SSE/MSE logs JSON response from {sse_mse_logs}
2. Look for SIP SSE logs that contain "Call-ID:" in the message
3. Extract the Call-ID value that matches the SSE pattern
4. Focus on logs with message type like "RESPONSE100", "INVITE", or other SIP messages
5. Example log pattern:
   ```
   Transformer Consumed SIP Event: Message type: RESPONSE100
   ...
   Call-ID:SSE0520080392201261106889615@10.249.187.80
   ```

**4. Output Format:**
You MUST output in this exact format:
```
EXTRACTED_SSE_CALLID: <the_actual_sse_callid>
```

If no valid SSE Call-ID is found, output:
```
EXTRACTED_SSE_CALLID: NONE
```

**5. Important Notes:**
- Only extract Call-IDs that match the SSE pattern (starts with "SSE", contains digits and IP)
- Look in the `_source.message` field of the log entries
- Extract the first valid SSE Call-ID found
- Display to user: "Extracted SSE Call-ID: <id>. Searching WxCAS logs..."
""",
)

# Agent 5: Search WxCAS logs in wxcalling indexes
wxcas_search_agent = LlmAgent(
    model=LiteLlm(
        model="azure/gpt-4.1",
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_version=os.environ["AZURE_API_VERSION"],
    ),
    name="wxcas_search_agent",
    output_key="wxcas_logs",
    instruction="""
You are the WxCAS Log Search Agent. Your job is to search for WxCAS (Webex Calling Application Server) logs using the extracted SSE Call-ID.

**1. Core Task:**
Search the appropriate `logstash-wxcalling` indexes based on the selected regions:
- US region: `logstash-wxcalling`
- EU region: `logstash-wxcallingeuc1`

Check the user's region selection and ONLY search the indexes for the selected regions.

**2. Input:**
Read the extracted SSE Call-ID from {extracted_sse_callid}.
- If it says "EXTRACTED_SSE_CALLID: NONE", skip the search and return empty results
- Otherwise, use the extracted Call-ID for exact match search

**3. Query Construction:**

**CRITICAL**: Make separate tool calls based on selected regions:
- If "us" is selected: query `logstash-wxcalling`
- If "eu" is selected: query `logstash-wxcallingeuc1`
- If both are selected: make 2 separate tool calls (one for each index)

Use exact match on the `callId.keyword` field with the extracted Call-ID and filter for WxCAS service:

```json
{
  "index": "logstash-wxcalling",
  "query": {
    "query": {
      "bool": {
        "must": [
          { "term": { "callId.keyword": "<extracted_sse_callid>" } },
        ]
      }
    },
    "size": 10000,
    "sort": [ { "@timestamp": { "order": "asc" } } ]
  }
}
```

**4. Output:**
Save the entire JSON response from both indexes to agent state.
Display: "Found X WxCAS logs. Preparing comprehensive analysis..."

**5. Important:**
- Use exact term match for callId.keyword (not wildcard)
- Sort by timestamp ascending for chronological analysis
- If no Call-ID was extracted, return empty results gracefully
""",
    tools=[
        MCPToolset(
            connection_params=StdioConnectionParams(
                timeout=1000.0,
                server_params=StdioServerParameters(
                    command=UV_PATH,
                    args=[
                        "--directory",
                        "/Users/pkesari/Desktop/WorkProjects/microservice-log-analyzer/opensearch-mcp-server-py",
                        "run",
                        "--",
                        "python",
                        "-m",
                        "mcp_server_opensearch",
                    ],
                    env={
                        "OPENSEARCH_OAUTH_TOKEN": "ZTViYjE2ZTMtNGE0OS00YzJhLThiMTItYWY4YTA2NDIyOTJmNmNkNjE5N2UtZmEz_PF84_6078fba4-49d9-4291-9f7b-80116aab6974",
                        "OPENSEARCH_OAUTH_NAME": "MicroserviceLogAnalyzer",
                        "OPENSEARCH_OAUTH_PASSWORD": "QBLP.qsxh.16.VIKL.cdwz.38.CZKP.rtwm.3467",
                        "OPENSEARCH_OAUTH_CLIENT_ID": "C652d21a85854402b5bd7b2207ef96575e47bbb5c168008eeaba51ec7d8e37e93",
                        "OPENSEARCH_OAUTH_CLIENT_SECRET": "84ec522d2e99bdf8ac2386c44210f1e921f7cab0f65db734f27798ea43545788",
                        "OPENSEARCH_OAUTH_SCOPE": "lma-logging:serviceowners_read lma-logging:wxcalling_read",
                        "OPENSEARCH_OAUTH_BEARER_TOKEN_URL": "https://idbroker.webex.com/idb/token/6078fba4-49d9-4291-9f7b-80116aab6974/v2/actions/GetBearerToken/invoke",
                        "OPENSEARCH_OAUTH_TOKEN_URL": "https://idbroker.webex.com/idb/oauth2/v1/access_token",
                    },
                ),
            ),
            tool_filter=["SearchIndexTool"],
        ),
    ],
)

# Main Search Agent - Sequential Coordinator
search_agent = SequentialAgent(
    name="search_agent",
    sub_agents=[wxm_search_agent, session_extractor_agent, wxcalling_search_agent, sse_callid_extractor_agent, wxcas_search_agent],
    description="Executes a sequence of log searching: Mobius logs → Session extraction → SSE/MSE logs → SSE Call-ID extraction → WxCAS logs",
)
