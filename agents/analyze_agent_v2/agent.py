"""
Analyze Agent v2 — Analysis agent designed for search_agent_v2 output.

Consumes the state keys set by ExhaustiveSearchAgent:
  - mobius_logs     (JSON string: list of _source dicts)
  - sse_mse_logs    (JSON string: list of _source dicts)
  - wxcas_logs      (JSON string: list of _source dicts)
  - search_summary  (JSON string: {total_mobius_logs, total_sse_mse_logs,
                      total_wxcas_logs, max_depth_reached, total_ids_searched,
                      search_history})

Routes to calling_agent or contact_center_agent based on serviceIndicator.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.skills import load_skill_from_dir
from google.adk.tools import skill_toolset

# ═══════════════════════════════════════════════════════════════════════════════
# Setup
# ═══════════════════════════════════════════════════════════════════════════════

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


def _make_model() -> LiteLlm:
    return LiteLlm(
        model="openai/gpt-4.1",
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_base=os.environ["AZURE_OPENAI_ENDPOINT"],
        extra_headers={"x-cisco-app": "microservice-log-analyzer"},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Shared instruction fragments
# ═══════════════════════════════════════════════════════════════════════════════

_SEARCH_CONTEXT_PREAMBLE = """
**Search Context (from exhaustive BFS search):**
The logs below were collected by an exhaustive graph-traversal search agent that:
- Started from user-provided identifiers and searched OpenSearch indexes
- Extracted ALL related IDs (session IDs, call IDs, tracking IDs, etc.)
- Recursively searched for those IDs across multiple indexes and services
- Ran searches in parallel for speed

Search summary: {search_summary}

This means you may have logs spanning MULTIPLE call legs, forwarded sessions,
retries, or related interactions that a single-ID search would have missed.
Use the search_summary to understand the scope: how many IDs were searched,
what depth the BFS reached, and what indexes were queried.

**IMPORTANT: You must analyze EVERY log entry. Do NOT skip or summarize groups of logs.
Read each log line, extract its meaning, and incorporate it into the analysis.
If there are hundreds of logs, produce a correspondingly detailed analysis.**
"""

_ANALYSIS_POINTS = """
**Be THOROUGH and EXHAUSTIVE in your analysis. This is critical debugging information.**

Your analysis MUST cover ALL of the following in full detail:

1. **Complete HTTP request/response communication** (list EVERY request you find)
    - Capture EVERY HTTP request and response pair chronologically
    - For each: exact timestamp, source → destination, method, full path, status code
    - Include relevant headers (Content-Type, Authorization scheme, X-headers)
    - Note payload details when available (body size, key fields)
    - Print ALL relevant IDs: device ID, user ID, call ID, meeting ID, tracking ID, session ID, correlation ID
    - Flag any non-2xx responses with emphasis
    - Note request duration / latency if available

2. **End-to-end SIP Communication** (reconstruct the FULL SIP dialog)
    - Map the COMPLETE SIP message flow: every INVITE, 100 Trying, 180 Ringing, 183 Session Progress, 200 OK, ACK, UPDATE, re-INVITE, BYE, CANCEL, PRACK
    - For each SIP message: timestamp, source → destination, method/response code, Call-ID, CSeq, branch
    - Extract SDP details: media lines (m=), codec (a=rtpmap), ICE candidates, DTLS fingerprint
    - Track SIP dialog state transitions
    - Correlate SIP Call-IDs across Mobius (wxm-app logs) and SSE/MSE (wxcalling logs) — these are the SAME call seen from different services
    - Note any SIP error responses (4xx, 5xx, 6xx) with reason phrases
    - Identify retransmissions, timeouts, or missing ACKs

3. **Media Path Analysis** (if media-related logs are present)
    - ICE candidate gathering and connectivity checks
    - DTLS-SRTP handshake status
    - RTP/RTCP flow establishment
    - Media quality indicators if available (jitter, packet loss, MOS)
    - TURN/STUN server interactions

4. **Timing Analysis**
    - Calculate time deltas between key events (e.g., INVITE to 200 OK = call setup time)
    - Identify any unusual delays (>2s between expected sequential events)
    - Note the total call duration if BYE is present
    - Flag any timeouts

5. **Error Detection and Root Cause Analysis** (be SPECIFIC and ACTIONABLE)
    - Identify EVERY error event, warning, or anomaly in the logs
    - For each error:
        - Exact timestamp and source service
        - Error code / HTTP status / SIP response code
        - Full error message text
        - What was happening when the error occurred (context)
        - Root cause analysis: WHY did this happen?
        - Step-by-step fix / remediation
        - Escalation path if not self-serviceable
    - Look for subtle issues: retries, fallbacks, degraded paths that succeeded but indicate problems

6. **Cross-Service Correlation**
    - Since logs come from multiple services (Mobius, SSE, MSE, WxCAS), explicitly correlate events across services using shared IDs
    - Identify any gaps: e.g., Mobius sent INVITE but no corresponding log from SSE = potential routing issue
    - Track the same transaction across service boundaries
