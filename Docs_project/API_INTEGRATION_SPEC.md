# API Integration Specification – Mistral AI × IAE Chatbot  
*File ID: SPEC-IAE-API-001 • Version 1.0 • 2025-06-27*  

This document is the **single technical reference** for every HTTP call between the front-end application and the **Mistral AI Agents API**.  
All code **must** conform to these rules; integration tests load this file as their truth source.

---

## 1  Environment & Base URL  

Variable | Example | Notes
-------- | ------- | -----
`MISTRAL_API_BASE_URL` | `https://api.mistral.ai/v1` | Overrideable for staging.
`REACT_APP_MISTRAL_API_KEY` | `sk-********************************` | **Dev-only**; production key lives in backend proxy.

---

## 2  Authentication & Common Headers  

```http
Authorization: Bearer ${MISTRAL_API_KEY}
Content-Type: application/json
Accept: application/json           # or text/event-stream for streaming
User-Agent: iae-chatbot/1.0 (+https://iae.univ-lyon3.fr)
```

* **Never** log full keys.  
* SDKs are allowed but all requests must show the above header set in browser DevTools.

---

## 3  Endpoints Overview  

Capability | HTTP | Path | SDK Helper | Notes
---------- | ---- | ---- | ---------- | -----
List models | GET | `/models` | `client.models.list()` | Health check.
Create agent | POST | `/agents` | `client.beta.agents.create()` | One-time; done via maintenance script.
Update agent | PATCH | `/agents/{agent_id}` | `client.beta.agents.update()` | Adds `handoffs`, tweaks prompts.
Start conversation | POST | `/conversations` | `client.beta.conversations.start()` | Use `stream:true` for SSE.
Append conversation | POST | `/conversations/{conversation_id}` | `.append()` | Follow-up user input or `function.result`.
Restart conversation | POST | `/conversations/{conversation_id}/restart` | `.restart()` | Branch from history.
Stream variant | same as above + `Accept: text/event-stream` | `.startStream()` / `.appendStream()` | See § 5.
Files (OCR PDFs) | POST `/files/upload` → GET `/files/{id}/url` | `client.files.upload()` | Only if analysing local PDFs.

**Deprecated:** `/agents/completions` – *must not be used*.

---

## 4  Agent Configuration  

We maintain **three persistent agents** (IDs stored in `.env` or backend database).  
The JSON below is canonical; any change requires an ADR update.

### 4.1 Document-Library Agent  

```json
{
  "model": "mistral-medium-latest",
  "name": "IAE-Docs",
  "description": "Recherche dans la base de connaissance IAE",
  "instructions": "Toujours utiliser document_library. Réponds en FR. Si rien: «AUCUNE_INFO_TROUVEE».",
  "tools": [
    { "type": "document_library",
      "library_ids": ["0685d6e8-a642-728f-8000-36cc6feba626"] }
  ],
  "handoffs": ["<WEBSEARCH_ID>"]
}
```

### 4.2 Websearch Agent  

```json
{
  "model": "mistral-medium-latest",
  "name": "IAE-Websearch",
  "tools": [{ "type": "web_search" }],
  "instructions": "Query \"site:iae.univ-lyon3.fr {query}\". Cite sources. Si rien: «AUCUN_RESULTAT_WEB».",
  "handoffs": ["<DOCQA_ID>"]
}
```

### 4.3 Document-Q&A Agent (OCR)  

```json
{
  "model": "mistral-medium-latest",
  "name": "IAE-DocQnA",
  "tools": [{ "type": "document_qna" }],
  "instructions": "Analyse les PDFs. Réponds en FR. Cite sections.",
  "handoffs": []
}
```

---

## 5  Conversation & Streaming Flow  

### 5.1 Sequence Diagram (Server-Side Handoffs)

