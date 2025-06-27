# Mistral AI Agents API – Comprehensive Developer Guide

> **Audience**  AI / LLM developers who want to build production-grade autonomous agents with Mistral AI.

---

## 1  Overview & High-Level Architecture
Mistral AI’s *Agents API* adds orchestration, tool-use and stateful conversations on top of the raw chat/completions endpoint.

```
┌────────────┐      ┌────────────┐      ┌───────────┐
│  Client    │──────│  Agents    │──────│  Models   │
└────────────┘ REST  └────────────┘ tools, memory   └───────────┘
        ▲  ▲                       ▲
        │  └── Connectors (web, code, docs, images)
        │
   Your service / UI
```

Key pillars:

| Layer | Responsibility |
|-------|----------------|
| **Agents** | Store configuration (model, tools, handoffs, instructions). |
| **Conversations** | Persist dialogue & tool events. |
| **Entries** | Atomic events (messages, tool executions, function calls, handoffs…). |
| **Connectors** | Built-in tools: `web_search`, `document_library`, `code_interpreter`, `image_generation`. |
| **Custom tools** | Your own functions via Function Calling. |

---

## 2  Authentication & Environment Setup

1. Generate a key in *La Plateforme* → **API Keys**.
2. **Never** hard-code keys. Store in `.env` (server) or secrets manager.

`.env` template (minimum):

```
MISTRAL_API_KEY=sk-********************************
MISTRAL_API_BASE_URL=https://api.mistral.ai/v1   # optional override
```

Typical loader:

```python
from dotenv import load_dotenv; load_dotenv()
import os
api_key = os.environ["MISTRAL_API_KEY"]
```

```ts
import 'dotenv/config';
const apiKey = process.env.MISTRAL_API_KEY!;
```

---

## 3  SDK Installation

| Language | Package | Install |
|----------|---------|---------|
| Python ≥3.9 | `mistralai` | `pip install mistralai python-dotenv` |
| TypeScript / Node ≥18 | `@mistralai/mistralai` | `npm i @mistralai/mistralai dotenv` or `pnpm add` |

> Both SDKs expose **Clients**, **Agents**, **Conversations**, **Files**, **Jobs**, …  
> For other stacks use plain HTTPS with the same JSON payloads.

---

## 4  Core Concepts

### 4.1  Agents
```python
agent = client.beta.agents.create(
    model="mistral-medium-latest",
    name="faq-agent",
    description="Answers product FAQs using web + docs",
    tools=[{"type": "web_search"}, {"type":"document_library","library_ids":["<lib_id>"]}],
    instructions="Be concise and cite sources."
)
```

*Versioning* – each update bumps `version` and keeps history.

### 4.2  Conversations & Entries
```python
conv = client.beta.conversations.start(
    agent_id=agent.id,
    inputs="Who won Euro 2024?"
)
# conv.outputs contains tool execution then assistant answer
```

`append()`, `restart()`, and `*Stream()` variants manage dialogue continuations.

---

## 5  Built-in Connectors

### 5.1  Web Search
Enable real-time retrieval with citations.

```ts
const webAgent = await client.beta.agents.create({
  model:"mistral-medium-latest",
  name:"news-bot",
  tools:[{type:"web_search"}]
});
```

**Sample usage**
```ts
const res = await client.beta.conversations.start({
  agentId: webAgent.id,
  inputs:"Latest SpaceX launch?"
});
```

Parse `tool_reference` chunks for source URLs.

### 5.2  Document Library (beta)
RAG over files you uploaded to a library.

```python
lib_agent = client.beta.agents.create(
    model="mistral-medium-2505",
    name="policy-bot",
    tools=[{"type":"document_library","library_ids":["06835a9c-262c-7e83-8000-594d29fe2948"]}]
)
```

### 5.3  Code Interpreter
Execute Python for data analysis or graphing.

```ts
const graphAgent = await client.beta.agents.create({
  model:"mistral-large-latest",
  tools:[{type:"code_interpreter"}],
  instructions:"Use code interpreter to plot when asked."
});
```

### 5.4  Image Generation
```python
img_agent = client.beta.agents.create(
    model="mistral-large-latest",
    tools=[{"type":"image_generation"}]
)
```

---

## 6  Function Calling – Custom Tools

1. Define local function.
2. Describe JSON schema when creating the agent.
3. Detect `function.call` entry, run locally, append `function.result`.

```python
def get_stock_price(ticker:str)->dict: ...
schema = {
 "name":"get_stock_price",
 "description":"Fetch price.",
 "parameters":{
   "type":"object",
   "properties":{"ticker":{"type":"string"}},
   "required":["ticker"]
 }
}

agent = client.beta.agents.create(
    model="mistral-large-latest",
    tools=[{"type":"function","function":schema}]
)
```

Runtime loop (Python):

```python
resp = client.beta.conversations.start(agent_id=agent.id,
                                       inputs="Price of AAPL?")
call = resp.outputs[-1]
if call.type=="function.call":
    result = get_stock_price(**json.loads(call.arguments))
    entry = FunctionResultEntry(tool_call_id=call.tool_call_id,
                                result=json.dumps(result))
    final = client.beta.conversations.append(
        conversation_id=resp.conversation_id,
        inputs=[entry]
    )
```

---

## 7  Handoffs – Multi-Agent Workflows
Chain specialised agents.

