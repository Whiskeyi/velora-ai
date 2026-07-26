# Showcase composition

The showcase is an application of the public package, not a second component
implementation.

- `component-docs.ts` owns API reference content.
- `samples.tsx` owns runnable component examples.
- `demo-fixtures.ts` owns deterministic conversations, messages, and locale projections.
- `demo-transport.ts` owns the live SSE/static mock transport selection.
- `lazy-components.ts` owns optional editor and rich-content chunks.
- `prop-description.ts` maps documented API aliases to table descriptions.
- `routing.ts` owns base-path-safe site links.
- `use-showcase-locale.ts` owns explicit locale resolution and persistence.
- `use-showcase-theme.ts` owns system-aware theme resolution and explicit preference persistence.
- `showcase-client.tsx` composes page sections and interactive demo state.

Keep examples on public `@velora-ai/react` entrypoints. Reusable behavior belongs
in `packages/react`; documentation-only layout and copy stay in the showcase.
`npm run verify:architecture` enforces an acyclic showcase graph and prevents
infrastructure helpers from depending back on the page composition root.
