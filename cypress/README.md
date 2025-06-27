# 🧪 Cypress E2E Test Suite  
IAE Chatbot – Mistral AI

This document explains **how to work with the Cypress end-to-end tests** shipped in `cypress/`, what the current *baseline* tests validate, and the conventions to follow when extending the suite during the upcoming refactor phases.

---

## 1  Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js      | ≥ 18.x |
| npm / pnpm   | latest LTS |
| Browser      | Chrome, Chromium, or Electron (bundled) |

Cypress is installed as a dev-dependency (`cypress`, `cypress-axe` for accessibility, and `@cypress/webpack-preprocessor`).

```bash
# one-time install
pnpm install
```

---

## 2  Scripts

Script | Purpose
------ | -------
`pnpm cy:open` | Launches the interactive Cypress UI.
`pnpm cy:run` | Runs **all** specs headless (CI default).
`pnpm cy:baseline` | Runs only the *baseline* chat spec (`baseline-chatbot.cy.js`).
`pnpm test:all` | Jest unit tests **+** headless Cypress run (local confidence build).

All scripts respect the environment variable `CI=true`, which skips live API calls inside specs that would slow down CI pipelines.

---

## 3  Folder Layout

```
cypress/
 ├─ e2e/                    # spec files
 │   └─ baseline-chatbot.cy.js
 ├─ fixtures/               # mock payloads & test data
 │   ├─ testQueries.json
 │   └─ mockAgentResponse.json
 └─ support/
     ├─ commands.js         # custom Cypress commands
     └─ e2e.js              # global hooks, axe-core setup
```

### 3.1 Custom Commands

The helpers defined in `support/commands.js` (e.g. `sendChatMessage`, `waitForBotResponse`, `runA11yAudit`) should be reused in new specs to avoid duplication.

---

## 4  What the Baseline Tests Cover

Suite | Key Assertions
----- | --------------
**UI Smoke** | Header, greeting, input area, send button state, sections visibility.
**Chat Interaction** | User message rendering, loading spinner, assistant reply.
**Workflow Indicator** | Step dots (`Document Library`, `Websearch IAE`, `Document Q&A`) change status (`pending → active → completed`).
**Workflow Path** | Bubble footer lists executed steps in order.
**Error Handling** | Empty input guard, simulated 5xx error shows fallback message.
**API Logs Panel** | Conversation ID, tool execution blocks, raw JSON view.
**Sources & Citations** | Presence (or absence) of “Sources :” block and links.
**Accessibility** | Automated axe-core audit (critical & serious impacts) + keyboard navigation.

These assertions capture the **current behaviour** of the monolithic `App.js`. Passing them after each phase guarantees *zero regression* while we refactor.

---

## 5  Extending the Suite for Future Phases

Phase | New Tests to Add | Hints
----- | ---------------- | -----
**1 – TypeScript scaffold** | None (structural). | Keep baseline green.
**2 – Services Layer** | Unit tests (Jest/MSW) for `fetchWithRetry`. | Out of scope for Cypress.
**3 – Handoffs & Streaming** | • Verify streaming bubbles update in real-time (`message.output.delta`).<br>• Assert `agent.handoff.started` events toggle active step automatically. | Use `cy.intercept('**/conversations*', {fixture…})` + SSE mock utility.
**4 – Workflow Engine** | Branch coverage: DocLib → Websearch only, DocLib → Websearch → DocQ&A. | Drive with fixture flags (`hasPdf=true`).
**5 – UI Component Refactor** | Visual regression (optional) with `@cypress/snapshot`. | Reuse the same assertions – DOM paths shouldn’t break.
**6 – Zustand Store** | Refresh page mid-conversation → history reloads correctly. | Utilise `localStorage` stubbing.
**7 – Legacy Removal** | Baseline spec **must still pass** with new thin `App.tsx`. | Ensures parity.
**8 – Error/Perf Hardening** | Simulate network timeout & retry, token limit warnings. | Use `cy.clock` to control timers.
**9 – Docs & QA** | Lighthouse / axe score checks in CI. | Add `cypress-audit` plugin if desired.

---

## 6  Mocking vs. Live Calls

By default the baseline spec hits the real Mistral API when **not** in CI.  
For local deterministic runs you can enable mocks:

```js
// in a spec or beforeEach
cy.setupApiMocks(true);
```

Mock fixtures live in `cypress/fixtures/`.

---

## 7  CI Integration

The GitHub Actions workflow (added later) should:

1. Install deps (`pnpm install --frozen-lockfile`).
2. Build the app (`pnpm build`).
3. Serve build (`npx serve -l 3000 build &`).
4. Run `pnpm cy:run --browser chrome`.

Artefacts: screenshots + videos uploaded on failure.

---

## 8  Writing New Specs – Best Practices

* **One scenario per `it()`** block.  
* Use **data-driven** tests with fixtures (`cy.loadTestQueries()`).
* Prefer **custom commands** to raw selectors.
* Keep **timeouts generous** for AI latency (`defaultCommandTimeout` 30-60 s).
* Always finish with `runA11yAudit()` to enforce accessibility.

---

Happy testing! 🧪✨
