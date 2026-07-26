# Architecture

Velora separates the AI data plane from the presentation plane. A product can
replace either side without rewriting the other.

## Data flow

`AgentTransport` exposes one operation: stream a typed `ChatRequest` as an
`AsyncIterable<AgentStreamEvent>`. `createSSETransport` adapts a real fetch
endpoint. `createMockTransport` follows the same contract for examples, tests,
and prototypes. The React hook consumes either transport and commits normalized
changes to the store. Components subscribe only to the slices they render.

Events distinguish assistant text, reasoning, steps, typed tool calls, metadata,
recoverable warnings, terminal usage, and failures. This prevents UI code from parsing provider-specific
payloads and makes abort/retry behavior deterministic.
`createAgentRuntime` owns requests independently of React; `useAgentChat`
subscribes a view to one conversation and does not stop a run merely because
that view unmounts.

## State ownership

- A composer owns only ephemeral draft and composition state unless `value` is
  controlled by its parent.
- Conversation and message state belongs to a per-runtime Zustand vanilla
  store. There is no process-wide singleton.
- Presentation state such as an expanded reasoning panel stays local or follows
  the component's controlled prop.
- Server data is represented as JSON-safe readonly values. Store actions create
  new references only for entities that changed.

## Component contracts

Public components use `forwardRef`, native element props where safe, explicit
event payloads, and semantic styling slots. Consumers can style stable regions
such as `root`, `content`, or `actions` without relying on private DOM order.
Every interactive primitive has a keyboard path, an accessible name, visible
focus, and a reduced-motion fallback.

## Rendering strategy

- Message rows are memoized by identity; appending a delta does not invalidate
  completed siblings.
- Long conversations can opt into estimated, overscanned `MessageList`
  windowing without truncating runtime state.
- Streaming Markdown defers expensive parsing and isolates code, math, and
  diagram renderers.
- Mermaid loads on demand and caches the source-to-diagram result.
- Auto-scroll follows the stream only while the reader remains near the end;
  manually scrolling upward transfers control back to the reader.
- Store selectors are intentionally narrow. Consumers should select IDs first,
  then subscribe to individual entities.

## Styling and theming

`VeloraProvider` publishes design tokens through CSS custom properties. The
default theme is neutral and product-safe; the showcase composes those tokens
into a more expressive liquid-glass surface. Velora-owned CSS selectors use
the `vl-` prefix and never target consumer element names globally. Base
component styles do not load KaTeX fonts; products that render formulas opt
into `@velora-ai/react/rich-content.css` separately.
