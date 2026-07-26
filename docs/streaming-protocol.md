# Streaming protocol

Velora accepts standard SSE frames over a fetch response. The default adapter
uses the SSE `event` field or the JSON payload's `type` field to select an event.
Provider-specific schemas can supply `parseEvent`.

## Request

`createSSETransport` sends a JSON `ChatRequest` by default:

```json
{
  "requestId": "request-018f",
  "protocolVersion": "1",
  "conversationId": "conversation-1",
  "responseMessageId": "message-2",
  "messages": [],
  "metadata": {}
}
```

Velora also sends `Idempotency-Key` and `X-Velora-Protocol-Version` headers by
default. Request messages contain only provider-facing role, content and
attachments. UI status, reasoning, steps, branches and diagnostic errors are
never copied into provider context by default.

## Frames

```text
id: 1
event: start
data: {"messageId":"provider-message-id"}

event: text-delta
data: {"delta":"Hello"}

event: done
data: {"finishReason":"stop","usage":{"outputTokens":12}}

```

Supported event names are:

| Velora event              | Required payload                                    |
| ------------------------- | --------------------------------------------------- |
| `start`                   | optional `messageId`, `createdAt`                   |
| `text-delta`              | `delta` string                                      |
| `reasoning-summary-delta` | user-visible, policy-safe `delta` string            |
| `reasoning-delta`         | deprecated compatibility event                      |
| `step`                    | complete `step` object                              |
| `step-update`             | `stepId` and partial `patch`                        |
| `tool-call`               | complete `toolCall` with stable ID, name and status |
| `tool-call-update`        | `toolCallId` and partial `patch`                    |
| `message`                 | complete `message` object                           |
| `metadata`                | JSON-safe `metadata` object                         |
| `error`                   | `error.message`, optional code/retryable/details    |
| `done`                    | optional finish reason, usage, and metadata         |

`[DONE]` in a data frame is also recognized. `ping` and `heartbeat` events are
ignored. Error and done events terminate the stream by default.
Set `terminateOnError: false` when the provider uses error frames as recoverable
warnings; those events are forwarded with `terminal: false` and delivered to
`useAgentChat.onWarning` without closing the active response.

Successful responses must declare `Content-Type: text/event-stream`, and the
stream must end with a terminal `done` or terminal `error` event. This makes a
JSON proxy error or a clean-but-truncated connection retryable instead of
silently completing a partial answer. Legacy providers can opt out explicitly
with `validateContentType: false` or `requireTerminalEvent: false`.

Idempotent endpoints can opt into reconnection with
`maxReconnectAttempts`. Velora retains the most recent SSE `id`, sends it as
`Last-Event-ID`, respects the server's `retry` field, and otherwise uses capped
exponential backoff. POST endpoints must deduplicate repeated request IDs before
enabling this policy.

Response headers have a 15-second default timeout. Connected streams also have a
45-second default idle timeout; heartbeat bytes reset that timer. Both values
are configurable.

Tool approval uses the optional `AgentTransport.submitToolDecision` side
channel. The main stream can remain open in `awaiting-approval` while the
application authorizes or rejects the stable tool-call ID.

## Cancellation and batching

The transport receives the runtime's `AbortSignal`. `stop()` flushes buffered text
and reasoning, aborts the fetch, and marks the response as aborted. Text and
reasoning events are committed together every 16 ms by default; set
`streamBatchMs: 0` for immediate commits.
