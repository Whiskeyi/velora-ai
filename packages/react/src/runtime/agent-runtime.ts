import { isAbortError } from "./sse";
import {
  createAgentStore,
  createVeloraId,
  selectConversationMessages,
  type AgentMessagePatch,
  type AgentStore,
} from "./store";
import {
  toAgentRequestMessage,
  type AgentError,
  type AgentMessage,
  type AgentRequestMessage,
  type AgentRunOutcome,
  type AgentRunStatus,
  type AgentStreamEvent,
  type AgentToolDecisionOptions,
  type AgentToolDecisionResult,
  type AgentTransport,
  type ChatRequest,
  type CreateConversationInput,
  type JsonObject,
  type RetryMessageOptions,
  type SendMessageOptions,
  type SendMessageResult,
  type VeloraIdFactory,
} from "./types";

interface ActiveRequest {
  readonly requestId: string;
  readonly controller: AbortController;
  readonly flush: () => void;
}

interface RunInput {
  readonly conversationId: string;
  readonly userMessage: AgentMessage;
  readonly responseMessage: AgentMessage;
  readonly requestMessages: readonly AgentMessage[];
  readonly requestId: string;
  readonly appendUserMessage: boolean;
  readonly requestMetadata?: JsonObject;
}

export interface AgentRuntimeTelemetryEvent {
  readonly type:
    | "request-start"
    | "first-event"
    | "request-complete"
    | "request-error"
    | "request-abort"
    | "tool-decision";
  readonly requestId: string;
  readonly conversationId: string;
  readonly timestamp: number;
  readonly durationMs?: number;
  readonly eventType?: AgentStreamEvent["type"];
  readonly toolCallId?: string;
  readonly decision?: "approve" | "reject";
  readonly error?: AgentError;
}

export interface AgentRuntimeOptions {
  readonly transport: AgentTransport;
  readonly store?: AgentStore;
  readonly idFactory?: VeloraIdFactory;
  readonly now?: () => number;
  /** Coalesces text and reasoning deltas; set to 0 for immediate updates. */
  readonly streamBatchMs?: number;
  readonly onEvent?: (event: AgentStreamEvent) => void;
  readonly onError?: (error: AgentError) => void;
  readonly onWarning?: (warning: AgentError) => void;
  readonly onTelemetry?: (event: AgentRuntimeTelemetryEvent) => void;
  readonly prepareRequestMessages?: (
    messages: readonly AgentRequestMessage[],
    request: Omit<ChatRequest, "messages">,
  ) => readonly AgentRequestMessage[] | Promise<readonly AgentRequestMessage[]>;
}

export interface AgentRuntime {
  readonly store: AgentStore;
  configure(options: Omit<AgentRuntimeOptions, "store">): void;
  ensureConversation(conversationId: string, initialConversation?: CreateConversationInput): void;
  send(
    conversationId: string,
    input: string,
    options?: SendMessageOptions,
    initialConversation?: CreateConversationInput,
  ): SendMessageResult;
  retry(
    conversationId: string,
    options?: RetryMessageOptions,
    initialConversation?: CreateConversationInput,
  ): SendMessageResult;
  stop(conversationId: string): boolean;
  clear(conversationId: string): void;
  approveToolCall(
    conversationId: string,
    toolCallId: string,
    options?: AgentToolDecisionOptions,
  ): Promise<AgentToolDecisionResult>;
  rejectToolCall(
    conversationId: string,
    toolCallId: string,
    options?: AgentToolDecisionOptions,
  ): Promise<AgentToolDecisionResult>;
}

function assertOptions(options: AgentRuntimeOptions): void {
  if (
    options.streamBatchMs !== undefined &&
    (!Number.isFinite(options.streamBatchMs) || options.streamBatchMs < 0)
  ) {
    throw new RangeError("streamBatchMs must be a non-negative number");
  }
}