"""

_OUTPUT_STRUCTURE = """
**Output structure (follow this EXACTLY):**

---
### 🔍 Extracted Identifiers
List ALL unique identifiers found across all log sources:
- **User ID**:
- **Device ID**:
- **Tracking ID**: (print baseTrackingID_* to represent multiple suffixes. Don't print all suffixes)
- **Call ID** (Mobius):
- **Call ID** (SSE/SIP):
- **Session ID (local)**:
- **Session ID (remote)**:
- **Meeting ID** (if any):
- **Trace ID** (if any):

---
### 📊 Search Scope
- **IDs searched**: (from search_summary.total_ids_searched)
- **BFS depth reached**: (from search_summary.max_depth_reached)
- **Indexes queried**: (list unique indexes from search_summary.search_history)
- **Total logs analyzed**: Mobius: X, SSE/MSE: Y, WxCAS: Z

---
### 📡 HTTP Communication Flow
List ALL HTTP requests and responses in strict chronological order.
Each entry should be ONE concise line with the format:

→ **[Timestamp]** Source → Destination: METHOD /path - StatusCode (Brief description)

Example:
→ **[2026-02-13T10:00:00Z]** Client → Mobius: POST /v1/calling/web/devices/.../call - 200 OK (Call initiation)
→ **[2026-02-13T10:00:01Z]** Mobius → CPAPI: GET /features - 200 OK (Feature retrieval)

**Do NOT skip any HTTP interactions.** If there are 50 requests, list all 50.

---
### 📞 SIP Communication Flow
List ALL SIP messages in strict chronological order.
Keep Mobius, SSE, MSE, and WxCAS as separate participants.

→ **[Timestamp]** Source → Destination: SIP Method/Response - Call-ID: xxx - Description
→ **[Timestamp]** Mobius → SSE: SIP INVITE - Call-ID: SSE0520... - Initial call setup
→ **[Timestamp]** SSE → Mobius: 100 Trying - Call-ID: SSE0520... - Call being processed
→ **[Timestamp]** SSE → WxCAS: INVITE - Call-ID: SSE0520... - Routing to app server
→ **[Timestamp]** WxCAS → SSE: 200 OK - Call-ID: SSE0520... - Call accepted
→ **[Timestamp]** SSE → Mobius: 200 OK - Call-ID: SSE0520... - Final response

Include SDP summary when available (codec, media type, ICE candidates count).
**Do NOT skip any SIP messages.** Reconstruct the COMPLETE dialog.

---
### 🔗 Cross-Service Correlation
Map how the same transaction flows across services:
- Tracking ID X in Mobius → corresponds to Call-ID Y in SSE → routed via WxCAS as Z
- Note any missing correlations or gaps in the flow

---
### ⏱️ Timing Analysis
- **Call setup time**: (INVITE to 200 OK)
- **Total duration**: (first log to last log, or INVITE to BYE)
- **Notable delays**: List any gaps > 2 seconds between expected sequential events
- **Retries/Retransmissions**: Count and note if any

---
### ✅ Final Outcome
Provide a comprehensive summary of the entire flow:
- What type of call was this? (WebRTC-to-WebRTC, WebRTC-to-PSTN, etc.)
- Did the call succeed or fail?
- Complete signaling path taken
- Media path established (or not)
- Any degradation or issues even if the call succeeded

---
### ❗ Root Cause Analysis
(Only if errors/issues were found. Be DETAILED and SPECIFIC.)

For EACH issue found:
→ **[Timestamp]**: ErrorType (ErrorCode)
→ **Service**: Which service generated the error
→ **Context**: What was happening when this error occurred
→ **Description**: Detailed explanation of what went wrong
→ **Potential Root Causes**: List all possible causes, ranked by likelihood
→ **Suggested Fix**: Clear, actionable steps to resolve
→ **Impact**: How did this error affect the call/session?
→ **Notes**: Documentation references, escalation contacts, related issues

---
"""


# ═══════════════════════════════════════════════════════════════════════════════
# Mobius Error ID Skill (for calling_agent)
# ═══════════════════════════════════════════════════════════════════════════════

mobius_error_skill = load_skill_from_dir(
    Path(__file__).parent / "skills" / "mobius_error_id_skill"
)
mobius_skill_toolset = skill_toolset.SkillToolset(skills=[mobius_error_skill])

architecture_endpoints_skill = load_skill_from_dir(
    Path(__file__).parent / "skills" / "architecture_endpoints_skill"
)
architecture_skill_toolset = skill_toolset.SkillToolset(skills=[architecture_endpoints_skill])


# ═══════════════════════════════════════════════════════════════════════════════
# Sub-agent: WebRTC Calling flow
# ═══════════════════════════════════════════════════════════════════════════════

calling_agent = LlmAgent(
    model=_make_model(),
    name="calling_agent",
    output_key="analyze_results",
    tools=[mobius_skill_toolset, architecture_skill_toolset],
    instruction=f"""You are a senior VoIP/WebRTC debugging expert with deep expertise in HTTP, WebRTC, SIP, SDP, RTP, SRTP, DTLS, ICE, TCP, UDP, TLS, and related protocols. You produce EXHAUSTIVE, production-grade debug analyses that leave no log entry unexamined.

{_SEARCH_CONTEXT_PREAMBLE}

Use the **architecture_endpoints_skill** for service roles, signaling/media paths, and WebRTC Calling architecture (see references/architecture_and_endpoints.md — endpoints and WebRTC Calling sections).

**Log Sources — Analyze ALL of them thoroughly:**
1. **Mobius logs** from {{{{mobius_logs}}}} (logstash-wxm-app indexes) — HTTP/WebSocket signaling, SIP translation, device registration
2. **SSE/MSE logs** from {{{{sse_mse_logs}}}} (logstash-wxcalling indexes) — SIP edge signaling, media relay
3. **WxCAS logs** from {{{{wxcas_logs}}}} (logstash-wxcalling indexes) — Call routing, destination resolution, application server logic

**Cross-source correlation is CRITICAL:**
- The SAME call appears in multiple log sources with different perspectives
- Correlate using shared IDs: Call-ID, Session ID, Tracking ID
- Mobius logs show the browser↔server HTTP side
- SSE logs show the SIP signaling side of the same events
- WxCAS logs show routing decisions
- Present a UNIFIED view that stitches together all perspectives

Because the search was exhaustive (BFS), you may see logs from MULTIPLE call legs,
forwarded sessions, or related interactions. Identify and correlate ALL of them.
If there are multiple calls (e.g., call forwarding, transfer), analyze each leg separately
then show how they connect.

{_ANALYSIS_POINTS}

{_OUTPUT_STRUCTURE}
""",
)


# ═══════════════════════════════════════════════════════════════════════════════
# Sub-agent: Contact Center flow
# ═══════════════════════════════════════════════════════════════════════════════

contact_center_agent = LlmAgent(
    model=_make_model(),
    name="contact_center_agent",
    output_key="analyze_results",
    tools=[architecture_skill_toolset],
    instruction=f"""You are a senior VoIP/Contact Center debugging expert with deep expertise in HTTP, WebRTC, SIP, SDP, RTP, SRTP, DTLS, ICE, TCP, UDP, TLS, and related protocols. You produce EXHAUSTIVE, production-grade debug analyses that leave no log entry unexamined.

{_SEARCH_CONTEXT_PREAMBLE}

Use the **architecture_endpoints_skill** for service roles and Contact Center architecture (see references/architecture_and_endpoints.md — endpoints and Contact Center sections).

**Log Sources — Analyze ALL of them thoroughly:**
1. **Mobius logs** from {{{{mobius_logs}}}} (logstash-wxm-app indexes) — HTTP/WebSocket signaling, SIP translation
2. **SSE/MSE logs** from {{{{sse_mse_logs}}}} (logstash-wxcalling indexes) — SIP edge signaling, media relay
3. **WxCAS logs** from {{{{wxcas_logs}}}} (logstash-wxcalling indexes) — Call routing logic

**Cross-source correlation is CRITICAL:**
- The SAME call appears in multiple log sources with different perspectives
- Correlate using shared IDs: Call-ID, Session ID, Tracking ID
- Present a UNIFIED view that stitches together all perspectives

Because the search was exhaustive (BFS), you may see logs from MULTIPLE call legs,
forwarded sessions, or related interactions. Identify and correlate ALL of them.

{_ANALYSIS_POINTS}

{_OUTPUT_STRUCTURE}
""",
)


# ═══════════════════════════════════════════════════════════════════════════════
# Coordinator: Routes to calling or contact center based on serviceIndicator
# ═══════════════════════════════════════════════════════════════════════════════

analyze_agent = LlmAgent(
    name="analyze_agent_v2",
    output_key="analyze_results",
    model=_make_model(),
    instruction="""
Context: You are analyzing logs from a WebRTC Calling or contact center flow,
which involves talking to different endpoints using protocols like HTTP, SIP,
WebRTC, SDP, RTP, TLS.

You have access to the full search results from an exhaustive BFS search:
- Search summary: {search_summary}
- Mobius logs: {mobius_logs}
- SSE/MSE logs: {sse_mse_logs}
- WxCAS logs: {wxcas_logs}

Use `serviceIndicator` from logs to classify the session:
- `calling`, `guestCalling` → WebRTC Calling Flow, transfer to `calling_agent`
- `contactCenter` → Contact Center Flow, transfer to `contact_center_agent`

If no `serviceIndicator` is found, default to `calling_agent`.
""",
    description="Routes analysis to Calling or ContactCenter agent based on serviceIndicator in logs.",
    sub_agents=[calling_agent, contact_center_agent],
)
