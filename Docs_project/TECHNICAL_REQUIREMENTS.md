# Technical Requirements – IAE Chatbot Multi-Agent Refactor  
*File ID: REQ-IAE-TECH-001 • Version 1.0 • 2025-06-27*  

> **Audience:** every contributor (human or coding agent) working on this repository.  
> **Scope:** front-end React 19 + TypeScript 5 application integrating with the Mistral AI Agents API.  

---

## 1 Development Environment

Requirement | Value / Tool | Notes
----------- | ------------ | -----
**Node.js** | ≥ 20.10 | Built-in `fetch`; ES2023 syntax.
**Package manager** | **pnpm 8** | Lockfile committed; use `pnpm` for all scripts.
**OS** | Any (macOS / Linux / Windows WSL2) | CI runs on Ubuntu-latest.
**Scripts** | `pnpm dev` (CRA), `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm cypress`, `pnpm storybook`, `pnpm audit` |
**Env vars** (dev) | `.env` → `REACT_APP_MISTRAL_API_KEY`, `REACT_APP_MISTRAL_BASE_URL` (optional) | Never commit real keys.
**Husky** | Pre-commit hook runs `pnpm lint:fix && pnpm format` |
**IDE plugins** | ESLint, Prettier, Tailwind CSS IntelliSense, Zustand Snippets |
**Browser targets** | Last 2 Chrome/Firefox, Safari 16+, Edge 114+ |

---

## 2 Code Standards

Category | Tool / Setting
-------- | ---------------
**Language** | TypeScript 5, `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`
**Lint** | ESLint (Airbnb TS) + React, Jest, Cypress plugins
**Formatter** | Prettier; 100-char lines, single quotes, trailing commas `es5`
**Paths** | Absolute aliases `@/components/*`, `@/services/*` via `tsconfig.json`
**Naming** | `camelCase` vars, `PascalCase` components, `SCREAMING_SNAKE` constants
**Imports** | Order: std ➜ third-party ➜ alias ➜ relative; blank line between groups
**Commit style** | Conventional Commits (`feat:`, `fix:`, `docs:`…) with scoped branches (`feat/services-layer`)

---

## 3 File Structure

```
src/
 ├─ components/            # Presentational, style-only
 ├─ features/chat/         # Smart container, hooks
 ├─ services/
 │   └─ mistral/           # agentService, conversationService, types
 ├─ streams/               # eventStreamHandler (SSE parser)
 ├─ stores/                # Zustand slices
 ├─ utils/                 # fetchWithRetry, pdfDetection, helpers
 ├─ config/agents.ts       # Static agent metadata / IDs
 └─ index.tsx
Docs_project/              # All project documentation
tests/                     # Shared test fixtures & mocks
```

* Test files: `*.test.ts(x)` colocated next to unit.  
* Storybook files: `*.stories.tsx` alongside component.

---

## 4 Component Architecture

Principle | Guideline
--------- | ----------
**Presentational vs Container** | `components/` have no business logic; `features/chat/` orchestrates state & API calls.
**Styling** | Tailwind utility classes; extract complex rules with `@apply` into `*.module.css`.
**Dark-mode** | Use `dark:` variants; must render correctly in both themes.
**Accessibility** | Semantic HTML, ARIA roles (`aria-live="polite"` for assistant bubbles), keyboard navigation, focus ring.
**Storybook** | Each presentational component requires at least one story with controls + axe addon check.

---

## 5 State Management

Item | Requirement
---- | -----------
**Library** | **Zustand** + Immer
**Slices** | `chatSlice`, `workflowSlice`, `agentSlice`
**Persistence** | `sessionStorage` via `persist` middleware
**Selectors** | Always use shallow compare or selectors to avoid extra re-renders
**DevTools** | Enabled in development; disabled in production
**No state in services** | Services are stateless; they fetch & return data only

---

## 6 Error Handling

