# Runtime internals

This folder is ordered from stable contracts to framework integration:

1. `types.ts` defines the public protocol.
2. `abort.ts`, `sse.ts`, `transport.ts`, and `mock.ts` implement the wire layer.
3. `store.ts` and `persistence.ts` own normalized state.
4. `stream-events.ts` reduces one typed event into a state transition.
5. `agent-runtime.ts` owns run lifecycle, batching, cancellation, and callbacks.
6. `use-agent-chat.ts` adapts the headless runtime to React.

`index.ts` deliberately excludes `use-agent-chat.ts`. The
`@velora-ai/react/runtime` entry must remain usable in server code without a
React dependency. Client code can import the hook through
`@velora-ai/react/hooks` or the convenience root.

Run `npm run verify:architecture` after changing dependencies in this folder.
Its allowlist documents and enforces the permitted edges between runtime
modules.
