# Refactoring PRD – IAE Chatbot (Multi-Agent Mistral AI)

## 1 – Purpose
Refactor the existing “iae-chatbot-mistral” React application into a modular, maintainable and testable codebase **without regressing any current feature**:

* Three-agent workflow (Document Library → Websearch → Document Q&A)  
* Visual workflow indicators, real-time logs, PDF detection, robust error handling

## 2 – Current State (2025-06)
| Aspect | Observation |
|--------|-------------|
| **Structure** | Single Create-React-App. All logic (UI + business + API) in `src/App.js` (~850 LOC). |
| **Architecture** | Monolithic; no service/helpers layers. |
| **Agent Mgmt** | Agents created ad-hoc inside component on first render. |
| **State** | `useState` holding 12+ variables; complex cross-updates. |
| **Networking** | Direct `fetch` calls sprinkled through JSX handlers. No retry/back-off. |
| **UX** | Functional: chat UI, animated step dots, detailed JSON logs. |
| **Testing** | Only CRA defaults; no custom tests. |
| **Config** | `.env` for API key but accessed from client (security risk in prod). |

## 3 – Goals & Non-Goals
### 3.1 Goals
1. **Separation of concerns** – isolate UI, workflow orchestration, agents API, utilities.
2. **Scalability** – easy to add/remove agents or swap connectors.
3. **Testability** – unit & integration tests for services and components.
4. **Resilience** – centralized error handling, retry policies, timeout & abort support.
5. **Developer DX** – smaller files, typed data models, clear folder naming.
6. **UX polish** – consistent loading skeletons, accessibility (WCAG 2.1 AA), slicker step progress.
7. **Production readiness** – SSR-safe code, tree-shakeable, env-driven configs.

### 3.2 Non-Goals
* Server-side migration (will still be CSR for now).  
* Agent prompt/logic changes (except moving strings to config).

## 4 – Target Architecture

```
src/
 ├─ components/           # Presentational React components
 │   └─ Chat/
 │       ├─ ChatWindow.tsx
 │       ├─ MessageBubble.tsx
 │       └─ WorkflowIndicator.tsx
 ├─ features/
 │   └─ chat/             # Smart “screen” component orchestrating feature
 │       ├─ ChatPage.tsx
 │       ├─ chatSlice.ts  # Zustand reducer or useReducer for messages
 │       └─ hooks.ts
 ├─ services/
 │   ├─ mistral/
 │   │   ├─ agentService.ts      # CRUD & caching of agents
 │   │   ├─ conversationService.ts # start / append conversations
 │   │   └─ types.ts
 │   └─ workflow/
 │       └─ workflowEngine.ts    # deterministic finite-state workflow described below
 ├─ utils/
 │   ├─ fetchWithRetry.ts
 │   └─ pdfDetection.ts
 ├─ config/
 │   └─ agents.ts               # all agent definitions (name, tools, prompts…)
 ├─ tests/
 └─ index.tsx
```

### 4.1 State Management
* **Zustand** (lightweight) or React Context + `useReducer`.  
* Global stores: `messages`, `workflowSteps`, `loading`, `agentsCache`.

### 4.2 Workflow Engine
Pure TS module exposing:

```ts
executeWorkflow(
  prompt: string,
  services: { agent: AgentService; conv: ConversationService; }
): Promise<WorkflowResult>
```

Implements finite states:

1. `DOC_LIB`  → if info found ✅ END  
2. `WEBSEARCH` → if result w/ pdf ✅ maybe go to **DOC_QA** else END  
3. `DOC_QA` → END  
Transitions + side-effects logged as `WorkflowEvent`.

### 4.3 Networking Layer
* `fetchWithRetry` (configurable back-off, 3 attempts, abort signal 20 s).  
* All calls return typed `Result<T,Error>` objects.

### 4.4 Error Boundary
Top-level React ErrorBoundary to show fallback UI + reset.

