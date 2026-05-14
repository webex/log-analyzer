---
name: mobius-error-id-skill
description: "Decode Mobius error codes (mobius-error 101–5xx), trace call IDs, and map HTTP response statuses to root causes in Mobius logs. Use when analyzing Mobius log output containing error codes, response_status fields, call IDs, or registration/call failures and the user needs help debugging or understanding them."
---

# Mobius Error ID Lookup

When analyzing Mobius logs, use this skill to decode error codes, trace call IDs to root causes, and map error patterns to known issues.

## Error ID Formats

Mobius errors appear in logs as:
- **HTTP status + mobius-error code**: `403 FORBIDDEN — mobius-error 101` (registration), `503 SERVICE UNAVAILABLE` (transient backend failure)
- **response_status fields**: `fields.response_status: 503`, `fields.response_status: 404`
- **Call/device IDs**: `deviceId`, `sipCallId`, `USER_ID`, `DEVICE_ID` — used to correlate across services

## Workflow

1. **Extract error identifiers** from the logs — look for `mobius-error` codes, HTTP status codes in `response_status` fields, and call/device IDs (`deviceId`, `sipCallId`, `correlationId`).

2. **Look up each error** in `references/mobius_error_ids.md`. For each match, note the meaning, user/call impact, root cause direction, and what to check next.

3. **Include findings in your analysis**: For each error ID, state what it means, the likely cause, the affected dependency (SSE, CPAPI, Redis, CI), and suggested next steps.

4. **If an ID is not in the reference**, say so and describe the ID, surrounding context, and log fields so a human can triage or update the documentation.

## Example

A log line shows `Registration: Error code: 503 SERVICE UNAVAILABLE` with message `"No more retries left, failed to setup connection with all remote hosts"`. Look up **503 SERVICE UNAVAILABLE (registration)** in the reference — this means Mobius tried all SSE nodes and failed to connect. Root cause: SSE cluster or network issue. Next step: check SSE health and network path in the same time window.
