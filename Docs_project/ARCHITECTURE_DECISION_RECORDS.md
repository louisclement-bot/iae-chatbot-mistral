# Architecture Decision Records – IAE Chatbot Multi-Agent Refactor  
*Folder: `Docs_project/` – File: `ARCHITECTURE_DECISION_RECORDS.md`*  
*Maintainer : Platform Team @ IAE Lyon 3 – Last updated : 2025-06-27*

Each ADR captures a **single** key decision.  
Status values: **Proposed • Accepted • Deprecated • Superseded**.

---

## ADR-001 Use Mistral **Conversations API** instead of `/agents/completions`  
*Status: **Accepted***

### Context  
The legacy code calls the deprecated `/agents/completions` endpoint which returns a one-shot completion and prevents streaming, stateful history, or handoffs.

### Decision  
Adopt the **Conversations API** (`/v1/conversations`) and its helpers (`start`, `append`, `restart`, `*Stream`).  
Persist `conversation_id` in global store.

### Consequences  
+ Enables streaming, server-side handoffs, better usage stats.  
+ Future-proof (official roadmap).  
– Requires new services layer and refactor of all fetch logic.

---

## ADR-002 Delegate Workflow to **Server-Side Handoffs**  
*Status: **Accepted***

### Context  
Original `executeWorkflow()` branches in JS to call agents sequentially.  
Mistral now supports `handoffs` arrays letting one agent invoke the next in-cloud.

### Decision  
Configure handoffs:

```
Doc-Library  →  Websearch
Websearch    →  Doc-Q&A
```

Client simply opens a stream and reacts to `agent.handoff.*` events.

### Consequences  
+ Removes ~100 LOC of brittle branching.  
+ Lower latency (single round-trip).  
– Mis-configuration could cause loops; unit tests required.

---

## ADR-003 Enable **Streaming (SSE)** by Default  
*Status: **Accepted***

### Context  
Polling waits for full response → slow UX. Conversations API offers SSE events with deltas and tool events.

### Decision  
All conversation calls will use `startStream` / `appendStream` with  
`Accept: text/event-stream`.  
Implement `eventStreamHandler` to parse events.

### Consequences  
+ Real-time typing & progress indicators.  
+ Lower perceived latency.  
– Extra client complexity; fallback to non-stream if SSE blocked.

---

## ADR-004 Adopt **Zustand** for Global State  
*Status: **Accepted***

### Context  
Scattered `useState` causes prop drilling and re-renders. Alternatives: Redux Toolkit, Context + useReducer, Zustand.

### Decision  
Use **Zustand** (with Immer) for:

* `chatSlice` – messages, loading, conversationId  
* `workflowSlice` – step statuses  
* `agentSlice` – cached agent metadata  

Persist to `sessionStorage`.

### Consequences  
+ Minimal boilerplate, selective subscriptions, devtools plugin.  
– New dependency (~2 kB); onboarding for team.

---

## ADR-005 Convert Codebase to **TypeScript (strict)**  
*Status: **Accepted***

### Context  
JavaScript limits static safety; integration with complex APIs is error-prone.

### Decision  
Migrate to TypeScript 5 with `strict: true`, `noUncheckedIndexedAccess`, path aliases (`@/`).

### Consequences  
+ Compile-time contract with Mistral payloads.  
+ IDE autocompletion & refactor safety.  
– Initial effort converting legacy JS; CI build time ↑.

---

## ADR-006 Presentational / Container Component Split  
*Status: **Accepted***

### Context  
UI, business logic and network calls reside in one React component.

### Decision  
Introduce:

* `components/` → dumb, style-only React components  
* `features/chat/` → smart container (hooks, state, services)

Storybook documents each presentational component.

### Consequences  
+ Reusable UI, easier testing, clearer ownership.  
– More files; developers must follow pattern discipline.

---

## ADR-007 Implement **fetchWithRetry + AbortController** for Resilience  
*Status: **Accepted***

### Context  
Network failures currently surface raw errors or hang indefinitely.

### Decision  
Create `utils/fetchWithRetry`:

* 3 retries for network/5xx (0.5 s, 1.5 s, 3 s)  
* Honour `Retry-After` for 429  
* Abort request after 20 s by default

Wrap all Mistral calls with this helper.

### Consequences  
+ Robust UX; transient failures hidden from user.  
+ Single source of truth for retry policy.  
– Slight code overhead; must ensure idempotency for retries.

---

### ☑️ Review Checklist for New PRs  
* Does the change conflict with any **Accepted** ADR?  
* If altering architecture, add a new ADR or supersede an old one.  
* Reference ADR IDs in pull-request description.

---  
End of ADR file.  
