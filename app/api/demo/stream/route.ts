import type { ChatRequest } from "@velora-ai/react";

const encoder = new TextEncoder();

function frame(event: string, payload: unknown, id: number): Uint8Array {
  return encoder.encode(
    `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
  );
}

function wait(duration: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const handleAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, duration);
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

function splitForStreaming(value: string): string[] {
  return value.match(/\s+|[^\s]{1,7}/gu) ?? [value];
}

/**
 * A dependency-free reference endpoint for the showcase. It speaks ordinary
 * POST + text/event-stream, so the same component path can be connected to a
 * production model gateway by replacing only the transport URL.
 */
export async function POST(request: Request): Promise<Response> {
  let input: ChatRequest | undefined;
  try {
    input = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid chat request" }, { status: 400 });
  }

  const lastPrompt = [...(input.messages ?? [])]
    .reverse()
    .find((message) => message.role === "user")
    ?.content.trim()
    .slice(0, 120);
  const subject = lastPrompt || "this interface request";
  const messageId = input.responseMessageId || `demo-${Date.now()}`;

  const answer = [
    `I mapped “${subject}” into a focused agent surface.`,
    "\n\n**Recommended direction**\n\n",
    "1. Keep one calm primary action.\n",
    "2. Reveal tool progress only when it builds trust.\n",
    "3. Preserve reading position while tokens arrive.\n\n",
    "```tsx\n<AgentShell composer={<PromptComposer onSubmit={send} />} />\n```\n\n",
    "The transport is real SSE; the endpoint is simulated and can be replaced without changing the UI.",
  ].join("");

  const streamAbort = new AbortController();
  const handleRequestAbort = () => streamAbort.abort(request.signal.reason);
  request.signal.addEventListener("abort", handleRequestAbort, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void (async () => {
        let eventId = 0;
        const send = (event: string, payload: unknown) => {
          eventId += 1;
          controller.enqueue(frame(event, payload, eventId));
        };

        try {
          send("start", { messageId, createdAt: Date.now() });
          send("step", {
            step: {
              id: "intent",
              title: "Understand intent",
              status: "running",
              description: "Mapping the request to interaction primitives",
              startedAt: Date.now(),
            },
          });

          for (const delta of [
            "Inspecting the interaction goal. ",
            "Balancing disclosure, continuity, and motion. ",
            "Preparing the smallest complete interface plan.",
          ]) {
            await wait(90, streamAbort.signal);
            send("reasoning-delta", { delta });
          }

          send("step-update", {
            stepId: "intent",
            patch: { status: "complete", completedAt: Date.now() },
          });
          send("step", {
            step: {
              id: "compose",
              title: "Compose response",
              status: "running",
              description: "Streaming the response through the typed runtime",
              startedAt: Date.now(),
            },
          });

          for (const delta of splitForStreaming(answer)) {
            await wait(22, streamAbort.signal);
            send("text-delta", { delta });
          }

          send("step-update", {
            stepId: "compose",
            patch: { status: "complete", completedAt: Date.now() },
          });
          send("done", {
            finishReason: "stop",
            usage: {
              inputTokens: Math.ceil(subject.length / 4),
              outputTokens: Math.ceil(answer.length / 4),
              totalTokens: Math.ceil((subject.length + answer.length) / 4),
            },
            metadata: { adapter: "velora-demo-sse" },
          });
          controller.close();
        } catch (error) {
          if (!streamAbort.signal.aborted) {
            send("error", {
              error: {
                code: "DEMO_STREAM_ERROR",
                message:
                  error instanceof Error ? error.message : "Demo stream failed",
                retryable: true,
              },
            });
            controller.close();
          }
        } finally {
          request.signal.removeEventListener("abort", handleRequestAbort);
        }
      })();
    },
    cancel() {
      streamAbort.abort("The client cancelled the demo stream");
      request.signal.removeEventListener("abort", handleRequestAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
