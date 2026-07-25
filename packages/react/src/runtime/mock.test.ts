import { describe, expect, it } from "vitest";

import { createMockTransport } from "./mock";
import type { AgentStreamEvent, ChatRequest } from "./types";

const request: ChatRequest = {
  conversationId: "conversation-1",
  responseMessageId: "assistant-1",
  messages: [
    {
      id: "user-1",
      conversationId: "conversation-1",
      role: "user",
      content: "hello",
      status: "complete",
      createdAt: 1,
      updatedAt: 1,
    },
  ],
};

async function collect(
  source: AsyncIterable<AgentStreamEvent>,
): Promise<readonly AgentStreamEvent[]> {
  const values: AgentStreamEvent[] = [];
  for await (const value of source) {
    values.push(value);
  }
  return values;
}

describe("createMockTransport", () => {
  it("produces repeatable Unicode-safe chunks", async () => {
    const transport = createMockTransport({
      response: ({ lastUserMessage }) => ({
        content: `${lastUserMessage?.content}:你🙂好`,
        reasoning: "think",
      }),
      chunkSize: [1, 2],
    });

    const first = await collect(transport.stream(request));
    const second = await collect(transport.stream(request));
    expect(second).toEqual(first);
    expect(
      first
        .filter(
          (event): event is Extract<AgentStreamEvent, { type: "text-delta" }> =>
            event.type === "text-delta",
        )
        .map((event) => event.delta)
        .join(""),
    ).toBe("hello:你🙂好");
  });

  it("supports exact scripts and appends done deterministically", async () => {
    const transport = createMockTransport({
      events: [{ type: "text-delta", delta: "scripted" }],
    });
    await expect(collect(transport.stream(request))).resolves.toEqual([
      { type: "text-delta", delta: "scripted" },
      { type: "done", finishReason: "stop" },
    ]);
  });

  it("honors AbortSignal during a delayed stream", async () => {
    const transport = createMockTransport({
      response: "slow",
      delayMs: 50,
    });
    const controller = new AbortController();
    const next = transport
      .stream(request, { signal: controller.signal })
      [Symbol.asyncIterator]()
      .next();
    controller.abort();
    await expect(next).rejects.toMatchObject({ name: "AbortError" });
  });

  it("validates chunk and delay configuration", async () => {
    expect(() => createMockTransport({ chunkSize: 0 })).toThrow(RangeError);
    expect(() => createMockTransport({ response: "x", delayMs: -1 })).toThrow(
      RangeError,
    );
    const transport = createMockTransport({
      response: "x",
      delayMs: () => Number.NaN,
    });
    await expect(collect(transport.stream(request))).rejects.toThrow(RangeError);
  });
});
