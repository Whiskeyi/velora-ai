import type {
  AgentError,
  AgentFinishReason,
  AgentStep,
  AgentStreamEvent,
  AgentTransport,
  ChatRequest,
  JsonObject,
} from "./types";
import { createAbortError, throwIfAborted } from "./abort";

export interface MockAgentResponse {
  readonly content: string;
  readonly reasoning?: string;
  readonly steps?: readonly AgentStep[];
  readonly metadata?: JsonObject;
  readonly finishReason?: AgentFinishReason;
  readonly error?: AgentError;
}

export interface MockResponseContext {
  readonly request: ChatRequest;
  readonly lastUserMessage: ChatRequest["messages"][number] | undefined;
}

export interface MockDelayContext {
  readonly request: ChatRequest;
  readonly event: AgentStreamEvent;
  readonly index: number;
}

export type MockResponseResolver = (
  context: MockResponseContext,
) => string | MockAgentResponse | Promise<string | MockAgentResponse>;

export type MockEventResolver = (
  context: MockResponseContext,
) => readonly AgentStreamEvent[] | Promise<readonly AgentStreamEvent[]>;

export interface MockTransportOptions {
  /** Text, structured response, or a deterministic resolver for each request. */
  readonly response?: string | MockAgentResponse | MockResponseResolver;
  /** An exact event script; when present it takes precedence over response. */
  readonly events?: readonly AgentStreamEvent[] | MockEventResolver;
  /** Unicode code-point chunk sizes, cycled in order. Defaults to [3, 5, 4]. */
  readonly chunkSize?: number | readonly number[];
  readonly reasoningChunkSize?: number | readonly number[];
  readonly initialDelayMs?: number;
  readonly delayMs?: number | ((context: MockDelayContext) => number);
  /** Appends a done event to custom scripts that do not include one. */
  readonly autoDone?: boolean;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, ms);
    const handleAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", handleAbort);
      reject(createAbortError(signal?.reason));
    };
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

function normalizeChunkSizes(
  value: number | readonly number[] | undefined,
  fallback: readonly number[],
  label: string,
): readonly number[] {
  const sizes = typeof value === "number" ? [value] : (value ?? fallback);
  if (sizes.length === 0 || sizes.some((size) => !Number.isInteger(size) || size <= 0)) {
    throw new RangeError(`${label} must contain positive integers`);
  }
  return [...sizes];
}

function splitIntoChunks(value: string, sizes: readonly number[]): readonly string[] {
  const codePoints = Array.from(value);
  const chunks: string[] = [];
  let offset = 0;
  let sizeIndex = 0;
  while (offset < codePoints.length) {
    const size = sizes[sizeIndex % sizes.length] ?? 1;
    chunks.push(codePoints.slice(offset, offset + size).join(""));
    offset += size;
    sizeIndex += 1;
  }
  return chunks;
}

function responseContext(request: ChatRequest): MockResponseContext {
  return {
    request,
    lastUserMessage: [...request.messages].reverse().find((message) => message.role === "user"),
  };
}

async function resolveResponse(
  response: MockTransportOptions["response"],
  context: MockResponseContext,
): Promise<MockAgentResponse> {
  const resolved = typeof response === "function" ? await response(context) : response;
  if (typeof resolved === "string") {
    return { content: resolved };
  }
  if (resolved) {
    return resolved;
  }
  return {
    content: `Velora received: ${context.lastUserMessage?.content ?? ""}`,
  };
}

async function resolveEvents(
  events: NonNullable<MockTransportOptions["events"]>,
  context: MockResponseContext,
): Promise<readonly AgentStreamEvent[]> {
  return typeof events === "function" ? await events(context) : events;
}

function buildEvents(
  request: ChatRequest,
  response: MockAgentResponse,
  contentChunkSizes: readonly number[],
  reasoningChunkSizes: readonly number[],
): readonly AgentStreamEvent[] {
  const events: AgentStreamEvent[] = [{ type: "start", messageId: request.responseMessageId }];

  if (response.reasoning) {
    for (const delta of splitIntoChunks(response.reasoning, reasoningChunkSizes)) {
      events.push({ type: "reasoning-summary-delta", delta });
    }
  }

  for (const step of response.steps ?? []) {
    events.push({ type: "step", step });
  }

  for (const delta of splitIntoChunks(response.content, contentChunkSizes)) {
    events.push({ type: "text-delta", delta });
  }

  if (response.metadata) {
    events.push({ type: "metadata", metadata: response.metadata });
  }

  if (response.error) {
    events.push({ type: "error", error: response.error });
  } else {
    events.push({
      type: "done",
      finishReason: response.finishReason ?? "stop",
    });
  }
  return events;
}

/**
 * Creates a deterministic in-memory stream. The same request and options yield
 * the same chunks and event order, which keeps demos and tests reproducible.
 */
export function createMockTransport(options: MockTransportOptions = {}): AgentTransport {
  if (
    options.initialDelayMs !== undefined &&
    (!Number.isFinite(options.initialDelayMs) || options.initialDelayMs < 0)
  ) {
    throw new RangeError("initialDelayMs must be a non-negative number");
  }
  if (
    typeof options.delayMs === "number" &&
    (!Number.isFinite(options.delayMs) || options.delayMs < 0)
  ) {
    throw new RangeError("delayMs must be a non-negative number");
  }
  const contentChunkSizes = normalizeChunkSizes(options.chunkSize, [3, 5, 4], "chunkSize");
  const reasoningChunkSizes = normalizeChunkSizes(
    options.reasoningChunkSize ?? options.chunkSize,
    contentChunkSizes,
    "reasoningChunkSize",
  );

  return {
    name: "VeloraMockTransport",
    async *stream(request, transportOptions = {}) {
      const { signal } = transportOptions;
      throwIfAborted(signal);
      await wait(options.initialDelayMs ?? 0, signal);

      const context = responseContext(request);
      let events: readonly AgentStreamEvent[];
      if (options.events) {
        const scripted = await resolveEvents(options.events, context);
        const hasTerminalEvent = scripted.some(
          (event) => event.type === "done" || event.type === "error",
        );
        events =
          options.autoDone !== false && !hasTerminalEvent
            ? [...scripted, { type: "done", finishReason: "stop" }]
            : scripted;
      } else {
        const response = await resolveResponse(options.response, context);
        events = buildEvents(request, response, contentChunkSizes, reasoningChunkSizes);
      }

      for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        if (!event) {
          continue;
        }
        const delay =
          typeof options.delayMs === "function"
            ? options.delayMs({ request, event, index })
            : (options.delayMs ?? 0);
        if (!Number.isFinite(delay) || delay < 0) {
          throw new RangeError("delayMs must resolve to a non-negative number");
        }
        await wait(delay, signal);
        throwIfAborted(signal);
        yield event;
        if (event.type === "done" || event.type === "error") {
          break;
        }
      }
    },
  };
}
