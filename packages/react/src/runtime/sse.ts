import { throwIfAborted } from "./abort";

export interface SSEFrame {
  readonly data: string;
  readonly event?: string;
  readonly id?: string;
  readonly retry?: number;
}

export interface ParseSSEOptions {
  readonly signal?: AbortSignal;
}

/** Returns true for browser and cross-runtime abort errors. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Parses a fetch ReadableStream according to the EventSource field rules.
 * UTF-8 chunks, CR/LF boundaries and multi-line data fields are handled without
 * assuming that transport chunks line up with SSE records.
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  options: ParseSSEOptions = {},
): AsyncGenerator<SSEFrame, void, undefined> {
  const { signal } = options;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines: string[] = [];
  let eventType: string | undefined;
  let lastEventId: string | undefined;
  let retry: number | undefined;
  let ended = false;

  const dispatch = (): SSEFrame | undefined => {
    if (dataLines.length === 0) {
      eventType = undefined;
      retry = undefined;
      return undefined;
    }

    const frame: SSEFrame = {
      data: dataLines.join("\n"),
      ...(eventType ? { event: eventType } : {}),
      ...(lastEventId !== undefined ? { id: lastEventId } : {}),
      ...(retry !== undefined ? { retry } : {}),
    };

    dataLines = [];
    eventType = undefined;
    retry = undefined;
    return frame;
  };

  const processLine = (line: string): SSEFrame | undefined => {
    if (line === "") {
      return dispatch();
    }

    if (line.startsWith(":")) {
      return undefined;
    }

    const colonIndex = line.indexOf(":");
    const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
    let value = colonIndex === -1 ? "" : line.slice(colonIndex + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }

    switch (field) {
      case "data":
        dataLines.push(value);
        break;
      case "event":
        eventType = value;
        break;
      case "id":
        if (!value.includes("\0")) {
          lastEventId = value;
        }
        break;
      case "retry":
        if (/^\d+$/.test(value)) {
          retry = Number(value);
        }
        break;
      default:
        break;
    }

    return undefined;
  };

  const nextLine = (atEnd: boolean): string | undefined => {
    for (let index = 0; index < buffer.length; index += 1) {
      const character = buffer[index];
      if (character !== "\r" && character !== "\n") {
        continue;
      }

      if (character === "\r" && index === buffer.length - 1 && !atEnd) {
        return undefined;
      }

      const delimiterLength =
        character === "\r" && buffer[index + 1] === "\n" ? 2 : 1;
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + delimiterLength);
      return line;
    }

    if (atEnd && buffer.length > 0) {
      const line = buffer;
      buffer = "";
      return line;
    }

    return undefined;
  };

  const handleAbort = (): void => {
    void reader.cancel(signal?.reason).catch(() => undefined);
  };

  signal?.addEventListener("abort", handleAbort, { once: true });

  try {
    throwIfAborted(signal);
    while (!ended) {
      const result = await reader.read();
      throwIfAborted(signal);

      if (result.done) {
        buffer += decoder.decode();
        ended = true;
      } else {
        buffer += decoder.decode(result.value, { stream: true });
      }

      let line = nextLine(ended);
      while (line !== undefined) {
        const frame = processLine(line);
        if (frame) {
          yield frame;
        }
        line = nextLine(ended);
      }
    }

    const finalFrame = dispatch();
    if (finalFrame) {
      yield finalFrame;
    }
  } finally {
    signal?.removeEventListener("abort", handleAbort);
    if (!ended) {
      await reader.cancel().catch(() => undefined);
    }
    reader.releaseLock();
  }
}
