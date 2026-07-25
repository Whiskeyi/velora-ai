export const COMPONENT_KEYS = [
  "agent-shell",
  "velora-provider",
  "conversation-list",
  "prompt-composer",
  "message-bubble",
  "message-actions",
  "message-branch-navigator",
  "message-list",
  "reasoning-panel",
  "agent-steps",
  "code-block",
  "formula",
  "markdown-renderer",
  "mermaid-diagram",
  "streaming-indicator",
  "tool-call-card",
] as const;

export type SampleKey = (typeof COMPONENT_KEYS)[number];

const componentKeySet: ReadonlySet<string> = new Set(COMPONENT_KEYS);

export function isSampleKey(value: string): value is SampleKey {
  return componentKeySet.has(value);
}