## 5 – Implementation Phases & Milestones

| Phase | Scope | Deliverables |
|-------|-------|--------------|
| **0. Baseline** | Freeze current repo, add e2e Cypress happy-path test. | `feat/baseline-tests` |
| **1. Folder Scaffold** | Introduce new tree, TS config, ESLint, Prettier. | Empty modules; CRA still serves old App. |
| **2. Services Layer** | `agentService`, `conversationService`, utils with unit tests (Jest). | `feat/services-layer` |
| **3. Workflow Engine** | Port algorithm from `App.js` into pure TS module; write integration tests with mocked services. | `feat/workflow-engine` |
| **4. UI Refactor** | Split presentational components; adopt Tailwind @apply strategy; maintain exact same visuals. | `feat/ui-refactor` |
| **5. State Store** | Replace scattered `useState` with Zustand slice; ensure React devtools integration. | `feat/state-store` |
| **6. Replace legacy App** | Bridge new ChatPage into router, delete legacy code. | `feat/switch-over` |
| **7. Hardening** | AbortController, retries, exponential back-off, global error boundary. | `feat/hardening` |
| **8. QA & Docs** | Cypress regression, accessibility audit, README & Storybook for components. | `release/refactor-v1` |

## 6 – Technical Specifications

* **Language**: TypeScript 5.x
* **React**: 19.x, functional components only.
* **Styling**: Tailwind 3.x + `@tailwindcss/typography`.
* **HTTP**: native `fetch` with polyfill for tests, wrapped in `fetchWithRetry`.
* **Env**: `VITE_` or CRA prefix `REACT_APP_`; validate at runtime.
* **Logging**: `debug` npm pkg, namespace `mistral:*`.
* **Security**: production build will proxy API via backend → keep API key out of browser (out-of-scope for this refactor but code must allow baseURL override).
* **Lint/Test**: ESLint AirBnB base + Prettier; Jest + React Testing Library; 90 % statements coverage.

## 7 – Testing Strategy

| Layer             | Tool                | What to test |
|-------------------|---------------------|--------------|
| Pure utilities    | Jest                | retry logic, pdf regex. |
| Services (API)    | Jest + MSW          | happy path, 4xx/5xx, retries exhausted. |
| Workflow engine   | Jest               | all branch transitions; pdf/no-pdf scenarios. |
| Components        | RTL                | rendering, disabled buttons, loading states. |
| Integration       | RTL + MSW          | user sends prompt → bubble appears; steps lights. |
| E2E               | Cypress            | full chat path, refresh resilience. |

CI runs unit + integration on push; E2E on main/nightly.

## 8 – Acceptance Criteria

* All previous user journeys pass (baseline Cypress green).
* `src/App.js` ≤ 200 LOC and delegates to modular code (or deleted).
* Lighthouse performance ≥ 90, accessibility ≥ 95.
* Jest coverage ≥ 90 % statements.
* Can add a fourth agent via one entry in `config/agents.ts` + minimal UI change (<10 LOC).
* Killing API during chat shows fallback UI, preserves history, allows retry.
* README updated with new architecture diagram.

## 9 – Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Large diff complicates code review | Medium | Phase-by-phase PRs, feature flags. |
| API rate limits during tests | High | Mock with MSW; limit live calls in CI. |
| Exposing key in FE | High | Provide proxy stub + docs; warn DEV only. |
| Regression in complex UI behaviours | Medium | Snapshot & E2E tests before/after. |

## 10 – Timeline (indicative)

| Week | Milestone |
|------|-----------|
| 1 | Phase 0-1 |
| 2 | Phase 2-3 |
| 3 | Phase 4-5 |
| 4 | Phase 6-7, QA |
| 5 | Buffer, release |

---

### ✅ Definition of Done
* All acceptance criteria met
* Merge to `main`
* Tag `v1.0-refactor`
* Changelog, PRD archived in `/Docs_project`