function toAgentError(error: unknown): AgentError {
  if (error instanceof Error) {
    const candidate = error as Error & {
      readonly code?: unknown;
      readonly retryable?: unknown;
    };
    return {
      message: error.message || "The agent request failed",
      ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
      ...(typeof candidate.retryable === "boolean" ? { retryable: candidate.retryable } : {}),
    };
  }
  return {
    message: typeof error === "string" ? error : "The agent request failed",
  };
}

function mergeMetadata(
  current: JsonObject | undefined,
  next: JsonObject | undefined,
): JsonObject | undefined {
  if (!current) return next;
  if (!next) return current;
  return { ...current, ...next };
}

function completionMetadata(
  event: Extract<AgentStreamEvent, { type: "done" }>,
): JsonObject | undefined {
  const usage = event.usage
    ? {
        ...(event.usage.inputTokens !== undefined ? { inputTokens: event.usage.inputTokens } : {}),
        ...(event.usage.outputTokens !== undefined
          ? { outputTokens: event.usage.outputTokens }
          : {}),
        ...(event.usage.totalTokens !== undefined ? { totalTokens: event.usage.totalTokens } : {}),
      }
    : undefined;
  return mergeMetadata(
    event.finishReason || usage
      ? {
          ...(event.finishReason ? { finishReason: event.finishReason } : {}),
          ...(usage ? { usage } : {}),
        }
      : undefined,
    event.metadata,
  );
}

function notify<T>(callback: ((value: T) => void) | undefined, value: T): void {
  if (!callback) return;
  try {
    callback(value);
  } catch (error) {
    const reportError = (
      globalThis as typeof globalThis & {
        readonly reportError?: (caught: unknown) => void;
      }
    ).reportError;
    reportError?.(error);
  }
}

function isActiveRunStatus(status: AgentRunStatus | undefined): boolean {
  return status !== undefined && status !== "error";
}

function canSendToTransport(message: AgentMessage): boolean {
  return message.status !== "error" && message.status !== "aborted";
}

function abortMessagePatch(message: AgentMessage, completedAt: number): AgentMessagePatch {
  let stepsChanged = false;
  const steps = message.steps?.map((step) => {
    if (step.status !== "pending" && step.status !== "waiting" && step.status !== "running") {
      return step;
    }
    stepsChanged = true;
    return {
      ...step,
      status: "cancelled" as const,
      completedAt: step.completedAt ?? completedAt,
    };
  });
  return {
    status: "aborted",
    ...(stepsChanged && steps ? { steps } : {}),
  };
}

class VeloraAgentRuntime implements AgentRuntime {
  readonly store: AgentStore;
  private options: Omit<AgentRuntimeOptions, "store">;
  private readonly activeRequests = new Map<string, ActiveRequest>();

  constructor(options: AgentRuntimeOptions) {
    assertOptions(options);
    this.store =
      options.store ??
      createAgentStore({
        idFactory: options.idFactory,
        now: options.now,
      });
    this.options = { ...options };
  }

  configure(options: Omit<AgentRuntimeOptions, "store">): void {
    assertOptions(options);
    this.options = { ...options };
  }

  ensureConversation(conversationId: string, initialConversation?: CreateConversationInput): void {
    const state = this.store.getState();
    if (!state.conversationsById[conversationId]) {
      state.createConversation({ ...initialConversation, id: conversationId });
    }
  }

  send(
    conversationId: string,
    input: string,
    sendOptions: SendMessageOptions = {},
    initialConversation?: CreateConversationInput,
  ): SendMessageResult {
    if (!input.trim() && !sendOptions.attachments?.length) {
      return { accepted: false, reason: "empty" };
    }
    this.ensureConversation(conversationId, initialConversation);
    const idFactory = this.options.idFactory ?? createVeloraId;
    const now = this.options.now ?? Date.now;
    const timestamp = now();
    const userMessage: AgentMessage = {
      id: idFactory("message"),
      conversationId,
      role: "user",
      content: input,
      status: "complete",
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(sendOptions.metadata ? { metadata: sendOptions.metadata } : {}),
      ...(sendOptions.attachments?.length ? { attachments: sendOptions.attachments } : {}),
    };
    const responseMessage: AgentMessage = {
      id: idFactory("message"),
      conversationId,
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: timestamp,
      updatedAt: timestamp,
      parentId: userMessage.id,
    };
    const existingMessages = selectConversationMessages(conversationId)(this.store.getState());
    return this.startRequest({
      conversationId,
      userMessage,
      responseMessage,
      requestMessages: [...existingMessages, userMessage],
      requestId: idFactory("request"),
      appendUserMessage: true,
      requestMetadata: sendOptions.requestMetadata,
    });
  }

