# 📚 Project Documentation Index

Welcome to the **IAE Chatbot – Mistral AI** documentation hub.  
This index gives you a bird’s-eye view of every document that lives in `Docs_project/`, why it exists, and when you should consult it.

| Category | File | Purpose / When to Read |
|----------|------|------------------------|
| **Vision & Strategy** | [vision.md](vision.md) | High-level product vision, user value, multi-agent concept and key UX pillars. Start here for context. |
| **Product Requirements** | [REFACTORING_PRD.md](REFACTORING_PRD.md) | Formal Product Requirements Document for the refactor. Defines goals, scope, milestones, success metrics and risks. |
| **Step-by-Step Guide** | [STEP_BY_STEP_REFACTORING_GUIDE.md](STEP_BY_STEP_REFACTORING_GUIDE.md) | Hands-on checklist that maps each PRD phase to concrete engineering tasks, code snippets and before/after comparisons. Follow this during development. |
| **Architecture Decisions** | [ARCHITECTURE_DECISION_RECORDS.md](ARCHITECTURE_DECISION_RECORDS.md) | Chronological ADRs capturing key choices (state management, API flow, streaming strategy). Review to understand *why* certain patterns were adopted. |
| **Technical Requirements** | [TECHNICAL_REQUIREMENTS.md](TECHNICAL_REQUIREMENTS.md) | Canonical engineering standards: languages, tooling, testing thresholds, performance & accessibility budgets. Use as acceptance criteria for PRs. |
| **API Specification** | [API_INTEGRATION_SPEC.md](API_INTEGRATION_SPEC.md) | Single source of truth for every HTTP call, headers, error handling matrix and SSE event list. Mandatory reading for anyone touching the Mistral API layer. |
| **(You Are Here)** | DOCUMENTATION_INDEX.md | The map of the docs. Keep up-to-date when new files are added. |

## How to Navigate

1. **New contributor?**  
   Read **vision.md** ➜ **REFACTORING_PRD.md** to understand the why & what.

2. **Implementing a phase?**  
   Open **STEP_BY_STEP_REFACTORING_GUIDE.md** and follow the checklist.

3. **Changing architecture or libraries?**  
   Propose an update in **ARCHITECTURE_DECISION_RECORDS.md**.

4. **Working on API or services layer?**  
   Conform strictly to **API_INTEGRATION_SPEC.md** and cross-check with **TECHNICAL_REQUIREMENTS.md**.

---

_💡 Tip: keep this index bookmarked in your IDE for quick access to any project doc._  
