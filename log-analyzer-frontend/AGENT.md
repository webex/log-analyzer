# Log Analyzer Frontend — AI context for the UI

Use this file when working in the `log-analyzer-frontend/` folder. It describes structure, conventions, and how the UI talks to the agents.

---

## Purpose

Next.js app that provides the **UI for the microservice log analyzer**: search form, session management with the ADK backend, and results (analysis, raw logs, sequence diagram). It targets Webex microservice log analysis (Mobius, SSE, MSE, WxCAS, etc.).

---

## Stack

- **Framework**: Next.js 14 (App Router).
- **Language**: TypeScript.
- **Styling**: Tailwind CSS.
- **UI primitives**: Radix UI (shadcn-style components under `components/ui/`).
- **Diagram rendering**: Mermaid (for sequence diagram from agent output).
- **PWA**: `@ducanh2912/next-pwa`; offline fallback page at `app/offline/page.tsx`.
- **Package manager**: pnpm.

---

## Folder layout

```
log-analyzer-frontend/
├── AGENT.md                 # This file
├── app/
│   ├── page.tsx             # Main page: SearchForm + ResultsTabs, session + event handling
│   ├── layout.tsx           # Root layout (if present)
│   └── offline/
│       └── page.tsx         # PWA offline fallback
├── components/
│   ├── search-form.tsx      # Search params: field, value, time, services, region, env, LLM
│   ├── results-tabs.tsx    # Tabs: Analysis | Raw Logs | Charts
│   ├── analysis-view.tsx   # Renders markdown analysis
│   ├── logs-view.tsx       # Raw log list/cards
│   ├── charts-view.tsx     # Renders PlantUML/Mermaid diagram (mermaidCode)
│   ├── log-card.tsx        # Single log card
│   ├── log-detail-modal.tsx
│   ├── connection-status.tsx
│   ├── setup-instructions.tsx
│   └── ui/                 # Radix-based primitives (button, card, tabs, dialog, etc.)
├── lib/
│   └── session-manager.ts  # ADK session + sendQuery (appName: root_agent)
├── public/                 # PWA assets (sw.js, workbox, offline fallback)
├── next.config.mjs         # Next config + PWA (withPWA)
└── package.json
```

---

## Data flow

1. **Session**: `SessionManager` creates a session via `POST .../apps/root_agent/users/{userId}/sessions/{sessionId}`. `NEXT_PUBLIC_ADK_API_URL` defaults to `http://127.0.0.1:8000`.
2. **Search**: User submits the form → `handleSearch(searchParams)` → `sessionManager.sendQuery(searchParams)` → POST `${ADK_API_URL}/run` with body: `{ appName: "root_agent", userId, sessionId, newMessage: { role: "user", parts: [{ text: JSON.stringify(searchParams) }] } }`.
3. **Response**: API returns a list of **events**. Each event has `author` and `content.parts`.
4. **Parsing** (in `app/page.tsx`):
   - **Logs**: Events whose `author` is `wxm_search_agent`, `wxcalling_search_agent`, or `wxcas_search_agent`; from `parts[].functionResponse.response.content[0].text` parse JSON and collect `hits.hits`.
   - **Analysis**: First event with `author === "calling_agent"` or `author === "contact_center_agent"`; analysis text from `parts[0].text`.
   - **Diagram**: First event with `author === "sequence_diagram_agent"`; diagram code from `parts[0].text` (stored as `mermaidCode`, rendered in Charts tab).
5. **UI state**: `results` (logs array), `analysis` (string), `mermaidCode` (string). Results area shows `ResultsTabs` only when `analysis !== ""`.

---

## Conventions

- **Env**: Backend URL via `NEXT_PUBLIC_ADK_API_URL` (default `http://127.0.0.1:8000`). PWA/export use `NEXT_PUBLIC_EXPORT` and `NEXT_PUBLIC_BASE_PATH` in `next.config.mjs`.
- **Imports**: Use `@/` for app and components (e.g. `@/components/search-form`, `@/lib/session-manager`).
- **Client components**: Main pages and forms use `"use client"`; keep data fetching and event handling in the client.
- **Agent names**: Frontend logic depends on `author` values. Changing agent names in the backend requires updating `app/page.tsx` (and any other place that switches on `author`).

---

## Search form (search-form.tsx)

- **Fields**: Search field (e.g. `fields.WEBEX_TRACKINGID.keyword`, `fields.mobiusCallId.keyword`, `message`, etc.), time filter, services (Mobius, WDM, Locus, …), region (US/EU), environment (prod/int), LLM choice.
- **Submit**: Calls `onSearch(params)` with an object that is stringified and sent as the user message to the agent pipeline.

---

## Key files to touch when…

- **Changing how run results are parsed**: `app/page.tsx` (event loop, `author` checks, extraction of logs/analysis/mermaidCode).
- **Changing search options or form fields**: `components/search-form.tsx`.
- **Changing layout of results (tabs, views)**: `components/results-tabs.tsx`, `analysis-view.tsx`, `logs-view.tsx`, `charts-view.tsx`.
- **Changing backend URL or session/run API**: `lib/session-manager.ts`.
- **Adding UI components**: Prefer `components/ui/` for primitives; keep feature components in `components/`.

---

## Backend (agents) contract

- **App name**: Session and run use `root_agent`. The actual pipeline may be `root_agent_v2` on the server; the frontend only cares that the same app is used for session and run.
- **User message**: Single user part with `text: JSON.stringify(searchParams)`. Agents must expect this JSON (field, value, time filter, services, region, env, etc.).
- **Events**: Frontend expects events with recognizable `author` values and `content.parts` containing either `text` or `functionResponse` (for search tool results). Keep these stable or update the frontend parsing accordingly.

For agent-side context and pipeline details, see the repository’s **`agents/AGENT.md`**.
