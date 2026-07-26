# Showcase composition

The showcase is an application of the public package, not a second component
implementation.

- `component-docs.ts` owns API reference content.
- `samples.tsx` owns runnable component examples.
- `lazy-components.ts` owns optional editor and rich-content chunks.
- `routing.ts` owns base-path-safe site links.
- `use-showcase-locale.ts` owns browser locale detection and persistence.
- `showcase-client.tsx` composes page sections and interactive demo state.

Keep examples on public `@velora-ai/react` entrypoints. Reusable behavior belongs
in `packages/react`; documentation-only layout and copy stay in the showcase.
