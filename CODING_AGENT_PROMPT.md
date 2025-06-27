# 🧑‍💻 Coding Agent Prompt — IAE Chatbot Multi-Agent Refactor

## 1  Objective  
Refactor the current monolithic **iae-chatbot-mistral** React project into the modular, production-ready multi-agent architecture described in our documentation set.  Deliver the full implementation, phase-by-phase, until all acceptance criteria are met and all tests pass.

## 2  Documentation to Load as Context  
Load **all** of the following files from `Docs_project/`:

| Ref | File |
|-----|------|
| V   | `vision.md`
| P   | `REFACTORING_PRD.md`
| G   | `STEP_BY_STEP_REFACTORING_GUIDE.md`
| A   | `ARCHITECTURE_DECISION_RECORDS.md`
| S   | `API_INTEGRATION_SPEC.md`
| T   | `TECHNICAL_REQUIREMENTS.md`
| I   | `DOCUMENTATION_INDEX.md`

Always cite section/paragraph IDs from these files when making design choices or writing code.

## 3  Execution Road-Map (follow **G** §“10-phase Migration”)

Phase list (each phase = dedicated PR merged to `main`):

0. Baseline tests  
1. Folder scaffold, TS config, ESLint/Prettier  
2. Services layer (`agentService`, `conversationService`, `fetchWithRetry`)  
3. Configure **server-side handoffs** & implement SSE streaming handler  
4. (Optional) `workflowEngine` if client logic needed  
5. UI refactor into presentational components  
6. Global state store with Zustand  
7. Replace legacy `App.js`, remove dead code  
8. Hardening: AbortController, retries, ErrorBoundary  
9. QA & documentation polish

Strictly finish & green-CI each phase before starting the next.

## 4  Success Criteria (see **P** §“Acceptance Criteria”)

* Legacy user journeys unchanged; Cypress baseline passes  
* `App.js` ≤ 200 LOC or removed; new modular folders in place  
* Real-time streaming visible; handoff path displayed from SSE events  
* Lighthouse: Perf ≥ 90, A11y ≥ 95  
* Jest statement coverage ≥ 90 %  
* Adding new agent requires ≤ 10 LOC change in `config/agents.ts`  
* ErrorBoundary shows friendly fallback and preserves chat history  
* No secrets in repo; API key only in env or backend proxy

## 5  Architectural Patterns to Follow  

Pattern | Mandatory Practices
------- | -------------------
**Presentational / Container** | `components/` UI only, `features/chat/` orchestrates logic
**Services Layer** | Pure TS modules; no React; return `Result<T,Error>`
**State Store** | Zustand slices, Immer updates, sessionStorage persistence
**Server-side Handoffs** | Configure `handoffs` arrays, remove manual branching
**Conversations API** | Use `/v1/conversations` `start/append/restart` + `*Stream`
**Streaming** | SSE reader parses `conversation.response.*`, `agent.handoff.*`, `message.output.delta`
**Testing Pyramid** | Jest ➜ RTL ➜ MSW ➜ Cypress (per **T** §4)

## 6  Code Quality & Security Requirements (per **T**)

* ESLint AirBnB TS + Prettier pass with `pnpm lint`
* TypeScript strict mode, path aliases
* Tailwind utility first; dark-mode ready
* No `dangerouslySetInnerHTML`; sanitize Markdown
* API key read from `REACT_APP_MISTRAL_API_KEY` in DEV only
* Add Husky pre-commit running lint & prettier
* Run `pnpm audit` in CI; fail on high severity

## 7  API Migration Guidance  

1. **Deprecate** `/agents/completions`.  
2. Implement `conversationService.start`, `.append`, `.startStream`, `.appendStream` as in **S** §1/§5.  
3. Parse SSE events; update UI progress dots from `agent.handoff.*`.  
4. Retry logic: follow **S** §6 (500 ms → 1500 ms → 3000 ms).  
5. Use built-in connectors:  
   * `document_library` (ID in env)  
   * `web_search` (site-restricted query)  
   * `document_qna` for PDF OCR  
6. Persist `conversation_id` in store for follow-up turns.

## 8  Testing & Validation Tasks  

Task | Phase
---- | -----
Unit tests utilities & services | 2
Stream parser unit tests (handoff events) | 3
RTL component tests | 5
Integration test full chat flow with MSW | 6
Cypress E2E baseline then each phase | 0,6,8
Accessibility axe checks | 5+
Lighthouse CI | 8

## 9  Deliverables  

* Code merged to `main` after each phase via PR.  
* Updated ADRs if architecture changes.  
* CI green (lint, test, coverage, audit).  
* Updated Storybook for new components.  
* Updated README with build/run instructions.

---

### 🚦 Begin with **Phase 0**:  
Read **G** Phase 0 steps and implement baseline Cypress tests using the patterns in **T** §4. Commit to branch `feat/baseline-tests` and open PR referencing **P** and **G**. Proceed once CI passes and PR is merged.

Good luck — happy refactoring! 🚀
