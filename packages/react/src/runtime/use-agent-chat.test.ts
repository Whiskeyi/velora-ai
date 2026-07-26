import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createMockTransport } from "./mock";
import { createAgentStore } from "./store";
import { useAgentChat, type UseAgentChatResult } from "./use-agent-chat";
import type { AgentTransport, VeloraIdFactory } from "./types";

function renderChat(
  transport: AgentTransport,
  options: { readonly streamBatchMs?: number } = {},
): UseAgentChatResult {
  let counter = 0;
  const idFactory: VeloraIdFactory = (kind) => `${kind}-${(counter += 1)}`;
  const store = createAgentStore({ idFactory, now: () => counter });
  let result: UseAgentChatResult | undefined;

  function Harness() {
    result = useAgentChat({
      transport,
      store,
      conversationId: "conversation-test",
      idFactory,
      now: () => counter,
      streamBatchMs: options.streamBatchMs,
    });
    return null;
  }

  renderToString(createElement(Harness));
  if (!result) {
    throw new Error("The hook did not render");
  }
  return result;
}

describe("useAgentChat", () => {
  it("streams send and retry into normalized messages", async () => {
    const chat = renderChat(
      createMockTransport({
        response: ({ lastUserMessage }) => `Reply: ${lastUserMessage?.content}`,
        chunkSize: 2,
      }),
    );

    const firstRun = chat.send("Hello");
    expect(firstRun).toMatchObject({
      accepted: true,
    });
    if (!firstRun.accepted) throw new Error("Expected the send to start");
    await expect(firstRun.completion).resolves.toMatchObject({ outcome: "complete" });
    let state = chat.store.getState();
    const firstIds = state.conversationsById[chat.conversationId]?.messageIds ?? [];
    expect(firstIds).toHaveLength(2);
    expect(state.messagesById[firstIds[1] ?? ""]?.content).toBe("Reply: Hello");
    expect(state.messagesById[firstIds[1] ?? ""]?.status).toBe("complete");

    const retryRun = chat.retry();
    expect(retryRun).toMatchObject({
      accepted: true,
    });
    if (!retryRun.accepted) throw new Error("Expected the retry to start");
    await expect(retryRun.completion).resolves.toMatchObject({ outcome: "complete" });
    state = chat.store.getState();
    const retryIds = state.conversationsById[chat.conversationId]?.messageIds ?? [];
    expect(retryIds).toHaveLength(3);
    expect(state.messagesById[retryIds[2] ?? ""]?.parentId).toBe(firstIds[0]);
  });

  it("rejects concurrent sends and aborts the active stream", async () => {
    const chat = renderChat(createMockTransport({ response: "slow response", delayMs: 50 }));

    const first = chat.send("first");
    expect(chat.send("second")).toEqual({
      accepted: false,
      reason: "busy",
    });
    expect(chat.stop()).toBe(true);
    if (!first.accepted) throw new Error("Expected the first send to start");
    await expect(first.completion).resolves.toMatchObject({ outcome: "aborted" });

    const state = chat.store.getState();
    const ids = state.conversationsById[chat.conversationId]?.messageIds ?? [];
    expect(ids).toHaveLength(2);
    expect(state.messagesById[ids[1] ?? ""]?.status).toBe("aborted");
    expect(state.runsByConversation[chat.conversationId]).toBeUndefined();
  });

  it("coalesces deltas by default and can disable batching", async () => {
    const events = [
      { type: "text-delta", delta: "a" },
      { type: "reasoning-delta", delta: "b" },
      { type: "text-delta", delta: "c" },
      { type: "done", finishReason: "stop" },
    ] as const;
    const batched = renderChat(createMockTransport({ events }));
    const batchedRun = batched.send("batch");
    if (!batchedRun.accepted) throw new Error("Expected the batched send to start");
    await batchedRun.completion;
    expect(batched.store.getState().messageVersionByConversation[batched.conversationId]).toBe(4);

    const immediate = renderChat(createMockTransport({ events }), {
      streamBatchMs: 0,
    });
    const immediateRun = immediate.send("immediate");
    if (!immediateRun.accepted) throw new Error("Expected the immediate send to start");
    await immediateRun.completion;
    expect(immediate.store.getState().messageVersionByConversation[immediate.conversationId]).toBe(
      6,
    );
  });

  it("flushes buffered text before stop marks the message aborted", async () => {
    let markWaiting: (() => void) | undefined;
    const waiting = new Promise<void>((resolve) => {
      markWaiting = resolve;
    });
    const transport: AgentTransport = {
      async *stream(_request, options) {
        yield {
          type: "step",
          step: {
            id: "compose",
            title: "Compose response",
            status: "running",
            startedAt: 1,
          },
        };
        yield { type: "text-delta", delta: "partial" };
        markWaiting?.();
        await new Promise<void>((resolve) => {
          options?.signal?.addEventListener("abort", () => resolve(), {
            once: true,
          });
        });
      },
    };
    const chat = renderChat(transport, { streamBatchMs: 1_000 });
    const pending = chat.send("stop me");
    if (!pending.accepted) throw new Error("Expected the send to start");
    await waiting;
    expect(chat.stop()).toBe(true);
    await expect(pending.completion).resolves.toMatchObject({ outcome: "aborted" });

    const state = chat.store.getState();
    const ids = state.conversationsById[chat.conversationId]?.messageIds ?? [];
    expect(state.messagesById[ids[1] ?? ""]?.content).toBe("partial");
    expect(state.messagesById[ids[1] ?? ""]?.status).toBe("aborted");
    expect(state.messagesById[ids[1] ?? ""]?.steps?.[0]).toMatchObject({
      id: "compose",
      status: "cancelled",
    });
    expect(state.messagesById[ids[1] ?? ""]?.steps?.[0]?.completedAt).toEqual(expect.any(Number));
  });

  it("accepts synchronously and preserves the exact submitted text and attachments", async () => {
    let capturedContent = "";
    let capturedAttachment = "";
    const transport: AgentTransport = {
      async *stream(request) {
        const last = request.messages.at(-1);
        capturedContent = last?.content ?? "";
        capturedAttachment = last?.attachments?.[0]?.name ?? "";
        yield { type: "done" };
      },
    };
    const chat = renderChat(transport);
    const result = chat.send("\n  const answer = 42;\n", {
      attachments: [{ id: "spec", name: "spec.md", kind: "file" }],
    });

    expect(result.accepted).toBe(true);
    const stateImmediatelyAfterSend = chat.store.getState();
    const ids = stateImmediatelyAfterSend.conversationsById[chat.conversationId]?.messageIds ?? [];
    expect(ids).toHaveLength(2);
    expect(stateImmediatelyAfterSend.messagesById[ids[0] ?? ""]?.content).toBe(
      "\n  const answer = 42;\n",
    );
    if (!result.accepted) throw new Error("Expected the send to start");
    await result.completion;
    expect(capturedContent).toBe("\n  const answer = 42;\n");
    expect(capturedAttachment).toBe("spec.md");
  });

  it("accepts attachment-only requests and strips UI state from provider messages", async () => {
    let captured: unknown;
    const transport: AgentTransport = {
      async *stream(request) {
        captured = request.messages.at(-1);
        yield { type: "done" };
      },
    };
    const chat = renderChat(transport);
    const result = chat.send("", {
      attachments: [{ id: "image", name: "reference.png", kind: "image" }],
      metadata: { localPreview: true },
    });
    expect(result.accepted).toBe(true);
    if (!result.accepted) throw new Error("Expected the attachment send to start");
    await result.completion;
    expect(captured).toEqual({
      role: "user",
      content: "",
      attachments: [{ id: "image", name: "reference.png", kind: "image" }],
    });
  });

  it("persists the fallback error for error messages without a payload", async () => {
    const transport: AgentTransport = {
      async *stream(request) {
        yield {
          type: "message",
          message: {
            id: request.responseMessageId,
            conversationId: request.conversationId,
            role: "assistant",
            content: "",
            status: "error",
            createdAt: 1,
            updatedAt: 2,
          },
        };
      },
    };
    const chat = renderChat(transport);
    const result = chat.send("trigger an error");
    if (!result.accepted) throw new Error("Expected the send to start");

    await expect(result.completion).resolves.toMatchObject({
      outcome: "error",
      error: { message: "The agent returned an error message" },
    });
    const response = chat.store.getState().messagesById[result.responseMessageId];
    expect(response?.status).toBe("error");
    expect(response?.error).toEqual({ message: "The agent returned an error message" });
  });
});