  retry(
    conversationId: string,
    retryOptions: RetryMessageOptions = {},
    initialConversation?: CreateConversationInput,
  ): SendMessageResult {
    this.ensureConversation(conversationId, initialConversation);
    const currentMessages = selectConversationMessages(conversationId)(this.store.getState());
    let userIndex = -1;
    for (let index = currentMessages.length - 1; index >= 0; index -= 1) {
      if (currentMessages[index]?.role === "user") {
        userIndex = index;
        break;
      }
    }
    const userMessage = currentMessages[userIndex];
    if (!userMessage || userIndex < 0) {
      return { accepted: false, reason: "no-user-message" };
    }
    const idFactory = this.options.idFactory ?? createVeloraId;
    const now = this.options.now ?? Date.now;
    const timestamp = now();
    const responseMessage: AgentMessage = {
      id: idFactory("message"),
      conversationId,
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: timestamp,
      updatedAt: timestamp,
      parentId: userMessage.id,
    };
    return this.startRequest({
      conversationId,
      userMessage,
      responseMessage,
      requestMessages: currentMessages.slice(0, userIndex + 1),
      requestId: idFactory("request"),
      appendUserMessage: false,
      requestMetadata: retryOptions.requestMetadata,
    });
  }

  stop(conversationId: string): boolean {
    const active = this.activeRequests.get(conversationId);
    if (!active) return false;
    const state = this.store.getState();
    const run = state.runsByConversation[conversationId];
    if (run?.requestId !== active.requestId || !isActiveRunStatus(run.status)) {
      this.activeRequests.delete(conversationId);
      return false;
    }
    active.flush();
    state.setRunStatus(conversationId, active.requestId, "stopping");
    active.controller.abort("Stopped by the user");
    state.patchMessage(run.responseMessageId, (message) => abortMessagePatch(message, this.now()));
    state.abortRun(conversationId, active.requestId);
    return true;
  }

  clear(conversationId: string): void {
    this.stop(conversationId);
    this.store.getState().clearConversation(conversationId);
  }

  approveToolCall(
    conversationId: string,
    toolCallId: string,
    options: AgentToolDecisionOptions = {},
  ): Promise<AgentToolDecisionResult> {
    return this.submitToolDecision(conversationId, toolCallId, "approve", options);
  }