```
User ──► Doc-Library (startStream)
Doc-Library ──► document_library (tool.execution)
alt Info found
    Doc-Library ──► User (message.output)
else No info
    Doc-Library ──► Websearch (agent.handoff)
    Websearch ──► web_search (tool.execution)
    alt PDF found
        Websearch ──► Doc-Q&A (agent.handoff)
        Doc-Q&A ──► document_qna (tool.execution)
    end
end
```

### 5.2 SSE Event Reference  

Event | JSON Payload Keys | Front-End Action
----- | ----------------- | ---------------
`conversation.response.started` | `conversation_id` | Show loading bubble.
`tool.execution.started` | `name`, `output_index` | Spinner on step.
`tool.execution.done` | `name`, `output_index` | Check-mark on step.
`agent.handoff.started` | `agent_id`, `agent_name` | Mark previous step complete, activate next.
`message.output.delta` | `content` (string) | Append token to bubble.
`conversation.response.done` | `usage` | Stop spinner, finalise bubble.

**Parser rule:** accumulate `message.output.delta` chunks **per `output_index`**.

---

## 6  Error Handling & Retry Policy  

HTTP Code | Behaviour | Retry?
--------- | ----------| ------
`408/502/503/504` | Network/server glitch | Retry up to **3** times (0.5 s → 1.5 s → 3 s).
`429` | Rate limit | Retry up to **4** times with exponential back-off; respect `Retry-After`.
`4xx` (other) | Client error | **Do not retry**; surface toast to user.
`stream timeout > 20 s` | Abort & fallback | Attempt non-stream completion once.

`fetchWithRetry` implements this matrix; all service calls must use it.

---

## 7  Testing Patterns  

### 7.1 Unit Tests (Jest + MSW)  

* Mock `/v1/conversations` start and stream endpoints.  
* Provide canned SSE events for happy path and error scenarios.  
* Validate parser produces correct store updates.

### 7.2 Integration (RTL + MSW)  

1. Render `ChatPage`.  
2. User types “Quels masters RH ?”.  
3. Assert:  
   * Loading bubble appears.  
   * Workflow dots update on `agent.handoff.*`.  
   * Assistant bubble shows final text with sources.

### 7.3 E2E (Cypress)  

* Live smoke test (dev key) – throttled frequency.  
* Axe accessibility audit on main screen.  
* Lighthouse CI run in Phase 8.

---

## 8  Security & Compliance  

* **Keys**: stored only in `.env` (dev) or backend; never committed.  
* **Secrets in CI**: GitHub secrets; PRs from forks cannot access.  
* **PII**: Do **not** log user messages; logs include `conversation_id` and usage stats only.  
* **CSP**: `connect-src` must include `https://api.mistral.ai` plus backend proxy.

---

## 9  Rate Limits & Quotas (Reference 2025-Q2 Free Tier)  

Metric | Limit
------ | -----
Requests / sec | 2
Prompt tokens / min | 10 000
Completion tokens / min | 20 000
Max streaming duration | 5 minutes
File upload | 50 MB, 1 000 pages

Back-off strategy in § 6 satisfies these quotas.

---

## 10  Glossary  

Term | Meaning
---- | -------
**Agent** | Config (model, tools, instructions, handoffs) registered once.
**Conversation** | Stateful dialogue instance (`conversation_id`).
**Entry** | Atomic event: message, tool exec, handoff, function call.
**Connector** | Built-in tool (`document_library`, `web_search`, `document_qna`, …).
**SSE** | Server-Sent Events (streaming HTTP).
**Tool Reference Chunk** | `tool_reference` chunk in assistant response, used for citations.

---

### ✅ Conformance Checklist (for code review)

- [ ] All HTTP calls use `fetchWithRetry`.
- [ ] Correct headers (`Authorization`, `Accept`).
- [ ] No call to deprecated `/agents/completions`.
- [ ] SSE parser handles all event types in § 5.2.
- [ ] Retry matrix implemented per § 6.
- [ ] Unit tests mock the exact JSON structures shown in this spec.

*End of Specification*  