```python
# finance -> web search OR ecb-interest-rate
client.beta.agents.update(agent_id=finance.id,
                          handoffs=[web.id, ecb.id])

resp = client.beta.conversations.start(agent_id=finance.id,
        inputs="Plot ECB rate evolution 2010-2024")
# Server automatically passes conversation to ecb agent, then to graph agent
```

`handoff_execution`:  
* `server` (default) – handled in cloud.  
* `client` – you manage on your side.

---

## 8  Streaming Responses
```python
stream = client.beta.conversations.start_stream(
    agent_id=webAgent.id,
    inputs="Summarise today's AI news."
)
for chunk in stream:
    if chunk.type=="message.output.delta":
        print(chunk.content, end="", flush=True)
```

Event types: `conversation.response.started/done`, `message.output.delta`, `tool.execution.*`, `function.call.delta`, `agent.handoff.*`.

---

## 9  Error Handling & Common Codes

| Code | Meaning | Fix |
|------|---------|-----|
| 400 Bad Request | Invalid params/model | Validate payload, model name. |
| 401 Unauthorized | Missing/Wrong key | Load from `.env`, use Bearer header. |
| 404 Not Found | Resource, model or URL invalid | Check IDs / endpoint. |
| 429 Too Many Requests | Rate limit hit | Exponential back-off, monitor quotas. |
| 5xx | Server error | Retry with jitter. |

SDK helper:

```ts
try { ... }
catch (e:any) {
  if (e.status===429) await wait(2000)
}
```

---

## 10  Rate Limiting & Pricing

| Tier | RPS | Tokens / min | Notes |
|------|-----|--------------|-------|
| **Free** | low (≈2 RPS) | few K | Exploration only |
| **Pro / Enterprise** | higher | 10-100× | SLA 99.95 % |

Pricing (2025-06):

| Model | Input $/M | Output $/M | Context |
|-------|-----------|-----------|---------|
| `mistral-large-latest` | 2.00 | 6.00 | 128k |
| `mistral-medium-latest`| 0.40 | 2.00 | 128k |
| `codestral-latest` | 0.30 | 0.90 | 256k |

Performance: **420 ms** time-to-first-token, **82.3 %** multi-tool accuracy.

---

## 11  Security Best Practices
* Keep `MISTRAL_API_KEY` in env/secrets; never commit.
* Rotate keys periodically; use per-service keys.
* Apply least-privilege: separate dev vs prod workspaces.
* Validate content-type of HTTP errors (Next.js HTML issue).
* Sandbox code execution (when using `code_interpreter`) if running hand-offs client side.
* Monitor usage & set alerts to detect abuse.

---

## 12  End-to-End Example (Python)

```python
# .env already loaded
from mistralai import Mistral, FunctionResultEntry
import json, os

client = Mistral(os.environ["MISTRAL_API_KEY"])

# 1. Agent with web + custom function
schema = {...}  # get_stock_price schema (see Section 6)
agent = client.beta.agents.create(
    model="mistral-medium-latest",
    name="fin-bot",
    tools=[{"type":"web_search"},
           {"type":"function","function":schema}]
)

# 2. Ask a question
resp = client.beta.conversations.start(agent_id=agent.id,
                                       inputs="Current TSLA price and last news?")
call = resp.outputs[-1]

# 3. Handle function call then append result
if call.type=="function.call":
    price = get_stock_price(**json.loads(call.arguments))
    entry = FunctionResultEntry(tool_call_id=call.tool_call_id,
                                result=json.dumps(price))
    final = client.beta.conversations.append(
        conversation_id=resp.conversation_id,
        inputs=[entry]
    )
print(final.outputs[-1].content)
```

Same pattern in TypeScript:

```ts
import { Mistral, FunctionResultEntry } from "@mistralai/mistralai";
import 'dotenv/config';
const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
...
```

---

## 13  Production Deployment Considerations
| Aspect | Recommendation |
|--------|----------------|
| **HTTP Client** | Use keep-alive & HTTP/2 for low latency. |
| **Retries** | Retry idempotent calls (jitter, max 3). |
| **Autoscaling** | Scale on tokens/min not RPS. |
| **Streaming** | Use Server-Sent Events or WebSockets to pipe deltas to frontend. |
| **Observability** | Log `conversation_id`, `agent_id`, token usage, and `tool` counts. |
| **Version control** | Pin agent `version` in production to avoid breaking changes. |
| **Compliance** | Store user data only if required; consider `store=False` for privacy. |

---

## 14  Troubleshooting Checklist
1. **400 / Invalid model** → verify model spelling (`mistral-medium-latest`).
2. **401** → `MISTRAL_API_KEY` missing in runtime container.
3. **429** → exceeded workspace tier; batch requests or upgrade.
4. **Tool call loops** → ensure your function returns JSON **string**, not object.
5. **Streaming stalls** → keep SSE connection alive (proxy timeouts).

---

## 15  Additional Resources
* Official docs: <https://docs.mistral.ai/>
* TypeScript SDK: <https://github.com/mistralai/client-ts>
* Python SDK: <https://github.com/mistralai/client-python>
* Help Center (rate limits): <https://help.mistral.ai/>

---

### 🚀 Start Building
With agents, built-in connectors, custom tools and robust SDKs, you can move from raw LLM calls to fully autonomous, multi-tool workflows in a few lines of code. Happy hacking!