Scenario | Behaviour
-------- | ----------
Network/5xx | Retry 3× (0.5 s → 1.5 s → 3 s) via `fetchWithRetry`
`429` | Respect `Retry-After`; exponential back-off up to 4×
Request > 20 s | Abort via `AbortController`; show toast “Temps d’attente dépassé”
4xx (client) | Surface message; no retry
Stream unavailable (proxy blocks SSE) | Fallback to non-stream completion once, then toast
Global | React ErrorBoundary shows friendly fallback & “Réessayer” button
Logging | Use `debug` namespaces; **never** log API keys or user PII

---

## 7 Testing Strategy

Layer | Framework | Coverage Goal | Details
----- | --------- | ------------- | -------
Utilities / Services | Jest + MSW | ≥ 95 % lines | Mock Mistral API; test retry logic & SSE parsing
Components | React Testing Library | ≥ 90 % branches | axe a11y check in every component test
Integration | RTL + MSW | — | Full chat flow incl. handoffs, streaming
E2E | Cypress 13 | Critical journeys | Baseline & regression, cypress-axe for a11y
Performance | Lighthouse CI | Perf ≥ 90 | Run in Phase 8 pipeline
Security | `pnpm audit` | No critical vulns | Fails CI on high severity

CI Workflow Order: lint → unit → integration → audit → E2E → lighthouse.

---

## 8 Performance Budgets

Metric | Budget | Check
------ | ------ | -----
JS initial bundle | ≤ 300 kB gzipped | `source-map-explorer`
First Contentful Paint | ≤ 1.8 s (desktop cable) | Lighthouse CI
Time to Interactive | ≤ 3 s | Lighthouse CI
CLS | < 0.1 | Lighthouse CI
Memory leaks | None | React DevTools profiler during 3-min chat
Stream first token | < 400 ms (90th percentile) | Perf test in CI

Lazy-load heavy deps (`react-markdown`, `lucide-react`) via `React.lazy`.

---

## 9 Accessibility (WCAG 2.1 AA)

Area | Rule
---- | ----
Colour contrast | ≥ 4.5 : 1
Keyboard nav | All interactive elements tabbable, visible focus ring
Screen readers | Correct roles/labels (chat log: `role="log"`, `aria-live="polite"`)
Alt text | Provide for all non-decorative images/icons
Error messages | Linked via `aria-describedby`
Automated checks | `cypress-axe` on main flows; Storybook axe addon

---

## 10 Security Guidelines

Topic | Rule
----- | ----
API keys | Never hard-code; dev via `.env`; prod via backend proxy
Configuration secrets | GitHub Actions secrets; limited to protected branches
XSS | Sanitize Markdown with `rehype-sanitize`; never use `dangerouslySetInnerHTML`
CSP | `script-src 'self'; connect-src 'self' https://api.mistral.ai`
Clickjacking | `X-Frame-Options: DENY`
HTTPS | All environments; HSTS preload (1 year)
Dependencies | `pnpm audit` in CI; mandatory upgrades for high severity
Error logs | Strip stack traces in production; use `debug` log levels
SRI | Integrity hashes on external fonts/scripts (if any)

---

## 11 Deployment

Stage | Requirement
----- | -----------
Preview | Every PR deploys to Vercel/Netlify preview URL
Production | GitHub Action workflow: build ➜ audit ➜ test ➜ lighthouse ➜ deploy
Rollback | Previous successful build kept; PR merge must not auto-delete old deploy
Monitoring | Sentry (frontend errors) + console token usage logs

---

## 12 Contribution Checklist

- [ ] Branch name follows `feat/<slug>` or `fix/<slug>`
- [ ] Runs `pnpm lint` with no errors
- [ ] Unit & integration tests added or updated
- [ ] Coverage ≥ goal
- [ ] Passes Cypress & axe checks
- [ ] No new vulnerable deps (`pnpm audit`)
- [ ] Bundle size change justified (if > 5 %)
- [ ] Documentation updated (if public API or ADR affected)
- [ ] No secrets committed

**Happy coding & bon refactor !** 🚀
