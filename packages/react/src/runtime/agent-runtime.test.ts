import { describe, expect, it } from "vitest";

import { createAgentRuntime } from "./agent-runtime";
import type { AgentToolDecision, AgentTransport } from "./types";

describe("createAgentRuntime", () => {
  it("keeps a run alive for a tool decision and resumes it through the command channel", async () => {
    let release: (() => void) | undefined;
    const decisionReceived = new Promise<void>((resolve) => {
      release = resolve;
    });
    let submitted: AgentToolDecision | undefined;
    const transport: AgentTransport = {
      async *stream() {
        yield {
          type: "tool-call",
          toolCall: {
            id: "tool-1",
            name: "write_file",
            status: "approval-required",
          },
        };
        await decisionReceived;
        yield {
          type: "tool-call-update",
          toolCallId: "tool-1",
          patch: { status: "complete", result: { written: true } },
        };
        yield { type: "done" };
      },
      async submitToolDecision(decision) {
        submitted = decision;
        release?.();
      },
    };
    const runtime = createAgentRuntime({ transport, streamBatchMs: 0 });
    const result = runtime.send("conversation-1", "Write the release notes");
    if (!result.accepted) throw new Error("Expected the run to start");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runtime.store.getState().runsByConversation["conversation-1"]?.status).toBe(
      "awaiting-approval",
    );
    await expect(runtime.approveToolCall("conversation-1", "tool-1")).resolves.toEqual({
      accepted: true,
    });
    await expect(result.completion).resolves.toMatchObject({ outcome: "complete" });
    expect(submitted).toMatchObject({
      requestId: result.requestId,
      conversationId: "conversation-1",
      toolCallId: "tool-1",
      decision: "approve",
    });
  });
});
