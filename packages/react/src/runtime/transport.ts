import type {
  AgentAttachment,
  AgentError,
  AgentMessage,
  AgentMessageStatus,
  AgentStep,
  AgentStepStatus,
  AgentStreamEvent,
  AgentToolCall,
  AgentToolCallStatus,
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
  /** Diagnostic-only detail. Do not render this value directly to end users. */
  readonly diagnosticDetail?: string;

  constructor(
    message: string,
    options: {
      readonly status?: number;
      readonly code?: string;
      readonly retryable?: boolean;
      readonly diagnosticDetail?: string;
      readonly cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "VeloraTransportError";
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.diagnosticDetail = options.diagnosticDetail;
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
  /** Opt-in reconnect attempts for idempotent endpoints. Defaults to 0. */
  readonly maxReconnectAttempts?: number;
  readonly reconnectDelayMs?: number;
  readonly maxReconnectDelayMs?: number;
  /** Timeout while waiting for response headers. Defaults to 15 seconds. */
  readonly connectTimeoutMs?: number;
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
const TOOL_CALL_STATUSES = new Set<AgentToolCallStatus>([
  "draft",
  "approval-required",
  "running",
  "complete",
  "error",
  "cancelled",
]);

function parseToolCall(value: unknown): AgentToolCall {
  if (!isRecord(value)) {
    throw new VeloraTransportError("A tool-call event must contain an object", {
      code: "INVALID_EVENT",
    });
  }
  const id = readString(value, "id", "toolCallId", "tool_call_id");
  const name = readString(value, "name", "toolName", "tool_name");
  const status = readString(value, "status") ?? "draft";
  if (
    !id ||
    !name ||
    !TOOL_CALL_STATUSES.has(status as AgentToolCallStatus)
  ) {
    throw new VeloraTransportError("A tool-call event has an invalid shape", {
      code: "INVALID_EVENT",
    });
  }
  const risk = readString(value, "risk");
  const metadata = asJsonObject(value.metadata);
  return {
    id,
    name,
    status: status as AgentToolCallStatus,
    ...(risk && ["low", "medium", "high", "critical"].includes(risk)
      ? { risk: risk as AgentToolCall["risk"] }
      : {}),
    ...(asJsonValue(value.arguments) !== undefined
      ? { arguments: asJsonValue(value.arguments) }
      : {}),
    ...(asJsonValue(value.result) !== undefined
      ? { result: asJsonValue(value.result) }
      : {}),
    ...(value.error !== undefined ? { error: parseError(value.error) } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

function parseToolCallPatch(
  value: Record<string, unknown>,
): Partial<Omit<AgentToolCall, "id">> {
  const status = readString(value, "status");
  if (status && !TOOL_CALL_STATUSES.has(status as AgentToolCallStatus)) {
    throw new VeloraTransportError(`Invalid tool-call status: ${status}`, {
      code: "INVALID_EVENT",
    });
  }
  const risk = readString(value, "risk");
  const metadata = asJsonObject(value.metadata);
  return {
    ...(typeof value.name === "string" ? { name: value.name } : {}),
    ...(status ? { status: status as AgentToolCallStatus } : {}),
    ...(risk && ["low", "medium", "high", "critical"].includes(risk)
      ? { risk: risk as AgentToolCall["risk"] }
      : {}),
    ...(asJsonValue(value.arguments) !== undefined
      ? { arguments: asJsonValue(value.arguments) }
      : {}),
    ...(asJsonValue(value.result) !== undefined
      ? { result: asJsonValue(value.result) }
      : {}),
    ...(value.error !== undefined ? { error: parseError(value.error) } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

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
  const toolCalls = Array.isArray(value.toolCalls)
    ? value.toolCalls.map((toolCall) => parseToolCall(toolCall))
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
  const branch = isRecord(value.branch)
    ? {
        id: readString(value.branch, "id") ?? id,
        ...(readString(value.branch, "parentId", "parent_id")
          ? {
              parentId: readString(
                value.branch,
                "parentId",
                "parent_id",
              ),
            }
          : {}),
        index: readNumber(value.branch, "index") ?? 0,
        count: readNumber(value.branch, "count") ?? 1,
      }
    : undefined;
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
    ...(toolCalls ? { toolCalls } : {}),
    ...(branch ? { branch } : {}),
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
    case "tool-call":
    case "tool-call-start":
    case "tool-call-complete":
      event = {
        type: "tool-call",
        toolCall: parseToolCall(payloadRecord?.toolCall ?? payloadRecord?.tool_call ?? payload),
      };
      break;
    case "tool-call-update": {
      const toolCallId = payloadRecord
        ? readString(payloadRecord, "toolCallId", "tool_call_id", "id")
        : undefined;
      const patchValue = payloadRecord?.patch;
      if (!toolCallId || !isRecord(patchValue)) {
        throw new VeloraTransportError(
          "A tool-call-update event requires toolCallId and patch fields",
          { code: "INVALID_EVENT" },
        );
      }
      event = {
        type: "tool-call-update",
        toolCallId,
        patch: parseToolCallPatch(patchValue),
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

function waitForRetry(delay: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason);
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, Math.max(0, delay));
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function normalizeTransportFailure(
  error: unknown,
  signal?: AbortSignal,
): VeloraTransportError | unknown {
  if (isAbortError(error) || signal?.aborted) return error;
  if (error instanceof VeloraTransportError) return error;
  return new VeloraTransportError("The agent stream disconnected", {
    code: "STREAM_ERROR",
    retryable: true,
    cause: error,
  });
}

/** Creates a POST-based fetch transport for a standard SSE endpoint. */
export function createSSETransport(config: SSETransportConfig): AgentTransport {
  const fetcher = config.fetch ?? globalThis.fetch.bind(globalThis);
  const parseEvent = config.parseEvent ?? parseAgentSSEFrame;
  const maxReconnectAttempts = Math.max(
    0,
    Math.floor(config.maxReconnectAttempts ?? 0),
  );

  return {
    name: "VeloraSSETransport",
    async *stream(request, options = {}) {
      const url =
        typeof config.url === "function" ? config.url(request) : config.url;
      const body = config.serializeRequest
        ? config.serializeRequest(request)
        : JSON.stringify(request);
      let reconnectAttempt = 0;
      let lastEventId: string | undefined;
      let serverRetryMs: number | undefined;

      while (true) {
        try {
          const headers = resolveHeaders(
            config.headers,
            request,
            config.serializeRequest === undefined,
          );
          if (lastEventId !== undefined) headers.set("Last-Event-ID", lastEventId);

          const connectController = new AbortController();
          const forwardAbort = () =>
            connectController.abort(options.signal?.reason);
          options.signal?.addEventListener("abort", forwardAbort, { once: true });
          const connectTimeout = setTimeout(
            () => connectController.abort("Connection timed out"),
            Math.max(1, config.connectTimeoutMs ?? 15_000),
          );
          let response: Response;
          try {
            response = await fetcher(url, {
              ...config.requestInit,
              method: config.method ?? "POST",
              headers,
              body,
              signal: connectController.signal,
            });
          } catch (error) {
            if (options.signal?.aborted) throw error;
            if (connectController.signal.aborted) {
              throw new VeloraTransportError(
                "The agent endpoint did not respond in time",
                {
                  code: "CONNECT_TIMEOUT",
                  retryable: true,
                  cause: error,
                },
              );
            }
            throw new VeloraTransportError(
              "Unable to connect to the agent endpoint",
              {
                code: "NETWORK_ERROR",
                retryable: true,
                cause: error,
              },
            );
          } finally {
            clearTimeout(connectTimeout);
            options.signal?.removeEventListener("abort", forwardAbort);
          }

          if (!response.ok) {
            const diagnosticDetail = (
              await response.text().catch(() => "")
            ).slice(0, 1_024);
            throw new VeloraTransportError(
              `Agent endpoint returned HTTP ${response.status}`,
              {
                status: response.status,
                code: "HTTP_ERROR",
                retryable: response.status === 429 || response.status >= 500,
                ...(diagnosticDetail ? { diagnosticDetail } : {}),
              },
            );
          }

          const contentType = response.headers
            .get("Content-Type")
            ?.toLowerCase();
          if (
            config.validateContentType !== false &&
            !contentType?.includes("text/event-stream")
          ) {
            const diagnosticDetail = (
              await response.text().catch(() => "")
            ).slice(0, 1_024);
            throw new VeloraTransportError(
              "Agent endpoint returned an unexpected content type",
              {
                status: response.status,
                code: "UNEXPECTED_CONTENT_TYPE",
                retryable: true,
                ...(diagnosticDetail ? { diagnosticDetail } : {}),
              },
            );
          }

          if (!response.body) {
            throw new VeloraTransportError(
              "Agent endpoint returned an empty stream",
              {
                status: response.status,
                code: "EMPTY_STREAM",
                retryable: true,
              },
            );
          }

        let terminalEventSeen = false;
        for await (const frame of parseSSEStream(response.body, {
          signal: options.signal,
        })) {
          if (frame.id !== undefined) lastEventId = frame.id;
          if (frame.retry !== undefined) serverRetryMs = frame.retry;
          const parsedEvent = parseEvent(frame);
          const event =
            parsedEvent?.type === "error" &&
            parsedEvent.terminal === undefined &&
            config.terminateOnError === false
              ? {
                  ...parsedEvent,
                  terminal: false,
                }
              : parsedEvent;
          if (!event) {
            continue;
          }
          yield event;
          if (
            event.type === "done" ||
            (event.type === "error" && event.terminal !== false)
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
          return;
        } catch (error) {
          const failure = normalizeTransportFailure(error, options.signal);
          if (
            failure instanceof VeloraTransportError &&
            failure.retryable &&
            reconnectAttempt < maxReconnectAttempts
          ) {
            const baseDelay =
              serverRetryMs ??
              Math.max(0, config.reconnectDelayMs ?? 750) *
                2 ** reconnectAttempt;
            const delay = Math.min(
              Math.max(0, config.maxReconnectDelayMs ?? 10_000),
              baseDelay,
            );
            reconnectAttempt += 1;
            await waitForRetry(delay, options.signal);
            continue;
          }
          throw failure;
        }
      }
    },
  };
}
