# 📖 Documentation Index – IAE Chatbot Refactor

Welcome!  
This index is the **starting point** for any human developer **or coding agent** working on the multi-agent refactor of the IAE Lyon 3 chatbot.

---

## 1 — Document Catalogue

| # | File | Purpose |
|---|------|---------|
| 1 | **vision.md** | Original product vision – why the chatbot exists and the high-level multi-agent workflow it must fulfil. |
| 2 | **REFACTORING_PRD.md** | Product Requirements Document – scope, goals, target architecture, phases, risks & acceptance criteria for the refactor. |
| 3 | **STEP_BY_STEP_REFACTORING_GUIDE.md** | Concrete migration checklist (10 phases) with before/after code snippets and branch strategy. |
| 4 | **ARCHITECTURE_DECISION_RECORDS.md** | Series of ADRs capturing *why* each major technical decision (handoffs vs manual workflow, TypeScript, Zustand, streaming…). |
| 5 | **API_INTEGRATION_SPEC.md** | End-to-end specification for every call to the Mistral AI Agents API, including payloads, SSE events, error handling & rate limits. |
| 6 | **TECHNICAL_REQUIREMENTS.md** | Coding standards, folder structure, testing matrix, performance budgets, accessibility and security guidelines. |

---

## 2 — Recommended Reading Order

1. **vision.md**  
   Understand the business context and the desired multi-agent workflow (Document-Library → Websearch → Document-Q&A).

2. **REFACTORING_PRD.md**  
   Grasp *what* must be built and *how success is measured*. This drives all later engineering tasks.

3. **ARCHITECTURE_DECISION_RECORDS.md**  
   Learn the rationale behind key choices (handoffs, conversations API, streaming, state store). Prevents re-litigating settled questions.

4. **STEP_BY_STEP_REFACTORING_GUIDE.md**  
   Follow the migration path phase-by-phase; each step references the PRD sections and ADR numbers it satisfies.

5. **API_INTEGRATION_SPEC.md**  
   While coding services / workflow, consult this spec for correct endpoints, headers, SSE event parsing and retry strategy.

6. **TECHNICAL_REQUIREMENTS.md**  
   Adhere to lint rules, testing coverage, performance & security constraints before opening a PR.

---

## 3 — How the Documents Work Together

```
vision → PRD ─┐
              ├─> implementation phases (guide) → code
ADRs ─────────┘              ↑
     \                       |
      \__ informs API Spec __┘
                 ↓
        Tech Requirements (quality gate)
```

* **vision.md** sets the *why*.  
* **REFACTORING_PRD.md** translates vision into actionable goals and architecture.  
* **ARCHITECTURE_DECISION_RECORDS.md** records *why* each technical path was chosen, ensuring future decisions remain consistent.  
* **STEP_BY_STEP_REFACTORING_GUIDE.md** operationalises the PRD + ADRs into a linear execution plan.  
* **API_INTEGRATION_SPEC.md** provides the low-level contract required by the services written in each phase.  
* **TECHNICAL_REQUIREMENTS.md** defines the “Definition of Done” and CI gates for every pull request.

Together they form a complete knowledge stack: **strategy → decisions → execution plan → API contract → quality bar**.

---

## 4 — Index Usage for Coding Agents

When issuing prompts to an autonomous coding agent:

1. **Reference specific filenames** so the agent loads them as context.  
2. **Cite the relevant section / phase** in the PRD or Guide to anchor the task.  
3. Provide acceptance criteria from **TECHNICAL_REQUIREMENTS.md**.  
4. For service-layer tasks, attach the corresponding excerpt from **API_INTEGRATION_SPEC.md**.  
5. If the task alters architecture, instruct the agent to consult / update **ARCHITECTURE_DECISION_RECORDS.md**.

Example prompt snippet:

> “Implement Phase 2 (Services Layer) as described in STEP_BY_STEP_REFACTORING_GUIDE.md §2, ensuring all calls match API_INTEGRATION_SPEC.md §4, and code style passes TECHNICAL_REQUIREMENTS.md ‘ESLint rules’.”

---

Happy building! 🚀