  rejectToolCall(
    conversationId: string,
    toolCallId: string,
    options: AgentToolDecisionOptions = {},
  ): Promise<AgentToolDecisionResult> {
    return this.submitToolDecision(conversationId, toolCallId, "reject", options);
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private telemetry(event: Omit<AgentRuntimeTelemetryEvent, "timestamp">): void {
    notify(this.options.onTelemetry, { ...event, timestamp: this.now() });
  }

  private startRequest(input: RunInput): SendMessageResult {
    const state = this.store.getState();
    const started = state.beginRun(input.conversationId, {
      requestId: input.requestId,
      responseMessageId: input.responseMessage.id,
      startedAt: this.now(),
    });
    if (!started) return { accepted: false, reason: "busy" };

    try {
      state.appendMessages(
        input.appendUserMessage
          ? [input.userMessage, input.responseMessage]
          : [input.responseMessage],
      );
    } catch (error) {
      this.store.getState().abortRun(input.conversationId, input.requestId);
      throw error;
    }

    this.telemetry({
      type: "request-start",
      requestId: input.requestId,
      conversationId: input.conversationId,
    });
    return {
      accepted: true,
      requestId: input.requestId,
      userMessageId: input.userMessage.id,
      responseMessageId: input.responseMessage.id,
      completion: this.consumeRequest(input),
    };
  }

  private async consumeRequest(input: RunInput): Promise<AgentRunOutcome> {
    const controller = new AbortController();
    const batchMs = this.options.streamBatchMs ?? 16;
    let pendingText = "";
    let pendingReasoning = "";
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let firstEventSeen = false;
    const startedAt = this.now();

    const clearFlushTimer = (): void => {
      if (flushTimer !== undefined) {
        clearTimeout(flushTimer);
        flushTimer = undefined;
      }
    };
    const flushPending = (): void => {
      clearFlushTimer();
      const text = pendingText;
      const reasoning = pendingReasoning;
      pendingText = "";
      pendingReasoning = "";
      if (!text && !reasoning) return;
      const run = this.store.getState().runsByConversation[input.conversationId];
      if (run?.requestId !== input.requestId || !isActiveRunStatus(run.status)) {
        return;
      }
      this.store.getState().appendMessageDeltas(input.responseMessage.id, {
        ...(text ? { text } : {}),
        ...(reasoning ? { reasoning } : {}),
      });
    };
    const scheduleFlush = (): void => {
      if (batchMs === 0) flushPending();
      else if (flushTimer === undefined) {
        flushTimer = setTimeout(flushPending, batchMs);
      }
    };
    const markResponseAborted = (): void => {
      const message = this.store.getState().messagesById[input.responseMessage.id];
      if (message?.status === "streaming" || message?.status === "queued") {
        this.store
          .getState()
          .patchMessage(input.responseMessage.id, (current) =>
            abortMessagePatch(current, this.now()),
          );
      }
    };

    this.activeRequests.set(input.conversationId, {
      requestId: input.requestId,
      controller,
      flush: flushPending,
    });

    const requestBase = {
      requestId: input.requestId,
      protocolVersion: "1" as const,
      conversationId: input.conversationId,
      responseMessageId: input.responseMessage.id,
      ...(input.requestMetadata ? { metadata: input.requestMetadata } : {}),
    };

    let outcome: "complete" | "error" | "aborted" = "complete";
    let terminal = false;
    try {
      const requestMessages = input.requestMessages
        .filter(canSendToTransport)
        .map(toAgentRequestMessage);
      const preparedMessages = this.options.prepareRequestMessages
        ? await this.options.prepareRequestMessages(requestMessages, requestBase)
        : requestMessages;
      const request: ChatRequest = {
        ...requestBase,
        messages: preparedMessages,
      };

      for await (const event of this.options.transport.stream(request, {
        signal: controller.signal,
        onConnectionStatusChange: (status) => {
          this.store.getState().setRunStatus(input.conversationId, input.requestId, status);
        },
      })) {
        const run = this.store.getState().runsByConversation[input.conversationId];
        if (run?.requestId !== input.requestId || !isActiveRunStatus(run.status)) {
          outcome = "aborted";
          markResponseAborted();
          break;
        }
        if (!firstEventSeen) {
          firstEventSeen = true;
          this.telemetry({
            type: "first-event",
            requestId: input.requestId,
            conversationId: input.conversationId,
            durationMs: this.now() - startedAt,
            eventType: event.type,
          });
        }
        if (
          event.type !== "text-delta" &&
          event.type !== "reasoning-delta" &&
          event.type !== "reasoning-summary-delta"
        ) {
          flushPending();
        }
        notify(this.options.onEvent, event);
        const actions = this.store.getState();
        switch (event.type) {
          case "start":
            actions.setRunStatus(input.conversationId, input.requestId, "streaming");
            actions.patchMessage(input.responseMessage.id, {
              status: "streaming",
              ...(event.messageId && event.messageId !== input.responseMessage.id
                ? {
                    metadata: mergeMetadata(
                      actions.messagesById[input.responseMessage.id]?.metadata,
                      { serverMessageId: event.messageId },
                    ),
                  }
                : {}),
            });
            break;
          case "text-delta":
            actions.setRunStatus(input.conversationId, input.requestId, "streaming");
            pendingText += event.delta;
            scheduleFlush();
            break;
          case "reasoning-delta":
          case "reasoning-summary-delta":
            actions.setRunStatus(input.conversationId, input.requestId, "streaming");
            pendingReasoning += event.delta;
            scheduleFlush();
            break;
          case "step":
            actions.upsertStep(input.responseMessage.id, event.step);
            break;
          case "step-update":
            actions.patchStep(input.responseMessage.id, event.stepId, event.patch);
            break;
          case "tool-call":
            actions.upsertToolCall(input.responseMessage.id, event.toolCall);
            if (event.toolCall.status === "approval-required") {
              actions.setRunStatus(input.conversationId, input.requestId, "awaiting-approval");
            } else if (event.toolCall.status === "running") {
              actions.setRunStatus(input.conversationId, input.requestId, "running-tool");
            }
            break;
          case "tool-call-update":
            actions.patchToolCall(input.responseMessage.id, event.toolCallId, event.patch);
            if (event.patch.status === "approval-required") {
              actions.setRunStatus(input.conversationId, input.requestId, "awaiting-approval");
            } else if (event.patch.status === "running") {
              actions.setRunStatus(input.conversationId, input.requestId, "running-tool");
            } else if (event.patch.status) {
              actions.setRunStatus(input.conversationId, input.requestId, "streaming");
            }
            break;
          case "message":
            actions.patchMessage(input.responseMessage.id, {
              content: event.message.content,
              status: event.message.status,
              ...(event.message.reasoning !== undefined
                ? { reasoning: event.message.reasoning }
                : {}),
              ...(event.message.attachments !== undefined
                ? { attachments: event.message.attachments }
                : {}),
              ...(event.message.steps !== undefined ? { steps: event.message.steps } : {}),
              ...(event.message.toolCalls !== undefined
                ? { toolCalls: event.message.toolCalls }
                : {}),
              ...(event.message.branch !== undefined ? { branch: event.message.branch } : {}),
              ...(event.message.error !== undefined ? { error: event.message.error } : {}),
              metadata: mergeMetadata(
                actions.messagesById[input.responseMessage.id]?.metadata,
                event.message.metadata,
              ),
            });
            if (event.message.status === "error") {
              const messageError = event.message.error ?? {
                message: "The agent returned an error message",
              };
              if (event.message.error === undefined) {
                actions.patchMessage(input.responseMessage.id, {
                  error: messageError,
                });
              }
              actions.finishRun(input.conversationId, input.requestId, messageError);
              notify(this.options.onError, messageError);
              outcome = "error";
              terminal = true;
            } else if (event.message.status === "aborted") {
              actions.abortRun(input.conversationId, input.requestId);
              outcome = "aborted";
              terminal = true;
            }
            break;
          case "metadata":
            actions.patchMessage(input.responseMessage.id, (message) => ({
              metadata: mergeMetadata(message.metadata, event.metadata),
            }));
            break;
          case "error":
            if (event.terminal === false) {
              notify(this.options.onWarning, event.error);
              break;
            }
            actions.patchMessage(input.responseMessage.id, {
              status: "error",
              error: event.error,
            });
            actions.finishRun(input.conversationId, input.requestId, event.error);
            notify(this.options.onError, event.error);
            outcome = "error";
            terminal = true;
            break;
          case "done":
            actions.patchMessage(input.responseMessage.id, (message) => ({
              status: "complete",
              metadata: mergeMetadata(message.metadata, completionMetadata(event)),
            }));
            actions.finishRun(input.conversationId, input.requestId);
            outcome = "complete";
            terminal = true;
            break;
        }
        if (terminal) break;
      }

      if (!terminal && outcome !== "aborted") {
        flushPending();
        const run = this.store.getState().runsByConversation[input.conversationId];
        if (run?.requestId === input.requestId && isActiveRunStatus(run.status)) {
          this.store.getState().patchMessage(input.responseMessage.id, {
            status: "complete",
          });
          this.store.getState().finishRun(input.conversationId, input.requestId);
        } else {
          outcome = "aborted";
          markResponseAborted();
        }
      }
    } catch (error) {
      flushPending();
      if (controller.signal.aborted || isAbortError(error)) {
        outcome = "aborted";
        markResponseAborted();
        this.store.getState().abortRun(input.conversationId, input.requestId);
      } else {
        const agentError = toAgentError(error);
        outcome = "error";
        this.store.getState().patchMessage(input.responseMessage.id, {
          status: "error",
          error: agentError,
        });
        this.store.getState().finishRun(input.conversationId, input.requestId, agentError);
        notify(this.options.onError, agentError);
      }
    } finally {
      clearFlushTimer();
      pendingText = "";
      pendingReasoning = "";
      if (this.activeRequests.get(input.conversationId)?.requestId === input.requestId) {
        this.activeRequests.delete(input.conversationId);
      }
    }

    const completedMessage = this.store.getState().messagesById[input.responseMessage.id];
    this.telemetry({
      type:
        outcome === "complete"
          ? "request-complete"
          : outcome === "error"
            ? "request-error"
            : "request-abort",
      requestId: input.requestId,
      conversationId: input.conversationId,
      durationMs: this.now() - startedAt,
      ...(outcome === "error" && completedMessage?.error ? { error: completedMessage.error } : {}),
    });
    return {
      requestId: input.requestId,
      responseMessageId: input.responseMessage.id,
      outcome,
      ...(outcome === "error" && completedMessage?.error ? { error: completedMessage.error } : {}),
    };
  }

  private async submitToolDecision(
    conversationId: string,
    toolCallId: string,
    decision: "approve" | "reject",
    options: AgentToolDecisionOptions,
  ): Promise<AgentToolDecisionResult> {
    const run = this.store.getState().runsByConversation[conversationId];
    if (!run || !isActiveRunStatus(run.status)) {
      return { accepted: false, reason: "no-active-run" };
    }
    const message = this.store.getState().messagesById[run.responseMessageId];
    if (!message?.toolCalls?.some((toolCall) => toolCall.id === toolCallId)) {
      return { accepted: false, reason: "tool-call-not-found" };
    }
    if (!this.options.transport.submitToolDecision) {
      return { accepted: false, reason: "unsupported" };
    }

    const nextStatus = decision === "approve" ? "running" : "cancelled";
    this.store.getState().patchToolCall(run.responseMessageId, toolCallId, {
      status: nextStatus,
    });
    this.store
      .getState()
      .setRunStatus(
        conversationId,
        run.requestId,
        decision === "approve" ? "running-tool" : "streaming",
      );
    this.telemetry({
      type: "tool-decision",
      requestId: run.requestId,
      conversationId,
      toolCallId,
      decision,
    });

    try {
      await this.options.transport.submitToolDecision(
        {
          requestId: run.requestId,
          conversationId,
          responseMessageId: run.responseMessageId,
          toolCallId,
          decision,
          ...(options.result !== undefined ? { result: options.result } : {}),
          ...(options.metadata ? { metadata: options.metadata } : {}),
        },
        { signal: this.activeRequests.get(conversationId)?.controller.signal },
      );
      return { accepted: true };
    } catch (error) {
      const agentError = toAgentError(error);
      this.store.getState().patchToolCall(run.responseMessageId, toolCallId, {
        status: "error",
        error: agentError,
      });
      this.store.getState().setRunStatus(conversationId, run.requestId, "streaming");
      notify(this.options.onError, agentError);
      return { accepted: false, reason: "failed", error: agentError };
    }
  }
}

export function createAgentRuntime(options: AgentRuntimeOptions): AgentRuntime {
  return new VeloraAgentRuntime(options);
}
