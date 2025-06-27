# 🛠️ Step-by-Step Refactoring Guide  
*File ID: GUIDE-IAE-REF-001 • Version 1.0*

This guide breaks the multi-agent refactor into **10 sequential phases**.  
Each phase:

* Lives in its own feature branch (`feat/<phase-slug>`)  
* Ends with a PR to `main` that must pass lint, tests & CI gates  
* Keeps the application shippable at all times (feature-flag if needed)

Read **REFACTORING_PRD.md** for high-level goals and **TECHNICAL_REQUIREMENTS.md** for coding standards.

---

## 📋 Phase Table (Bird’s-Eye)

| # | Branch | Goal | Key Deliverables |
|---|--------|------|------------------|
| 0 | `feat/baseline-tests` | Freeze current behaviour | Cypress happy-path, snapshot of JSON logs |
| 1 | `feat/scaffold-ts` | Folder tree, TypeScript, lint pipeline | tsconfig, ESLint + Prettier, empty stubs |
| 2 | `feat/services-layer` | API & util services | `agentService`, `conversationService`, `fetchWithRetry` + unit tests |
| 3 | `feat/handoffs-stream` | Configure handoffs & SSE streaming | Agent `handoffs`, `eventStreamHandler`, progress indicators |
| 4 | `feat/workflow-engine` | Optional FSM for edge cases | Pure TS module + tests (skip if not needed) |
| 5 | `feat/ui-refactor` | Presentational components | ChatWindow, MessageBubble, WorkflowIndicator, Storybook |
| 6 | `feat/state-store` | Global store | Zustand slices, persisted state |
| 7 | `feat/switch-over` | Remove legacy App.js | Replace with ChatPage, route integration |
| 8 | `feat/hardening` | Resilience & perf | AbortController, retries, ErrorBoundary, Lighthouse ≥ 90 |
| 9 | `release/refactor-v1` | QA & docs | Full regression suite, accessibility, README update |

---

## 0  Baseline Tests

**Objective** Capture current behaviour to guard against regressions.

1. Create branch `feat/baseline-tests`.
2. Install *Cypress* + *cypress-axe*.  
3. Record a full chat flow: ask “Quels masters finance ?” → ensure response bubble & JSON log appear.  
4. Snapshot DOM of Workflow dots (3 steps).  
5. Add GitHub Action `baseline.yml` running Cypress on PRs.

*Exit criteria*  
– `npm run cypress:run` green.  
– Baseline snapshots committed.

---

## 1  Folder Scaffold & TypeScript

**Objective** Introduce final folder layout & TypeScript without touching runtime logic.

Steps:

1. `git checkout -b feat/scaffold-ts`
2. Add `tsconfig.json` (strict) and convert `src` to `src/legacy`.
3. Create folders:

   ```
   src/
     components/
     features/chat/
     services/mistral/
     streams/
     stores/
     utils/
     config/
   ```

4. Add ESLint (Airbnb TS) and Prettier; hook via Husky pre-commit.
5. Verify CRA still serves legacy App (import path adjusted).

*Exit criteria*  
– `pnpm lint` passes, CI green.

---

## 2  Services Layer

**Objective** Implement typed wrappers around the **new Conversations API**.

Files:

```
services/mistral/agentService.ts
services/mistral/conversationService.ts
utils/fetchWithRetry.ts
```

### 2.1 Before vs After (API)

**Before** (monolithic call)

const resp = await fetch(`${API}/agents/completions`, { … });

**After**

const conv = await conversationService.start({
  agentId: docLibId,
  inputs: "Quelle formation RH ?"
});

### 2.2 Tasks

1. Implement `fetchWithRetry` (3 attempts, 0.5 → 1.5 → 3 s).  
2. Add `conversationService.start`, `.append`, `.startStream`.  
3. Unit test with **MSW**: happy path, 4xx, retries exhausted.  
4. Stub but don’t yet replace legacy fetches.

*Exit criteria*  
– Jest coverage ≥ 90 % lines in `services/`.

---

## 3  Handoffs & Streaming

**Objective** Remove manual workflow and enable real-time UI via SSE.

### 3.1 Configure Agents

Script (run once):

```ts
await agentService.update(docLibId, { handoffs: [websearchId] });
await agentService.update(websearchId, { handoffs: [docQaId] });
```

### 3.2 Replace Manual Workflow

**Before** (excerpt from legacy `executeWorkflow()`)

if (!docLibResult.content.includes('AUCUNE_INFO_TROUVEE')) {
  return docLibResult;
}
…

**After** (minimal)

const resp = await conversationService.startStream({ … });
// SSE parser drives UI; no branching here.

### 3.3 Implement `eventStreamHandler`

* Parse events:

| Event | Action |
|-------|--------|
| `conversation.response.started` | Add loading bubble |
| `agent.handoff.started` | Mark previous step complete |
| `message.output.delta` | Append live tokens |
| `conversation.response.done` | Finish bubble |

*Update* `WorkflowIndicator` state via Zustand slice.

*Exit criteria*  
– Live typing shown; dots animate on handoffs.  
– Manual `executeWorkflow()` removed.

---

## 4  (Optional) Workflow Engine

Only implement if additional client-side branching (e.g., fallback to function-calling) is needed.

Pattern:

```ts
enum State { DOC_LIB, WEB, DOC_QA, DONE }
transition(state, event) → newState
```

Unit test all transitions.

*Skip if server handoffs suffice.*

---

## 5  UI Refactor

**Objective** Isolate presentation from logic.

Components:

* components/Chat/ChatWindow.tsx  
* components/Chat/MessageBubble.tsx  
* components/Chat/WorkflowIndicator.tsx  

Guidelines:

* Props only; no fetch calls.  
* Style with Tailwind; extract complex classes via `@apply`.  
* Add Storybook stories for each.

*Exit criteria*  
– Visual identical to legacy UI.  
– axe a11y checks pass.

---

## 6  Global State Store

**Objective** Replace scattered `useState` with Zustand.

Slices:

* `chatSlice` – messages, loading, conversationId  
* `workflowSlice` – steps & status  
* `agentSlice` – cache agent metadata

Persist to `sessionStorage` using `persist` middleware.

*Exit criteria*  
– No prop drilling through 3+ levels.  
– React DevTools shows minimal re-renders (selector usage).

---

## 7  Switch-over & Legacy Removal

1. Create `ChatPage.tsx` under `features/chat/`.  
2. Wire services + store + components.  
3. Swap CRA entry to render `ChatPage`.  
4. Delete (or archive) `src/legacy/App.js`.

*Exit criteria*  
– Cypress happy path green using new code.  
– Bundle size ≤ 300 kB gzipped.

---

## 8  Hardening & Performance

Tasks:

* Wrap network calls in AbortController (20 s).  
* Global ErrorBoundary → user‐friendly banner + reset button.  
* Audit with Lighthouse; fix any perf or a11y regressions.  
* Run `pnpm audit`; bump vulnerable deps.

*Exit criteria*  
– Lighthouse Perf ≥90, A11y ≥95, BP ≥90.  
– No unhandled promise rejections in console.

---

## 9  QA, Documentation & Release

1. Full regression run (unit, RTL, Cypress).  
2. Screen reader smoke test (NVDA/VoiceOver).  
3. Update root `README.md` with build/run instructions.  
4. Tag `v1.0-refactor`; prepare change-log.  
5. Merge to `main` via PR titled “refactor: v1”.

---

## 🔚 Afterword

You now have a deterministic roadmap to evolve from **manual workflow & deprecated API** to **native handoffs + streaming** in 10 safe steps.

*Happy coding & bon refactor !* 🚀
