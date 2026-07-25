import { describe, expect, it } from "vitest";

import {
  createAgentStore,
  selectConversationMessages,
  selectConversations,
} from "./store";
import type { AgentMessage } from "./types";

function message(
  id: string,
  conversationId: string,
  content = "",
): AgentMessage {
  return {
    id,
    conversationId,
    role: "assistant",
    content,
    status: "streaming",
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("createAgentStore", () => {
  it("keeps normalized updates immutable", () => {
    let time = 10;
    const store = createAgentStore({ now: () => (time += 1) });
    store.getState().createConversation({ id: "a" });
    store.getState().appendMessages([message("a-1", "a", "one")]);

    const before = store.getState();
    const beforeMessage = before.messagesById["a-1"];
    store.getState().appendMessageText("a-1", " two");
    const after = store.getState();

    expect(after).not.toBe(before);
    expect(after.messagesById["a-1"]).not.toBe(beforeMessage);
    expect(beforeMessage?.content).toBe("one");
    expect(after.messagesById["a-1"]?.content).toBe("one two");
  });

  it("preserves selector references for unrelated conversations", () => {
    const store = createAgentStore();
    store.getState().createConversation({ id: "a" });
    store.getState().createConversation({ id: "b" });
    store.getState().appendMessages([
      message("a-1", "a", "a"),
      message("b-1", "b", "b"),
    ]);
    const selectA = selectConversationMessages("a");
    const first = selectA(store.getState());

    store.getState().appendMessageText("b-1", " changed");
    expect(selectA(store.getState())).toBe(first);
    store.getState().appendMessageText("a-1", " changed");
    expect(selectA(store.getState())).not.toBe(first);
  });

  it("keeps the ordered conversation selector stable on message deltas", () => {
    const store = createAgentStore();
    store.getState().createConversation({ id: "a" });
    store.getState().appendMessages([message("a-1", "a")]);
    const selector = selectConversations();
    const first = selector(store.getState());
    store.getState().appendMessageText("a-1", "delta");
    expect(selector(store.getState())).toBe(first);
    store.getState().patchConversation("a", { title: "Renamed" });
    expect(selector(store.getState())).not.toBe(first);
  });

  it("atomically prevents concurrent runs and ignores stale completions", () => {
    const store = createAgentStore();
    store.getState().createConversation({ id: "a" });
    const first = {
      requestId: "request-1",
      responseMessageId: "message-1",
      startedAt: 1,
    };
    expect(store.getState().beginRun("a", first)).toBe(true);
    expect(
      store.getState().beginRun("a", {
        requestId: "request-2",
        responseMessageId: "message-2",
        startedAt: 2,
      }),
    ).toBe(false);

    store.getState().finishRun("a", "stale-request");
    expect(store.getState().runsByConversation.a?.requestId).toBe("request-1");
    store.getState().finishRun("a", "request-1");
    expect(store.getState().runsByConversation.a).toBeUndefined();
  });

  it("removes messages together with their conversation", () => {
    const store = createAgentStore();
    store.getState().createConversation({ id: "a" });
    store.getState().appendMessages([message("a-1", "a")]);
    store.getState().removeConversation("a");
    expect(store.getState().conversationsById.a).toBeUndefined();
    expect(store.getState().messagesById["a-1"]).toBeUndefined();
  });
});
