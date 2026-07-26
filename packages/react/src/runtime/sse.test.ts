import { describe, expect, it, vi } from "vitest";

import { parseSSEStream } from "./sse";
import { createSSETransport, parseAgentSSEFrame } from "./transport";
import type { ChatRequest } from "./types";

function streamBytes(source: string, chunkSizes: readonly number[]) {
  const bytes = new TextEncoder().encode(source);
  let offset = 0;
  let chunkIndex = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      const size = chunkSizes[chunkIndex % chunkSizes.length] ?? 1;
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
      chunkIndex += 1;
    },
  });
}

async function collect<T>(source: AsyncIterable<T>): Promise<readonly T[]> {
  const values: T[] = [];
  for await (const value of source) {
    values.push(value);
  }
  return values;
}

const request: ChatRequest = {
  conversationId: "conversation-1",
  responseMessageId: "assistant-1",
  messages: [],
};

describe("parseSSEStream", () => {
  it("handles byte boundaries, CRLF, multi-line data and persistent ids", async () => {
    const source = [
      ": heartbeat\r\n",
      "event: text-delta\r\n",
      "id: event-1\r\n",
      'data: {"delta":"你🙂",\r\n',
      'data: "ignored":true}\r\n',
      "retry: 250\r\n",
      "\r\n",
      "data: tail\n\n",
    ].join("");

    const frames = await collect(parseSSEStream(streamBytes(source, [1, 2, 5])));
    expect(frames).toEqual([
      {
        event: "text-delta",
        id: "event-1",
        retry: 250,
        data: '{"delta":"你🙂",\n"ignored":true}',
      },
      { id: "event-1", data: "tail" },
    ]);
  });

  it("dispatches a final event without a trailing blank line", async () => {
    const frames = await collect(
      parseSSEStream(streamBytes("event: done\ndata: {}", [3])),
    );
    expect(frames).toEqual([{ event: "done", data: "{}" }]);
  });

  it("cancels the reader and rejects with AbortError", async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({});
    const next = parseSSEStream(stream, { signal: controller.signal }).next();
    controller.abort("test stop");
    await expect(next).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("Velora SSE transport", () => {
  it("maps data, error and done frames into typed events", () => {
    expect(
      parseAgentSSEFrame({
        event: "text-delta",
        id: "42",
        data: '{"delta":"hello"}',
      }),
    ).toEqual({ type: "text-delta", delta: "hello", eventId: "42" });
    expect(
      parseAgentSSEFrame({
        event: "error",
        data: '{"error":{"message":"bad","code":"MODEL_ERROR"}}',
      }),
    ).toEqual({
      type: "error",
      error: { message: "bad", code: "MODEL_ERROR" },
    });
    expect(parseAgentSSEFrame({ data: "[DONE]" })).toEqual({
      type: "done",
      finishReason: "stop",
    });
  });

  it("accepts waiting and cancelled steps from the public step contract", () => {
    expect(
      parseAgentSSEFrame({
        event: "step",
        data: JSON.stringify({
          step: { id: "approval", title: "Await approval", status: "waiting" },
        }),
      }),
    ).toEqual({
      type: "step",
      step: { id: "approval", title: "Await approval", status: "waiting" },
    });
    expect(
      parseAgentSSEFrame({
        event: "step-update",
        data: JSON.stringify({ stepId: "approval", patch: { status: "cancelled" } }),
      }),
    ).toEqual({
      type: "step-update",
      stepId: "approval",
      patch: { status: "cancelled" },
    });
  });

  it("maps typed tool-call lifecycle events", () => {
    expect(
      parseAgentSSEFrame({
        event: "tool-call",
        data: JSON.stringify({
          toolCall: {
            id: "tool-1",
            name: "search",
            status: "approval-required",
            risk: "high",
            arguments: { query: "Velora" },
          },
        }),
      }),
    ).toEqual({
      type: "tool-call",
      toolCall: {
        id: "tool-1",
        name: "search",
        status: "approval-required",
        risk: "high",
        arguments: { query: "Velora" },
      },
    });
  });

  it("preserves typed message attachments from SSE message events", () => {
    expect(
      parseAgentSSEFrame({
        event: "message",
        data: JSON.stringify({
          message: {
            id: "assistant-1",
            conversationId: "conversation-1",
            role: "assistant",
            content: "Generated the preview.",
            status: "complete",
            createdAt: 1,
            updatedAt: 2,
            attachments: [
              {
                id: "preview-1",
                name: "preview.png",
                kind: "image",
                mimeType: "image/png",
                size: 2048,
                url: "https://example.test/preview.png",
                metadata: { width: 1200 },
              },
            ],
          },
        }),
      }),
    ).toEqual({
      type: "message",
      message: {
        id: "assistant-1",
        conversationId: "conversation-1",
        role: "assistant",
        content: "Generated the preview.",
        status: "complete",
        createdAt: 1,
        updatedAt: 2,
        attachments: [
          {
            id: "preview-1",
            name: "preview.png",
            kind: "image",
            mimeType: "image/png",
            size: 2048,
            url: "https://example.test/preview.png",
            metadata: { width: 1200 },
          },
        ],
      },
    });
  });

  it("posts a ChatRequest and stops at done", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual(request);
      return new Response(
        streamBytes(
          [
            "event: start\ndata: {}\n\n",
            'event: text-delta\ndata: {"delta":"ok"}\n\n',
            "event: done\ndata: {}\n\n",
            'event: text-delta\ndata: {"delta":"ignored"}\n\n',
          ].join(""),
          [7, 2],
        ),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      );
    });
    const transport = createSSETransport({
      url: "/api/agent",
      fetch: fetcher,
    });

    const events = await collect(transport.stream(request));
    expect(events).toEqual([
      { type: "start" },
      { type: "text-delta", delta: "ok" },
      { type: "done" },
    ]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("exposes useful HTTP failures", async () => {
    const transport = createSSETransport({
      url: "/api/agent",
      fetch: async () => new Response("overloaded", { status: 503 }),
    });
    await expect(collect(transport.stream(request))).rejects.toMatchObject({
      name: "VeloraTransportError",
      status: 503,
      retryable: true,
    });
  });

  it("rejects a successful non-SSE response before parsing", async () => {
    const transport = createSSETransport({
      url: "/api/agent",
      fetch: async () =>
        new Response('{"message":"not a stream"}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });

    await expect(collect(transport.stream(request))).rejects.toMatchObject({
      name: "VeloraTransportError",
      code: "UNEXPECTED_CONTENT_TYPE",
      retryable: true,
    });
  });

  it("rejects an SSE response that ends without a terminal event", async () => {
    const transport = createSSETransport({
      url: "/api/agent",
      fetch: async () =>
        new Response(streamBytes('event: text-delta\ndata: {"delta":"partial"}\n\n', [4]), {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        }),
    });

    await expect(collect(transport.stream(request))).rejects.toMatchObject({
      name: "VeloraTransportError",
      code: "INCOMPLETE_STREAM",
      retryable: true,
    });
  });

  it("allows EOF-terminated providers through an explicit compatibility option", async () => {
    const transport = createSSETransport({
      url: "/api/agent",
      requireTerminalEvent: false,
      fetch: async () =>
        new Response(streamBytes('event: text-delta\ndata: {"delta":"legacy"}\n\n', [3]), {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
    });

    await expect(collect(transport.stream(request))).resolves.toEqual([
      { type: "text-delta", delta: "legacy" },
    ]);
  });

  it("keeps recoverable error events non-terminal when configured", async () => {
    const transport = createSSETransport({
      url: "/api/agent",
      terminateOnError: false,
      fetch: async () =>
        new Response(
          streamBytes(
            [
              'event: error\ndata: {"error":{"message":"temporary"}}\n\n',
              'event: text-delta\ndata: {"delta":"recovered"}\n\n',
              "event: done\ndata: {}\n\n",
            ].join(""),
            [5],
          ),
          { headers: { "Content-Type": "text/event-stream" } },
        ),
    });

    await expect(collect(transport.stream(request))).resolves.toEqual([
      {
        type: "error",
        error: { message: "temporary" },
        terminal: false,
      },
      { type: "text-delta", delta: "recovered" },
      { type: "done" },
    ]);
  });

  it("reconnects idempotent streams with Last-Event-ID", async () => {
    let attempt = 0;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      attempt += 1;
      if (attempt === 1) {
        return new Response(
          streamBytes(
            'id: event-1\nevent: text-delta\ndata: {"delta":"A"}\n\n',
            [4],
          ),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }
      expect(new Headers(init?.headers).get("Last-Event-ID")).toBe("event-1");
      return new Response(
        streamBytes(
          [
            'event: text-delta\ndata: {"delta":"B"}\n\n',
            "event: done\ndata: {}\n\n",
          ].join(""),
          [6],
        ),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    });
    const transport = createSSETransport({
      url: "/api/agent",
      fetch: fetcher,
      maxReconnectAttempts: 1,
      reconnectDelayMs: 0,
    });

    await expect(collect(transport.stream(request))).resolves.toEqual([
      { type: "text-delta", delta: "A", eventId: "event-1" },
      { type: "text-delta", delta: "B" },
      { type: "done" },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
