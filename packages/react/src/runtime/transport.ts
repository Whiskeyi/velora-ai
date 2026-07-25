import type {
  AgentAttachment,
  AgentError,
  AgentMessage,
  AgentMessageStatus,
  AgentStep,
  AgentStepStatus,
  AgentStreamEvent,
  AgentTransport,
  ChatRequest,
  JsonObject,
  JsonValue,
} from "./types";
import { isAbortError, parseSSEStream, type SSEFrame } from "./sse";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class VeloraTransportError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: {
      readonly status?: number;
      readonly code?: string;
      readonly retryable?: boolean;
      readonly cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "VeloraTransportError";
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}

export interface SSETransportConfig {
  readonly url: string | URL | ((request: ChatRequest) => string | URL);
  readonly fetch?: FetchLike;
  readonly method?: string;
  readonly headers?: HeadersInit | ((request: ChatRequest) => HeadersInit);
  readonly requestInit?: Omit<
    RequestInit,
    "body" | "headers" | "method" | "signal"
  >;
  readonly serializeRequest?: (request: ChatRequest) => BodyInit | undefined;
  readonly parseEvent?: (frame: SSEFrame) => AgentStreamEvent | null;
  /** Error events are terminal by default, matching common agent endpoints. */
  readonly terminateOnError?: boolean;
  /** Reject non-SSE success responses before parsing. Defaults to true. */
  readonly validateContentType?: boolean;
  /** Require a terminal `done` or terminal `error` event before EOF. Defaults to true. */
  readonly requireTerminalEvent?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asJsonObject(value: unknown): JsonObject | undefined {
  return isRecord(value) ? (value as JsonObject) : undefined;
}

function asJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    Array.isArray(value) ||
    isRecord(value)
  ) {
    return value as JsonValue;
  }
  return undefined;
}

function readString(
  record: Record<string, unknown>,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    if (typeof record[key] === "string") {
      return record[key];
    }
  }
  return undefined;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseError(value: unknown, fallback = "The agent stream failed"): AgentError {
  if (typeof value === "string") {
    return { message: value };
  }
  if (!isRecord(value)) {
    return { message: fallback };
  }

  const details = asJsonValue(value.details);
  return {
    message: readString(value, "message", "error") ?? fallback,
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value.retryable === "boolean"
      ? { retryable: value.retryable }
      : {}),
    ...(details !== undefined ? { details } : {}),
  };
}

const MESSAGE_STATUSES = new Set<AgentMessageStatus>([
  "queued",
  "streaming",
  "complete",
  "error",
  "aborted",
]);

const STEP_STATUSES = new Set<AgentStepStatus>([
  "pending",
  "waiting",
  "running",
  "complete",
  "error",
  "cancelled",
]);

