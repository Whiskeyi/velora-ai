import { createMockTransport, createSSETransport } from "@velora-ai/react/runtime";
import type { Locale } from "./model";

export interface DemoAgentCopy {
  readonly reasoning: string;
  readonly responseLead: string;
  readonly responseNote: string;
  readonly responsePoints: readonly [string, string, string];
  readonly responseTitle: string;
  readonly stepCompose: string;
  readonly stepComposeDescription: string;
  readonly stepIntent: string;
  readonly stepIntentDescription: string;
}

export function createDemoTransport(locale: Locale, copy: DemoAgentCopy) {
  const isStaticDemo =
    typeof document !== "undefined" &&
    document.documentElement.dataset.veloraDemoTransport === "mock";

  if (!isStaticDemo) {
    return createSSETransport({ url: "/api/demo/stream" });
  }

  return createMockTransport({
    initialDelayMs: 120,
    chunkSize: [2, 4, 3, 5],
    reasoningChunkSize: [10, 14, 8],
    delayMs: ({ event }) => {
      if (event.type === "text-delta") return 20;
      if (event.type === "reasoning-delta" || event.type === "reasoning-summary-delta") {
        return 72;
      }
      if (event.type === "step") return 90;
      return 36;
    },
    response: ({ lastUserMessage }) => {
      const subject = lastUserMessage?.content.trim().slice(0, 120) || "this interface request";
      const completedAt = Date.now();

      return {
        content: [
          `${copy.responseLead}\n\n> ${subject}`,
          `\n\n**${copy.responseTitle}**\n\n`,
          `1. ${copy.responsePoints[0]}\n`,
          `2. ${copy.responsePoints[1]}\n`,
          `3. ${copy.responsePoints[2]}\n\n`,
          "```tsx\n<AgentShell composer={<PromptComposer onSubmit={send} />} />\n```\n\n",
          copy.responseNote,
        ].join(""),
        reasoning: copy.reasoning,
        steps: [
          {
            id: "intent",
            title: copy.stepIntent,
            status: "complete",
            description: copy.stepIntentDescription,
            startedAt: completedAt - 420,
            completedAt: completedAt - 180,
          },
          {
            id: "compose",
            title: copy.stepCompose,
            status: "complete",
            description: copy.stepComposeDescription,
            startedAt: completedAt - 170,
            completedAt,
          },
        ],
        metadata: { adapter: "velora-demo-mock", locale },
      };
    },
  });
}
