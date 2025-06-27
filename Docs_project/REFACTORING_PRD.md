# Refactoring PRD – IAE Chatbot (Multi-Agent Mistral AI)

*Document ID: PRD-IAE-REF‐001*  
*Version: 1.0 • 2025-06-27*  
*Owners: Platform Team @ IAE Lyon 3*  

---

## 1 – Purpose & Goals  

The existing “iae-chatbot-mistral” React app is a successful proof-of-concept but remains **monolithic** (850 LOC in `App.js`).  
This refactor will convert it into a **modular, production-grade application** that:

1. Uses **three specialised Mistral agents**  
   – Document-Library → Websearch → Document-Q&A.  
2. Leverages **server-side handoffs** to chain agents (no manual JS branching).  
3. Migrates from the deprecated `/agents/completions` endpoint to the **Conversations API** with full **streaming (SSE)** support.  
4. Achieves maintainability, testability and security targets defined below.

---

## 2 – Current State Analysis  

| Area | Observation |
|------|-------------|
| **Structure** | CRA, all logic in one component (`App.js`). |
| **Agents** | Re-created on first render; IDs not persisted. |
| **API** | Calls `/agents/completions` synchronously, no streaming. |
| **Workflow** | Manual `if/else` orchestration for library → web → PDF. |
| **State** | 12 `useState` vars; prop drilling; no global store. |
| **Error Handling** | Ad-hoc `try/catch`, no retries or abort logic. |
| **Testing** | CRA defaults only. |
| **Security** | API key exposed in frontend bundle (dev). |
| **Performance** | 300 kB JS bundle; no code-splitting. |

---

## 3 – Target Architecture  

### 3.1 High-Level Diagram  

```
User ──► ChatPage (container)
           │
           │ stream (SSE)
           ▼
  eventStreamHandler ──► Zustand Stores ──► Presentational Components
           │
           │ start / append / restart
           ▼
  conversationService  ── HTTP ──► Mistral Conversations API
```

### 3.2 Agents & Handoffs  

| Agent | Tools | Handoffs |
|-------|-------|----------|
| **Doc-Library** | `document_library` (`0685d6e8…`) | `websearchAgentId` |
| **Websearch** | `web_search` | `docQaAgentId` |
| **Doc-Q&A** | `document_qna` (OCR) | — |

Server‐side handoffs emit `agent.handoff.*` events which drive the UI step indicator.

### 3.3 Folder Structure (target)

```
src/
 ├─ components/            # Presentational
 ├─ features/chat/         # Smart container + hooks
 ├─ services/
 │   ├─ mistral/           # agentService, conversationService, types
 │   └─ streams/           # eventStreamHandler
 ├─ stores/                # Zustand slices
 ├─ utils/                 # fetchWithRetry, pdfDetection
 ├─ config/agents.ts       # Persistent agent IDs & prompts
 └─ index.tsx
Docs_project/              # Full documentation suite
```

---

## 4 – Implementation Phases  

| # | Phase | Goal | Key Deliverables |
|---|-------|------|------------------|
| 0 | **Baseline tests** | Freeze behaviour | Cypress happy-path, snapshots |
| 1 | **Scaffold & TS** | Folder tree, tsconfig, ESLint, Prettier | Empty stubs, CI lint |
| 2 | **Services layer** | `agentService`, `conversationService`, `fetchWithRetry` | Unit tests with MSW |
| 3 | **Handoffs & Streaming** | Configure agent `handoffs`; implement SSE parser | Visual workflow lights |
| 4 | **(Optional) Workflow Engine** | Client override FSM if needed | Integration tests |
| 5 | **UI Refactor** | Split into presentational components | Storybook entries |
| 6 | **Global Store** | Zustand slices + persistence | Replace scattered `useState` |
| 7 | **Legacy Removal** | Switch ChatPage, delete old `App.js` | All tests green |
| 8 | **Hardening** | AbortController, retries, ErrorBoundary, perf | Lighthouse ≥90 |
| 9 | **QA & Docs** | Full regression, a11y, README update | Release tag `v1.0-refactor` |

---

## 5 – Technical Specifications  

| Topic | Requirement |
|-------|-------------|
| **Language** | TypeScript 5, `strict` true |
| **React** | 19 functional components |
| **Styling** | Tailwind 3 + `@tailwindcss/typography`; dark-mode variants |
| **API** | Conversations endpoints `/v1/conversations*` with SSE |
| **Networking** | Native `fetch`; retries 0.5 s → 1.5 s → 3 s; 20 s timeout |
| **State** | Zustand + Immer; sessionStorage persistence |
| **Streaming** | `conversation.startStream` / `appendStream`; parse `conversation.response.*`, `agent.handoff.*`, `message.output.delta` |
| **Security** | No API key in production bundle; backend proxy or env override |
| **Testing** | Jest, React Testing Library, MSW, Cypress; coverage ≥90 % |
| **Performance** | JS initial bundle ≤300 kB; FCP ≤1.8 s; CLS <0.1 |
| **Accessibility** | WCAG 2.1 AA; axe checks in CI |

---

## 6 – Testing Strategy  

Layer | Tooling | Coverage & Focus
----- | ------- | ---------------
Utilities & services | Jest + MSW | 95 % lines; retry logic, SSE parser
Components | RTL | Rendering, a11y, loading states
Integration | RTL + MSW | Chat flow, handoff events
E2E | Cypress | Baseline & regression; streaming visual
Accessibility | cypress-axe | No critical violations
Performance | Lighthouse CI | Budgets enforced in Phase 8

---

## 7 – Acceptance Criteria  

1. Legacy chat flows still pass (baseline tests green).  
2. Streaming responses appear with <300 ms delay; workflow dots driven by SSE events.  
3. Handoff path displayed (`Document Library → Websearch → Document Q&A`) when applicable.  
4. `src/App.js` ≤ 200 LOC *or* removed.  
5. Lighthouse: Performance ≥90, Accessibility ≥95, Best Practices ≥90.  
6. Jest coverage ≥90 % statements.  
7. Adding a new agent requires ≤10 LOC change in `config/agents.ts`.  
8. ErrorBoundary presents friendly fallback, chat history preserved on refresh.  
9. CI passes: lint, tests, audit, a11y, performance.

---

## 8 – Risks & Mitigations  

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Mis-configured handoffs causes loop | Medium | Unit tests on agent configs; circuit-breaker in SSE parser |
| SSE blocked by corporate proxy | Low | Fallback to non-stream completions |
| Large refactor diff complicates review | Medium | Phase-wise PRs, feature flags |
| API rate limits during CI | High | Mock network with MSW; throttle live calls |
| Exposing API key | High | Proxy backend; `.env` only in dev; CI check |
| Regression in complex UI behaviours | Medium | Snapshot + E2E baseline before refactor |

---

## 9 – Timeline (Indicative, 5 weeks)  

| Week | Milestones |
|------|------------|
| 1 | Phase 0-1 complete; folder scaffold merged |
| 2 | Phase 2 (services) merged, unit tests green |
| 3 | Phase 3 (handoffs + streaming) merged, live SSE demo |
| 4 | Phase 4-6 (UI refactor & store) merged; legacy code removed |
| 5 | Phase 7-9 (hardening, QA, doc) merged; tag `v1.0-refactor` |

Slack demo at end of Week 3 (streaming & handoffs) and final demo Week 5.

---

### ✅ Definition of Done  
All acceptance criteria met, branch merged to `main`, tag `v1.0-refactor`, documentation up-to-date in `Docs_project/`, and production deployment ready.  