function parseAttachment(value: unknown): AgentAttachment {
  if (!isRecord(value)) {
    throw new VeloraTransportError("A message attachment must be an object", {
      code: "INVALID_EVENT",
    });
  }

  const id = readString(value, "id");
  const name = readString(value, "name");
  const size = readNumber(value, "size");
  const metadata = asJsonObject(value.metadata);
  if (
    !id ||
    !name ||
    (value.kind !== undefined && typeof value.kind !== "string") ||
    (value.mimeType !== undefined && typeof value.mimeType !== "string") ||
    (value.url !== undefined && typeof value.url !== "string") ||
    (value.size !== undefined && (size === undefined || size < 0)) ||
    (value.metadata !== undefined && metadata === undefined)
  ) {
    throw new VeloraTransportError("A message attachment has an invalid shape", {
      code: "INVALID_EVENT",
    });
  }

  return {
    id,
    name,
    ...(typeof value.kind === "string" ? { kind: value.kind } : {}),
    ...(typeof value.mimeType === "string" ? { mimeType: value.mimeType } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(typeof value.url === "string" ? { url: value.url } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function parseStep(value: unknown): AgentStep {
  if (!isRecord(value)) {
    throw new VeloraTransportError("A step event must contain a step object", {
      code: "INVALID_EVENT",
    });
  }

  const id = readString(value, "id");
  const title = readString(value, "title");
  const status = readString(value, "status");
  if (!id || !title || !status || !STEP_STATUSES.has(status as AgentStepStatus)) {
    throw new VeloraTransportError(
      "A step event requires valid id, title and status fields",
      { code: "INVALID_EVENT" },
    );
  }

  const metadata = asJsonObject(value.metadata);
  return {
    id,
    title,
    status: status as AgentStepStatus,
    ...(typeof value.description === "string"
      ? { description: value.description }
      : {}),
    ...(typeof value.detail === "string" ? { detail: value.detail } : {}),
    ...(readNumber(value, "startedAt") !== undefined
      ? { startedAt: readNumber(value, "startedAt") }
      : {}),
    ...(readNumber(value, "completedAt") !== undefined
      ? { completedAt: readNumber(value, "completedAt") }
      : {}),
    ...(value.error !== undefined ? { error: parseError(value.error) } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function parseStepPatch(
  value: Record<string, unknown>,
): Partial<Omit<AgentStep, "id">> {
  const status = readString(value, "status");
  if (status && !STEP_STATUSES.has(status as AgentStepStatus)) {
    throw new VeloraTransportError(`Invalid step status: ${status}`, {
      code: "INVALID_EVENT",
    });
  }
  const metadata = asJsonObject(value.metadata);
  return {
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(status ? { status: status as AgentStepStatus } : {}),
    ...(typeof value.description === "string"
      ? { description: value.description }
      : {}),
    ...(typeof value.detail === "string" ? { detail: value.detail } : {}),
    ...(readNumber(value, "startedAt") !== undefined
      ? { startedAt: readNumber(value, "startedAt") }
      : {}),
    ...(readNumber(value, "completedAt") !== undefined
      ? { completedAt: readNumber(value, "completedAt") }
      : {}),
    ...(value.error !== undefined ? { error: parseError(value.error) } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function parseMessage(value: unknown): AgentMessage {
  if (!isRecord(value)) {
    throw new VeloraTransportError("A message event must contain a message object", {
      code: "INVALID_EVENT",
    });
  }

  const id = readString(value, "id");
  const conversationId = readString(value, "conversationId");
  const role = readString(value, "role");
  const content = readString(value, "content");
  const status = readString(value, "status");
  const createdAt = readNumber(value, "createdAt");
  const updatedAt = readNumber(value, "updatedAt");
  if (
    !id ||
    !conversationId ||
    !role ||
    !["system", "user", "assistant", "tool"].includes(role) ||
    content === undefined ||
    !status ||
    !MESSAGE_STATUSES.has(status as AgentMessageStatus) ||
    createdAt === undefined ||
    updatedAt === undefined
  ) {
    throw new VeloraTransportError("A message event has an invalid shape", {
      code: "INVALID_EVENT",
    });
  }

  const steps = Array.isArray(value.steps)
    ? value.steps.map((step) => parseStep(step))
    : undefined;
  if (value.attachments !== undefined && !Array.isArray(value.attachments)) {
    throw new VeloraTransportError("Message attachments must be an array", {
      code: "INVALID_EVENT",
    });
  }
  const attachments = Array.isArray(value.attachments)
    ? value.attachments.map((attachment) => parseAttachment(attachment))
    : undefined;
  const metadata = asJsonObject(value.metadata);
  return {
    id,
    conversationId,
    role: role as AgentMessage["role"],
    content,
    status: status as AgentMessageStatus,
    createdAt,
    updatedAt,
    ...(typeof value.parentId === "string" ? { parentId: value.parentId } : {}),
    ...(typeof value.reasoning === "string" ? { reasoning: value.reasoning } : {}),
    ...(attachments ? { attachments } : {}),
    ...(steps ? { steps } : {}),
    ...(value.error !== undefined ? { error: parseError(value.error) } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return undefined;
  }
}

function normalizeEventName(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase().replaceAll("_", "-");
}

function eventWithId(event: AgentStreamEvent, id?: string): AgentStreamEvent {
  return id === undefined ? event : { ...event, eventId: id };
}

function readDelta(data: string, payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (isRecord(payload)) {
    const direct = readString(payload, "delta", "content", "text");
    if (direct !== undefined) {
      return direct;
    }
    if (isRecord(payload.delta)) {
      return readString(payload.delta, "content", "text") ?? "";
    }
  }
  return data;
}

/** Maps a protocol-neutral SSE frame into Velora's typed stream events. */
export function parseAgentSSEFrame(frame: SSEFrame): AgentStreamEvent | null {
  const trimmedData = frame.data.trim();
  if (trimmedData === "[DONE]") {
    return eventWithId({ type: "done", finishReason: "stop" }, frame.id);
  }

  const payload = parseJson(frame.data);
  const payloadRecord = isRecord(payload) ? payload : undefined;
  const payloadType = payloadRecord ? readString(payloadRecord, "type") : undefined;
  const eventName = normalizeEventName(frame.event ?? payloadType);

  let event: AgentStreamEvent | null;
  switch (eventName) {
    case "":
    case "delta":
    case "token":
    case "text-delta":
    case "message-delta":
    case "content-block-delta":
      event = { type: "text-delta", delta: readDelta(frame.data, payload) };
      break;
    case "start":
    case "message-start":
      event = {
        type: "start",
        ...(payloadRecord && readString(payloadRecord, "messageId", "message_id")
          ? {
              messageId: readString(
                payloadRecord,
                "messageId",
                "message_id",
              ),
            }
          : {}),
        ...(payloadRecord && readNumber(payloadRecord, "createdAt") !== undefined
          ? { createdAt: readNumber(payloadRecord, "createdAt") }
          : {}),
      };
      break;
    case "reasoning":
    case "reasoning-delta":
    case "thinking-delta":
      event = {
        type: "reasoning-delta",
        delta: readDelta(frame.data, payload),
      };
      break;
    case "step":
    case "step-start":
    case "step-complete":
      event = {
        type: "step",
        step: parseStep(payloadRecord?.step ?? payload),
      };
      break;
    case "step-update": {
      const stepId = payloadRecord
        ? readString(payloadRecord, "stepId", "step_id", "id")
        : undefined;
      const patchValue = payloadRecord?.patch;
      if (!stepId || !isRecord(patchValue)) {
        throw new VeloraTransportError(
          "A step-update event requires stepId and patch fields",
          { code: "INVALID_EVENT" },
        );
      }
      event = {
        type: "step-update",
        stepId,
        patch: parseStepPatch(patchValue),
      };
      break;
    }
    case "message":
    case "message-complete":
      event = {
        type: "message",
        message: parseMessage(payloadRecord?.message ?? payload),
      };
      break;
    case "metadata": {
      const metadata = asJsonObject(payloadRecord?.metadata ?? payload);
      if (!metadata) {
        throw new VeloraTransportError(
          "A metadata event must contain a JSON object",
          { code: "INVALID_EVENT" },
        );
      }
      event = { type: "metadata", metadata };
      break;
    }
    case "error":
      event = {
        type: "error",
        error: parseError(payloadRecord?.error ?? payload ?? frame.data),
      };
      break;
    case "done":
    case "message-stop": {
      const usage = isRecord(payloadRecord?.usage)
        ? {
            ...(readNumber(payloadRecord.usage, "inputTokens") !== undefined ||
            readNumber(payloadRecord.usage, "input_tokens") !== undefined
              ? {
                  inputTokens:
                    readNumber(payloadRecord.usage, "inputTokens") ??
                    readNumber(payloadRecord.usage, "input_tokens"),
                }
              : {}),
            ...(readNumber(payloadRecord.usage, "outputTokens") !== undefined ||
            readNumber(payloadRecord.usage, "output_tokens") !== undefined
              ? {
                  outputTokens:
                    readNumber(payloadRecord.usage, "outputTokens") ??
                    readNumber(payloadRecord.usage, "output_tokens"),
                }
              : {}),
            ...(readNumber(payloadRecord.usage, "totalTokens") !== undefined ||
            readNumber(payloadRecord.usage, "total_tokens") !== undefined
              ? {
                  totalTokens:
                    readNumber(payloadRecord.usage, "totalTokens") ??
                    readNumber(payloadRecord.usage, "total_tokens"),
                }
              : {}),
          }
        : undefined;
      const metadata = asJsonObject(payloadRecord?.metadata);
      event = {
        type: "done",
        ...(payloadRecord && readString(payloadRecord, "finishReason", "finish_reason")
          ? {
              finishReason: readString(
                payloadRecord,
                "finishReason",
                "finish_reason",
              ),
            }
          : {}),
        ...(usage ? { usage } : {}),
        ...(metadata ? { metadata } : {}),
      };
      break;
    }
    case "ping":
    case "heartbeat":
      return null;
    default: {
      if (payloadRecord?.error !== undefined) {
        event = { type: "error", error: parseError(payloadRecord.error) };
        break;
      }
      throw new VeloraTransportError(`Unsupported SSE event: ${eventName}`, {
        code: "UNSUPPORTED_EVENT",
      });
    }
  }

  return eventWithId(event, frame.id);
}

function resolveHeaders(
  headers: SSETransportConfig["headers"],
  request: ChatRequest,
  setJsonContentType: boolean,
): Headers {
  const resolved = typeof headers === "function" ? headers(request) : headers;
  const result = new Headers(resolved);
  if (!result.has("Accept")) {
    result.set("Accept", "text/event-stream");
  }
  if (setJsonContentType && !result.has("Content-Type")) {
    result.set("Content-Type", "application/json");
  }
  return result;
}

/** Creates a POST-based fetch transport for a standard SSE endpoint. */
export function createSSETransport(config: SSETransportConfig): AgentTransport {
  const fetcher = config.fetch ?? globalThis.fetch.bind(globalThis);
  const parseEvent = config.parseEvent ?? parseAgentSSEFrame;

  return {
    name: "VeloraSSETransport",
    async *stream(request, options = {}) {
      const url =
        typeof config.url === "function" ? config.url(request) : config.url;
      const body = config.serializeRequest
        ? config.serializeRequest(request)
        : JSON.stringify(request);

      let response: Response;
      try {
        response = await fetcher(url, {
          ...config.requestInit,
          method: config.method ?? "POST",
          headers: resolveHeaders(
            config.headers,
            request,
            config.serializeRequest === undefined,
          ),
          body,
          signal: options.signal,
        });
      } catch (error) {
        if (isAbortError(error) || options.signal?.aborted) {
          throw error;
        }
        throw new VeloraTransportError("Unable to connect to the agent endpoint", {
          code: "NETWORK_ERROR",
          retryable: true,
          cause: error,
        });
      }

      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 1_024);
        throw new VeloraTransportError(
          `Agent endpoint returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
          {
            status: response.status,
            code: "HTTP_ERROR",
            retryable: response.status === 429 || response.status >= 500,
          },
        );
      }

      const contentType = response.headers.get("Content-Type")?.toLowerCase();
      if (
        config.validateContentType !== false &&
        !contentType?.includes("text/event-stream")
      ) {
        const detail = (await response.text().catch(() => "")).slice(0, 1_024);
        throw new VeloraTransportError(
          `Agent endpoint returned ${contentType || "an unknown content type"}${detail ? `: ${detail}` : ""}`,
          {
            status: response.status,
            code: "UNEXPECTED_CONTENT_TYPE",
            retryable: true,
          },
        );
      }

      if (!response.body) {
        throw new VeloraTransportError("Agent endpoint returned an empty stream", {
          status: response.status,
          code: "EMPTY_STREAM",
          retryable: true,
        });
      }

      try {
        let terminalEventSeen = false;
        for await (const frame of parseSSEStream(response.body, {
          signal: options.signal,
        })) {
          const event = parseEvent(frame);
          if (!event) {
            continue;
          }
          yield event;
          if (
            event.type === "done" ||
            (event.type === "error" && config.terminateOnError !== false)
          ) {
            terminalEventSeen = true;
            break;
          }
        }

        if (
          config.requireTerminalEvent !== false &&
          !terminalEventSeen &&
          !options.signal?.aborted
        ) {
          throw new VeloraTransportError(
            "The agent stream ended before a terminal event",
            { code: "INCOMPLETE_STREAM", retryable: true },
          );
        }
      } catch (error) {
        if (
          isAbortError(error) ||
          options.signal?.aborted ||
          error instanceof VeloraTransportError
        ) {
          throw error;
        }
        throw new VeloraTransportError("The agent stream disconnected", {
          code: "STREAM_ERROR",
          retryable: true,
          cause: error,
        });
      }
    },
  };
}
