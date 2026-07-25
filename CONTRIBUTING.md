# Contributing to Velora

Velora is built around small, composable primitives and explicit runtime
contracts. Contributions are welcome when they preserve that focus.

## Local workflow

1. Use Node.js 22.18 or newer.
2. Install the unified toolchain from [Vite+](https://viteplus.dev/).
3. Run `vp install`, then `vp dev`.
4. Before opening a change, run `vp check`, `vp test run`, `vp pack`, and
   `vp build`.

## Component expectations

- Expose semantic `classNames` and `styles` slots instead of DOM-dependent
  selectors.
- Support controlled and uncontrolled state where user intent can outlive a
  render, and document the precedence.
- Preserve keyboard, screen-reader, reduced-motion, and touch behavior.
- Keep transport data JSON-safe and never put secrets in message metadata.
- Avoid global state for local presentation. Use the agent store only for
  cross-component conversation state.
- Add a focused test for protocol parsing, state transitions, or interaction
  behavior changed by the contribution.

## Changes

Keep pull requests focused. Public API changes must include an upgrade note in
`CHANGELOG.md` and update the API rationale in `docs/architecture.md`.
