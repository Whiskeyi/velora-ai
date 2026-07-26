# Performance contract

Velora treats streaming as a continuous workload rather than a sequence of
full-page renders.

## Budgets

- The package build keeps React and rendering engines external so applications
  can deduplicate and split them.
- Base interaction components must remain usable before Mermaid is requested.
- Rich renderers expose granular package subpaths, allowing applications to split
  CodeBlock, Formula, MarkdownRenderer, and MermaidDiagram at feature boundaries
  while keeping the aggregate export backward-compatible.
- Base CSS and rich-content fonts have separate public entries.
- A new text delta may update the active message, its status indicator, and the
  scroll sentinel; completed message rows must not re-render.
- Expensive model output is deferred from the keystroke path.

## Consumer guidance

Create one runtime per agent surface or workspace, retain message IDs as stable
keys, and avoid selecting the entire store from leaf components. For very long
histories, enable
`windowing={{ threshold: 200, overscan: 8 }}` on `MessageList` rather than
truncating source state. The default estimator accounts for message length,
steps, reasoning and tools; products with custom rows can provide a
per-message `estimateRowHeight`. Observe `onWindowChange` in performance tests. Keep
`renderMessage` referentially stable (for example, with `useCallback`) so the
memoized row boundary can preserve completed siblings. Stop the runtime
explicitly when the workflow—not merely one observing React view—ends.

Run production traces with a realistic token cadence, long code blocks, and at
least one diagram. Development-mode React timings include intentional checks
and should not be used as final performance numbers.
