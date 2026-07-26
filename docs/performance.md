# Performance contract

Velora treats streaming as a continuous workload rather than a sequence of
full-page renders.

## Budgets

- The package build keeps React and rendering engines external so applications
  can deduplicate and split them.
- Base interaction components must remain usable before Mermaid is requested.
- A new text delta may update the active message, its status indicator, and the
  scroll sentinel; completed message rows must not re-render.
- Expensive model output is deferred from the keystroke path.

## Consumer guidance

Create one store per agent surface or workspace, retain message IDs as stable
keys, and avoid selecting the entire store from leaf components. For very long
histories, enable
`windowing={{ threshold: 200, estimateRowHeight: 112, overscan: 8 }}` on
`MessageList` rather than truncating source state. Tune the row estimate against
real content and observe `onWindowChange` in performance tests. Keep
`renderMessage` referentially stable (for example, with `useCallback`) so the
memoized row boundary can preserve completed siblings. Abort the active
transport when its owning surface is unmounted.

Run production traces with a realistic token cadence, long code blocks, and at
least one diagram. Development-mode React timings include intentional checks
and should not be used as final performance numbers.
