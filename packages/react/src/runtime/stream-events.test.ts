import { describe, expect, it } from "vitest";

import { createAgentStore } from "./store";
import { applyAgentStreamEvent } from "./stream-events";

function createRunningStore() {
  const store = createAgentStore({ now: () => 10 });
  store.getState().createConversation({ id: "conversation-1" });
  store.getState().appendMessages([
    {
      id: "assistant-1",
      conversationId: "conversation-1",
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: 1,
      updatedAt: 1,
    },
  ]);
  store.getState().beginRun("conversation-1", {
    requestId: "request-1",
    responseMessageId: "assistant-1",
    startedAt: 1,
  });
  return store;
}

const target = {
  conversationId: "conversation-1",
  requestId: "request-1",
  responseMessageId: "assistant-1",
} as const;

describe("applyAgentStreamEvent", () => {
  it("keeps protocol state transitions independent from transport consumption", () => {
    const store = createRunningStore();

    expect(
      applyAgentStreamEvent(store, target, {
        type: "tool-call",
        toolCall: {
          id: "tool-1",
          name: "write_file",
          status: "approval-required",
        },
      }),
    ).toEqual({ kind: "continue" });
    expect(store.getState().runsByConversation["conversation-1"]?.status).toBe(
      "awaiting-approval",
    );
  });

  it("returns terminal outcomes after committing completion metadata", () => {
    const store = createRunningStore();

    expect(
      applyAgentStreamEvent(store, target, {
        type: "done",
        finishReason: "stop",
        usage: { totalTokens: 12 },
      }),
    ).toEqual({ kind: "terminal", outcome: "complete" });
    expect(store.getState().runsByConversation["conversation-1"]).toBeUndefined();
    expect(store.getState().messagesById["assistant-1"]).toMatchObject({
      status: "complete",
      metadata: {
        finishReason: "stop",
        usage: { totalTokens: 12 },
      },
    });
  });
});
