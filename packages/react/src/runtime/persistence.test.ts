import { describe, expect, it } from "vitest";

import { createAgentStoreFromSnapshot, loadAgentStore, snapshotAgentStore } from "./persistence";
import { createAgentStore } from "./store";

describe("AgentStore persistence adapters", () => {
  it("round-trips durable data without persisting active runs", async () => {
    const store = createAgentStore();
    const conversationId = store.getState().createConversation({ id: "conversation-1" });
    store.getState().appendMessages([
      {
        id: "message-1",
        conversationId,
        role: "user",
        content: "Persist me",
        status: "complete",
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    store.getState().beginRun(conversationId, {
      requestId: "request-1",
      responseMessageId: "response-1",
      startedAt: 2,
    });

    const snapshot = snapshotAgentStore(store);
    const restored = createAgentStoreFromSnapshot(snapshot);
    expect(restored.getState().messagesById["message-1"]?.content).toBe("Persist me");
    expect(restored.getState().runsByConversation).toEqual({});

    const loaded = await loadAgentStore({
      load: () => snapshot,
      save: () => undefined,
    });
    expect(loaded.getState().conversationOrder).toEqual(["conversation-1"]);
  });
});
