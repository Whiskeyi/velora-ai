type Decision = {
  requestId: string;
  toolCallId: string;
  decision: "approve" | "reject";
};

const pending = new Map<string, (decision: Decision) => void>();

export async function POST(request: Request) {
  const body = (await request.json()) as {
    requestId: string;
    responseMessageId: string;
  };
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, value: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`));
      send("start", { messageId: body.responseMessageId });
      send("reasoning-summary-delta", {
        delta: "The release requires a workspace write.",
      });
      send("tool-call", {
        id: "write-release-notes",
        name: "write_file",
        status: "approval-required",
        risk: "medium",
        arguments: { path: "RELEASE_NOTES.md" },
      });
      pending.set(body.requestId, (decision) => {
        pending.delete(body.requestId);
        if (decision.decision === "approve") {
          send("tool-call-update", {
            toolCallId: decision.toolCallId,
            patch: {
              status: "complete",
              result: { path: "RELEASE_NOTES.md", written: true },
            },
          });
          send("text-delta", {
            delta: "Approved. The release notes were prepared successfully.",
          });
        } else {
          send("tool-call-update", {
            toolCallId: decision.toolCallId,
            patch: { status: "cancelled" },
          });
          send("text-delta", {
            delta: "The write was cancelled. No files were changed.",
          });
        }
        send("done", { finishReason: "stop" });
        controller.close();
      });
    },
    cancel() {
      pending.delete(body.requestId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

export async function PUT(request: Request) {
  const decision = (await request.json()) as Decision;
  const resolve = pending.get(decision.requestId);
  if (!resolve) {
    return Response.json({ error: "Run is no longer active" }, { status: 409 });
  }
  resolve(decision);
  return Response.json({ accepted: true });
}
