import { COMPONENT_KEYS, type SampleKey } from "../component-registry";
import type { Sample, SampleMeta } from "./model";

const componentNames: Readonly<Record<SampleKey, string>> = {
  "agent-shell": "AgentShell",
  "velora-provider": "VeloraProvider",
  "conversation-list": "ConversationList",
  "prompt-composer": "PromptComposer",
  "message-bubble": "MessageBubble",
  "message-actions": "MessageActions",
  "message-branch-navigator": "MessageBranchNavigator",
  "message-list": "MessageList",
  "reasoning-panel": "ReasoningPanel",
  "agent-steps": "AgentSteps",
  "code-block": "CodeBlock",
  formula: "Formula",
  "markdown-renderer": "MarkdownRenderer",
  "mermaid-diagram": "MermaidDiagram",
  "streaming-indicator": "StreamingIndicator",
  "tool-call-card": "ToolCallCard",
};

export const SHOWCASE_SAMPLES: readonly SampleMeta[] = COMPONENT_KEYS.map((key) => ({
  key,
  name: componentNames[key],
}));

export const SHOWCASE_SAMPLE_BY_KEY = Object.fromEntries(
  SHOWCASE_SAMPLES.map((sample) => [sample.key, sample]),
) as Readonly<Record<SampleKey, SampleMeta>>;

let samplePromise: Promise<readonly Sample[]> | undefined;

async function loadSamples(): Promise<readonly Sample[]> {
  samplePromise ??= import("./samples-data.mjs").then((module) => module.SHOWCASE_SAMPLES);
  return samplePromise;
}

export async function loadShowcaseSample(key: SampleKey): Promise<Sample> {
  const samples = await loadSamples();
  const sample = samples.find((candidate) => candidate.key === key);
  if (!sample) throw new Error(`Unknown showcase sample: ${key}`);
  return sample;
}
