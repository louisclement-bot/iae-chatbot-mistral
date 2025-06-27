# Architecture Decision Record – Phase 4  
**File ID:** ADR-IAE-WF-002 • **Status:** Accepted • **Date:** 2025-06-27

## 1 – Context  
The original Refactoring PRD (section 4.2 “Workflow Engine”) scheduled a client-side finite-state machine (`workflowEngine.ts`) to orchestrate the three-step path:

1. Document Library  
2. Websearch  
3. Document Q&A  

When the PRD was written (Q1 2025) the app used the legacy `/agents/completions` endpoint; the front-end therefore had to decide which agent to call next based on previous output.

Phase 3 migrated the application to the new `/v1/conversations` API with **server-side handoffs** and **SSE streaming**. The Mistral platform now:

* Persists conversation state  
* Executes the `handoffs` chain configured in each agent  
* Emits explicit `agent.handoff.started` events  

## 2 – Problem  
Should we still ship a full client-side workflow engine as planned, or is a lighter coordination layer sufficient now that orchestration occurs in the cloud?

## 3 – Options Considered  

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Keep complex workflow engine** | Implement original finite-state machine, replicate server logic client-side | Familiar to original design; offline simulation possible | Duplicates platform features, extra code paths to maintain, higher bug surface, unnecessary latency |
| **B. Lightweight Workflow Coordinator (chosen)** | Rely on server-side handoffs; add thin coordinator that listens to streaming events, updates UI, logs state | Zero duplication, minimal code, future-proof (inherits platform improvements), simpler tests | Cannot override agent order at runtime without redeploying agents (acceptable) |

## 4 – Decision  
**We adopt Option B**: implement a *lightweight Workflow Coordinator* (see `src/services/workflow/workflowCoordinator.ts`).  
Responsibilities:

1. Subscribe to ConversationService streams (`startStream`, `appendStream`, `restartStream`).  
2. Translate `StreamEvent` types into UI/store updates (step status, content aggregation, source extraction).  
3. Expose immutable `WorkflowState` for components and tests.  
4. Provide helper methods (`reset`, `getState`) but **no** branching or agent-selection logic.

## 5 – Rationale  

### 5.1  Original PRD vs Phase 3 Reality  

| Aspect | PRD Phase 3 Plan | Post-Phase 3 Capabilities |
|--------|------------------|---------------------------|
| Orchestration | Client FSM (`executeWorkflow`) | Server handoffs defined in agent `handoffs` array |
| State | Transient in React memory | Persisted `conversation_id` on backend |
| UI Signals | Manual setStep(…) after each call | Stream events: `agent.handoff.started`, `message.output.delta` |
| Failure Handling | Custom retries per step | Centralized retry via `fetchWithRetry`; platform resumes on reconnect |
| Development Cost | High (±400 LOC + tests) | Low (±120 LOC coordinator) |

The server now guarantees ordered execution; reproducing that logic in the browser brings no benefit and risks drift if the platform evolves.

### 5.2  Benefits of Lightweight Approach  
* **Reduced Complexity** – 70 % less code than a full FSM; easier reasoning.  
* **Maintenance** – Any change to workflow just updates agent `handoffs` through the SDK, no redeploy of front-end.  
* **Performance** – Eliminates redundant round-trips; handoff occurs server-side with lower latency.  
* **Resilience** – Conversation continues even if the browser briefly disconnects; upon reconnection the coordinator re-hydrates state from events.  
* **Scalability** – Adding a new step = create agent + append its ID to predecessor’s `handoffs`.  
* **Testing** – Deterministic event stream can be replayed in unit tests without mocking agent order logic.

## 6 – Alignment with Refactoring Goals  

| Goal (PRD §3.1) | Contribution |
|-----------------|--------------|
| **Separation of concerns** | Coordinator isolates presentation from backend orchestration. |
| **Scalability** | Server-side chain controlled in agent config, not code. |
| **Testability** | Small pure-TS module, easy to unit-test with mocked events. |
| **Resilience** | Leverages cloud persistence; coordinator handles only UI state. |
| **Developer DX** | Fewer files, simpler mental model; aligns with event-driven architecture. |

## 7 – Consequences  

1. `workflowEngine.ts` from original plan is **scrapped**.  
2. The coordinator is invoked by `ChatPage` and feeds Zustand store in Phase 6.  
3. Documentation and diagrams updated to reflect server-side orchestration.  
4. Future offline/edge use-cases may revive a client FSM but can build atop the coordinator’s contract without breaking UI.

## 8 – References  
* Refactoring PRD v1 (§4.2 Workflow Engine)  
* Step-by-Step Guide (§5 Streaming, §6 Enable handoffs)  
* ADR-IAE-WF-001 (Phase 3 handoff migration)  
