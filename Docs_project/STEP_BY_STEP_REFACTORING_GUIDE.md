# Step-by-Step Refactoring Guide  
**File:** `STEP_BY_STEP_REFACTORING_GUIDE.md`  

This guide translates our monolithic `App.js` into a production-ready, multi-agent architecture fully aligned with the latest Mistral AI APIs and the Refactoring PRD.

---

## 0  Reference Material
| Source | Key takeaway |
|--------|--------------|
| App.js (current) | Uses `/agents/completions`, manual workflow, agents re-created on every render. |
| Agents Basics | Should use `/v1/conversations` (`start/append/restart`) and persistent agents. |
| Handoffs docs | Native server-side chaining removes manual “if/else” logic. |
| Websearch / Document Library / Document QnA | Dedicated connectors & OCR PDF flow. |
| Function Calling | Enables custom tools if needed. |
| Refactoring PRD | Target architecture, phases, acceptance criteria. |

---

## 1  Current vs Recommended API Usage

| Concern | **Current** | **Recommended** |
|---------|-------------|-----------------|
| Create agents | `POST /agents` **every render** | One-time creation (or manual in console) ➜ store IDs in `.env`/backend. |
| Ask agent | `POST /agents/completions` each step | `POST /conversations` → `start` then `append` / `restart` with history. |
| Workflow | Manual JS `if/else` | Configure `handoffs` array on agents; let server route. |
| PDF analysis | Parse `.pdf` string 👉 re-call Library | Use **Document QnA** connector or OCR API with `document_url`. |
| Streaming | Polling / wait | SSE streaming endpoints `*Stream()` for real-time bubbles. |

### Before / After Snippet

**Before**
```js
const response = await fetch(`${API}/agents/completions`, { ... });
```

**After**
```js
// Start new conversation
const conv = await convSvc.start({
  agentId: docLibAgentId,
  inputs: "Question…"
});
// Append later steps
const follow = await convSvc.append({
  conversationId: conv.id,
  inputs: "...",
});
```

---

## 2  Transforming Manual Workflow → Handoffs

### 2.1 Configure Agents

```ts
// document-library agent
handoffs: [websearchAgent.id]

// websearch agent
handoffs: [docQaAgent.id]
```

Server logic:

1. doc-lib replies → if unable, triggers handoff to websearch  
2. websearch finds PDF → triggers handoff to doc-qa  
No more JS branching.

### 2.2 Client Responsibility

* Detect `agent.handoff.*` stream events to update UI steps.
* Show step status based on event sequence rather than manual `updateWorkflowStep()`.

---

## 3  Proper Conversation Management

### Lifecycle

1. **start** – first user message.
2. **append** – any follow-ups (including `function.result` entries).
3. **restart** – branch from past entry if user rewinds.

### Persistence Strategy

* Keep `conversation_id` in component store.
* Flush to localStorage/sessionStorage to restore after refresh.

---

## 4  Proposed File Structure

```
src/
 ├─ services/
 │   ├─ mistral/
 │   │   agentService.ts          // create/update/list
 │   │   conversationService.ts   // start/append/stream
 │   │   types.ts
 │   └─ workflow/
 │       workflowEngine.ts        // optional custom logic if handoff=client
 ├─ agents/                       // one file per agent definition
 │   docLibrary.ts
 │   websearch.ts
 │   docQa.ts
 ├─ stores/                       // Zustand or Context
 │   chatStore.ts
 ├─ components/
 │   Chat/
 │   WorkflowIndicator/
 └─ utils/
     fetchWithRetry.ts
```

*Each agent file* exports static metadata (name, instructions, tools) to feed `agentService.create()` or to reference hard-coded IDs.

---

## 5  Streaming Implementation

```ts
const stream = await convSvc.startStream({
  agentId: docLibraryId,
  inputs: message,
});

for await (const chunk of stream) {
  switch (chunk.type) {
    case "conversation.response.started":
      setStepState("Document Library", "active");
      break;
    case "agent.handoff.started":
      markStepCompleted(prevAgent);
      setStepState(nextAgentName, "active");
      break;
    case "message.output.delta":
      appendPartialText(chunk.content);
      break;
    case "conversation.response.done":
      markStepCompleted(currentStep);
      break;
  }
}
```

UX: render deltas immediately; progress dots driven by event types.

---

## 6  Step-by-Step Migration Path

| # | Task | Key Code Changes |
|---|------|------------------|
| **1** | **Freeze baseline** tests | Add Cypress chat happy-path. |
| **2** | **Extract API layer** | Create `agentService`, `conversationService` calling `/v1/*`; replace fetches in `App.js`. |
| **3** | **Persistent agents** | Hard-code or load IDs; remove dynamic creation from UI. |
| **4** | **Switch to conversation flow** | Replace `/agents/completions` with `start/append`; maintain same UI output. |
| **5** | **Implement streaming** | Use `startStream`; show partial messages & event-driven step indicator. |
| **6** | **Enable handoffs** | Update agent definitions (`handoffs` arrays), delete manual `executeWorkflow`. |
| **7** | **Adopt Document QnA** | Create `docQa.ts` with OCR connector; route PDF URLs to it via handoff or function result. |
| **8** | **Refactor UI components** | Split `ChatWindow`, `WorkflowIndicator`, `LogsPanel`; hook into store. |
| **9** | **Remove legacy code** | Delete giant `App.js` logic; keep thin page wrapper. |
| **10** | **Audit & QA** | Pass e2e/regression tests; check token usage, error boundaries, performance. |

---

## 7  Code Example – Agent Definition File

`src/agents/websearch.ts`
```ts
export const websearchAgentDef = {
  model: "mistral-medium-latest",
  name: "IAE Websearch Agent",
  description: "Recherche sur iae.univ-lyon3.fr",
  instructions: `
    1. Always use web_search with query "site:iae.univ-lyon3.fr {user_query}"
    2. Reply in French, cite sources.
    3. If no result: reply exactly "AUCUN_RESULTAT_WEB"
  `,
  tools: [{ type: "web_search" }],
  handoffs: [], // set at runtime after IDs are known
};
```

---

## 8  Before / After Summary

| Area | **Before** | **After** |
|------|------------|-----------|
| API | `/agents/completions` | `/v1/conversations` |
| Workflow | Manual `executeWorkflow()` | Native `handoffs`, event-driven steps |
| Agents | Re-created per question | Persistent, one-time registration |
| PDF logic | Regex → library relaunch | Document QnA connector |
| Networking | bare `fetch()` | `fetchWithRetry`, AbortController, streaming |
| File layout | One 850-LOC component | Modular services + components |

---

## 9  Next Steps

1. Complete Phase 1–3 of PRD in feature branches.  
2. Merge after passing tests and UX review.  
3. Plan backend proxy to hide API key for production.

Happy refactoring! 🚀
