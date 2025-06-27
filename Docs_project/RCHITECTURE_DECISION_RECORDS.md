# Architecture Decision Records – IAE Chatbot Refactor

This document captures the key decisions that guide the multi-agent refactor.  
Each ADR is self-contained and versioned for future reference.

---

## ADR-001  Handoffs vs Manual Workflow
*Status: **Accepted***

### Context  
The current code embeds a manual `executeWorkflow()` with `if/else` branches to call agents in sequence. Mistral AI now provides a native **handoffs** mechanism that chains agents server-side and emits `agent.handoff.*` events.

### Decision  
Adopt **server-side handoffs**:  
* Document-Library → handoff → Websearch  
* Websearch → handoff → Document-Q&A  
Client logic becomes event-driven; manual branching is removed.

### Consequences  
+ Simplifies client code, fewer error paths  
+ Gains built-in retries, reduces latency (single cloud round-trip)  
– Less fine-grained client control (must trust agent prompts)  
– Mis-configured handoffs can cause loops; requires unit tests on agent configs

---

## ADR-002  Conversations API vs Completions API
*Status: **Accepted***

### Context  
Legacy code calls `/agents/completions`. The new **Conversations API** (`/v1/conversations`) supports stateful history, streaming and tool events.

### Decision  
Migrate to **Conversations API** with `start`, `append`, `restart`, and `*Stream` variants. Persist `conversation_id` in the store.

### Consequences  
+ Enables streaming, handoffs, rich usage stats  
+ Aligns with official roadmap; future features automatically available  
– Requires re-writing networking layer and tests

---

## ADR-003  Streaming vs Polling
*Status: **Accepted***

### Context  
Polling waits for an entire response, delaying UX feedback. The Conversations API offers Server-Sent Events / stream endpoint with deltas and tool events.

### Decision  
Implement **streaming** by default. Fallback to non-stream for environments that block SSE (detected via timeout).

### Consequences  
+ Real-time typing indicator and progress lights  
+ Lower perceived latency  
– Extra client complexity (chunk assembly, backpressure)  
– Corporate proxies may block SSE → need graceful degrade

---

## ADR-004  State Management (Zustand vs Context)
*Status: **Accepted***

### Context  
Scattered `useState` causes prop-drilling and re-renders. We evaluated React Context + useReducer and **Zustand**.

### Decision  
Use **Zustand** for global chat state (messages, workflowSteps, loading, agentsCache). Context remains for theme and i18n.

### Consequences  
+ Minimal boilerplate, devtools integration  
+ Fine-grained selectors avoid needless renders  
– Extra dependency (~2 kB)  
– Team familiarity required (training notes added)

---

## ADR-005  TypeScript Migration
*Status: **Accepted***

### Context  
JavaScript limits IDE support and static safety. We plan a long-lived codebase with complex APIs.

### Decision  
Convert to **TypeScript** (strict mode). JS files temporarily co-exist; `.d.ts` shims added to unblock early phases.

### Consequences  
+ Compile-time checks on Mistral payloads  
+ Better developer experience and refactor safety  
– Initial learning curve; CI build time slightly higher

---

## ADR-006  Testing Strategy
*Status: **Accepted***

### Context  
No meaningful tests exist. Refactor risk is high.

### Decision  
Adopt **multi-layer testing**:  
1. Jest for utilities & services (MSW for API mocks)  
2. React Testing Library for components  
3. Cypress for E2E workflows  
4. 90 % statement coverage gate in CI

### Consequences  
+ Confidence during aggressive refactor  
+ Detect regressions quickly  
– Additional maintenance cost; CI runtime longer

---

## ADR-007  Component Architecture
*Status: **Accepted***

### Context  
UI and business logic are intertwined in one component.

### Decision  
Follow **Presentational / Container** split:  
* `components/` – dumb, style-focused  
* `features/chat/` – smart container hooks & state  
Tailwind with `@apply`; Storybook docs added later.

### Consequences  
+ Clear separation, reusable UI pieces  
+ Storybook aids design system consistency  
– More files; newcomers must learn pattern

---
