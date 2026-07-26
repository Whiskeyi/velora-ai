"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import { useStore } from "zustand";

import { isAbortError } from "./sse";
import {
  createAgentStore,
  createVeloraId,
  selectConversation,
  selectConversationMessages,
  selectRun,
  type AgentMessagePatch,
  type AgentStore,
} from "./store";
import type {
  AgentError,
  AgentMessage,
  AgentRunOutcome,
  AgentStreamEvent,
  AgentTransport,
  ChatRequest,
  Conversation,
  CreateConversationInput,
  JsonObject,
  RetryMessageOptions,
  SendMessageOptions,
  SendMessageResult,
  VeloraIdFactory,
} from "./types";

interface ActiveRequest {
  readonly requestId: string;
  readonly controller: AbortController;
  readonly flush: () => void;
}

const activeRequests = new WeakMap<AgentStore, Map<string, ActiveRequest>>();

function requestMap(store: AgentStore): Map<string, ActiveRequest> {
  const existing = activeRequests.get(store);
  if (existing) {
    return existing;
  }
  const created = new Map<string, ActiveRequest>();
  activeRequests.set(store, created);
  return created;
}

function removeActiveRequest(
  store: AgentStore,
  conversationId: string,
  requestId: string,
): void {
  const requests = activeRequests.get(store);
  if (requests?.get(conversationId)?.requestId === requestId) {
    requests.delete(conversationId);
  }
  if (requests?.size === 0) {
    activeRequests.delete(store);
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
      ...(typeof candidate.retryable === "boolean"
        ? { retryable: candidate.retryable }
        : {}),
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
  if (!current) {
    return next;
  }
  if (!next) {
    return current;
  }
  return { ...current, ...next };
}

function completionMetadata(
  event: Extract<AgentStreamEvent, { type: "done" }>,
): JsonObject | undefined {
  const usage = event.usage
    ? {
        ...(event.usage.inputTokens !== undefined
          ? { inputTokens: event.usage.inputTokens }
          : {}),
        ...(event.usage.outputTokens !== undefined
          ? { outputTokens: event.usage.outputTokens }
          : {}),
        ...(event.usage.totalTokens !== undefined
          ? { totalTokens: event.usage.totalTokens }
          : {}),
      }
    : undefined;
  const protocolMetadata: JsonObject | undefined =
    event.finishReason || usage
      ? {
          ...(event.finishReason ? { finishReason: event.finishReason } : {}),
          ...(usage ? { usage } : {}),
        }
      : undefined;
  return mergeMetadata(protocolMetadata, event.metadata);
}

function notify<T>(callback: ((value: T) => void) | undefined, value: T): void {
  if (!callback) {
    return;
  }
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

function canSendToTransport(message: AgentMessage): boolean {
  return message.status !== "error" && message.status !== "aborted";
}

function abortMessagePatch(message: AgentMessage, completedAt: number): AgentMessagePatch {
  let stepsChanged = false;
  const steps = message.steps?.map((step) => {
    if (
      step.status !== "pending" &&
      step.status !== "waiting" &&
      step.status !== "running"
    ) {
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

interface RunInput {
  readonly userMessage: AgentMessage;
  readonly responseMessage: AgentMessage;
  readonly requestMessages: readonly AgentMessage[];
  readonly requestId: string;
  readonly appendUserMessage: boolean;
  readonly requestMetadata?: JsonObject;
}

export type AgentChatStatus = "idle" | "streaming" | "error";

export interface UseAgentChatOptions {
  readonly transport: AgentTransport;
  readonly store?: AgentStore;
  readonly conversationId?: string;
  readonly initialConversation?: CreateConversationInput;
  readonly idFactory?: VeloraIdFactory;
  readonly now?: () => number;
  /** Coalesces text and reasoning deltas; set to 0 for immediate updates. */
  readonly streamBatchMs?: number;
  readonly stopOnUnmount?: boolean;
  readonly onEvent?: (event: AgentStreamEvent) => void;
  readonly onError?: (error: AgentError) => void;
  readonly onWarning?: (warning: AgentError) => void;
  /** Shapes or truncates provider context immediately before transport. */
  readonly prepareRequestMessages?: (
    messages: readonly AgentMessage[],
    request: Omit<ChatRequest, "messages">,
  ) => readonly AgentMessage[] | Promise<readonly AgentMessage[]>;
}

export interface UseAgentChatResult {
  readonly store: AgentStore;
  readonly conversationId: string;
  readonly conversation: Conversation | undefined;
  readonly messages: readonly AgentMessage[];
  readonly status: AgentChatStatus;
  readonly isStreaming: boolean;
  readonly error: AgentError | undefined;
  send(input: string, options?: SendMessageOptions): SendMessageResult;
  stop(): boolean;
  retry(options?: RetryMessageOptions): SendMessageResult;
  clear(): void;
}

interface LatestOptions {
  transport: AgentTransport;
  idFactory: VeloraIdFactory;
  now: () => number;
  streamBatchMs: number;
  onEvent?: (event: AgentStreamEvent) => void;
  onError?: (error: AgentError) => void;
  onWarning?: (warning: AgentError) => void;
  prepareRequestMessages?: UseAgentChatOptions["prepareRequestMessages"];
}

function updateLatestOptions(
  ref: MutableRefObject<LatestOptions>,
  options: UseAgentChatOptions,
): void {
  ref.current = {
    transport: options.transport,
    idFactory: options.idFactory ?? createVeloraId,
    now: options.now ?? Date.now,
    streamBatchMs: options.streamBatchMs ?? 16,
    ...(options.onEvent ? { onEvent: options.onEvent } : {}),
    ...(options.onError ? { onError: options.onError } : {}),
    ...(options.onWarning ? { onWarning: options.onWarning } : {}),
    ...(options.prepareRequestMessages
      ? { prepareRequestMessages: options.prepareRequestMessages }
      : {}),
  };
}

/** Connects an AgentTransport to a normalized Velora store and React view. */
export function useAgentChat(options: UseAgentChatOptions): UseAgentChatResult {
  if (
    options.streamBatchMs !== undefined &&
    (!Number.isFinite(options.streamBatchMs) || options.streamBatchMs < 0)
  ) {
    throw new RangeError("streamBatchMs must be a non-negative number");
  }
  const internalStoreRef = useRef<AgentStore | null>(null);
  if (!internalStoreRef.current) {
    internalStoreRef.current = createAgentStore({
      idFactory: options.idFactory,
      now: options.now,
    });
  }
  const store = options.store ?? internalStoreRef.current;

  const initialConversationIdRef = useRef<string | null>(null);
  if (!initialConversationIdRef.current) {
    initialConversationIdRef.current =
      options.conversationId ??
      options.initialConversation?.id ??
      (options.idFactory ?? createVeloraId)("conversation");
  }
  const conversationId =
    options.conversationId ?? initialConversationIdRef.current;

  const latestRef = useRef<LatestOptions>({
    transport: options.transport,
    idFactory: options.idFactory ?? createVeloraId,
    now: options.now ?? Date.now,
    streamBatchMs: options.streamBatchMs ?? 16,
  });
  updateLatestOptions(latestRef, options);

  useEffect(() => {
    const state = store.getState();
    if (!state.conversationsById[conversationId]) {
      state.createConversation({
        ...options.initialConversation,
        id: conversationId,
      });
    }
  }, [conversationId, options.initialConversation, store]);

  const conversationSelector = useMemo(
    () => selectConversation(conversationId),
    [conversationId],
  );
  const messageSelector = useMemo(
    () => selectConversationMessages(conversationId),
    [conversationId],
  );
  const runSelector = useMemo(
    () => selectRun(conversationId),
    [conversationId],
  );
  const conversation = useStore(store, conversationSelector);
  const messages = useStore(store, messageSelector);
  const run = useStore(store, runSelector);

  const ensureConversation = useCallback((): void => {
    const state = store.getState();
    if (!state.conversationsById[conversationId]) {
      state.createConversation({
        ...options.initialConversation,
        id: conversationId,
      });
    }
  }, [conversationId, options.initialConversation, store]);

  const consumeRequest = useCallback(
    async (input: RunInput): Promise<AgentRunOutcome> => {
      const controller = new AbortController();
      const batchMs = latestRef.current.streamBatchMs;
      let pendingText = "";
      let pendingReasoning = "";
      let flushTimer: ReturnType<typeof setTimeout> | undefined;

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
        if (!text && !reasoning) {
          return;
        }
        const currentRun = store.getState().runsByConversation[conversationId];
        if (
          currentRun?.requestId !== input.requestId ||
          currentRun.status !== "streaming"
        ) {
          return;
        }
        store.getState().appendMessageDeltas(input.responseMessage.id, {
          ...(text ? { text } : {}),
          ...(reasoning ? { reasoning } : {}),
        });
      };

      const scheduleFlush = (): void => {
        if (batchMs === 0) {
          flushPending();
        } else if (flushTimer === undefined) {
          flushTimer = setTimeout(flushPending, batchMs);
        }
      };

      const markResponseAborted = (): void => {
        const currentMessage =
          store.getState().messagesById[input.responseMessage.id];
        if (
          currentMessage?.status === "streaming" ||
          currentMessage?.status === "queued"
        ) {
          store
            .getState()
            .patchMessage(input.responseMessage.id, (message) =>
              abortMessagePatch(message, latestRef.current.now()),
            );
        }
      };

      requestMap(store).set(conversationId, {
        requestId: input.requestId,
        controller,
        flush: flushPending,
      });

      const requestBase = {
        conversationId,
        responseMessageId: input.responseMessage.id,
        ...(input.requestMetadata
          ? { metadata: input.requestMetadata }
          : {}),
      };

      let outcome: "complete" | "error" | "aborted" = "complete";
      let terminal = false;
      try {
        const transportMessages = input.requestMessages.filter(canSendToTransport);
        const preparedMessages = latestRef.current.prepareRequestMessages
          ? await latestRef.current.prepareRequestMessages(
              transportMessages,
              requestBase,
            )
          : transportMessages;
        const request: ChatRequest = {
          ...requestBase,
          messages: preparedMessages,
        };
        for await (const event of latestRef.current.transport.stream(request, {
          signal: controller.signal,
        })) {
          const currentRun =
            store.getState().runsByConversation[conversationId];
          if (
            currentRun?.requestId !== input.requestId ||
            currentRun.status !== "streaming"
          ) {
            outcome = "aborted";
            markResponseAborted();
            break;
          }

          if (
            event.type !== "text-delta" &&
            event.type !== "reasoning-delta"
          ) {
            flushPending();
          }
          notify(latestRef.current.onEvent, event);
          const actions = store.getState();
          switch (event.type) {
            case "start":
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
              pendingText += event.delta;
              scheduleFlush();
              break;
            case "reasoning-delta":
              pendingReasoning += event.delta;
              scheduleFlush();
              break;
            case "step":
              actions.upsertStep(input.responseMessage.id, event.step);
              break;
            case "step-update":
              actions.patchStep(
                input.responseMessage.id,
                event.stepId,
                event.patch,
              );
              break;
            case "tool-call":
              actions.upsertToolCall(
                input.responseMessage.id,
                event.toolCall,
              );
              break;
            case "tool-call-update":
              actions.patchToolCall(
                input.responseMessage.id,
                event.toolCallId,
                event.patch,
              );
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
                ...(event.message.steps !== undefined
                  ? { steps: event.message.steps }
                  : {}),
                ...(event.message.error !== undefined
                  ? { error: event.message.error }
                  : {}),
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
                actions.finishRun(
                  conversationId,
                  input.requestId,
                  messageError,
                );
                notify(latestRef.current.onError, messageError);
                outcome = "error";
                terminal = true;
              } else if (event.message.status === "aborted") {
                actions.abortRun(conversationId, input.requestId);
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
                notify(latestRef.current.onWarning, event.error);
                break;
              }
              actions.patchMessage(input.responseMessage.id, {
                status: "error",
                error: event.error,
              });
              actions.finishRun(conversationId, input.requestId, event.error);
              notify(latestRef.current.onError, event.error);
              outcome = "error";
              terminal = true;
              break;
            case "done":
              actions.patchMessage(input.responseMessage.id, (message) => ({
                status: "complete",
                metadata: mergeMetadata(
                  message.metadata,
                  completionMetadata(event),
                ),
              }));
              actions.finishRun(conversationId, input.requestId);
              outcome = "complete";
              terminal = true;
              break;
          }

          if (terminal) {
            break;
          }
        }

        if (!terminal && outcome !== "aborted") {
          flushPending();
          const currentRun =
            store.getState().runsByConversation[conversationId];
          if (
            currentRun?.requestId === input.requestId &&
            currentRun.status === "streaming"
          ) {
            store.getState().patchMessage(input.responseMessage.id, {
              status: "complete",
            });
            store.getState().finishRun(conversationId, input.requestId);
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
          store.getState().abortRun(conversationId, input.requestId);
        } else {
          const agentError = toAgentError(error);
          outcome = "error";
          store.getState().patchMessage(input.responseMessage.id, {
            status: "error",
            error: agentError,
          });
          store
            .getState()
            .finishRun(conversationId, input.requestId, agentError);
          notify(latestRef.current.onError, agentError);
        }
      } finally {
        clearFlushTimer();
        pendingText = "";
        pendingReasoning = "";
        removeActiveRequest(store, conversationId, input.requestId);
      }

      const completedMessage = store.getState().messagesById[input.responseMessage.id];
      return {
        requestId: input.requestId,
        responseMessageId: input.responseMessage.id,
        outcome,
        ...(outcome === "error" && completedMessage?.error
          ? { error: completedMessage.error }
          : {}),
      };
    },
    [conversationId, store],
  );

  const startRequest = useCallback(
    (input: RunInput): SendMessageResult => {
      const state = store.getState();
      const started = state.beginRun(conversationId, {
        requestId: input.requestId,
        responseMessageId: input.responseMessage.id,
        startedAt: latestRef.current.now(),
      });
      if (!started) {
        return { accepted: false, reason: "busy" };
      }

      try {
        state.appendMessages(
          input.appendUserMessage
            ? [input.userMessage, input.responseMessage]
            : [input.responseMessage],
        );
      } catch (error) {
        store.getState().abortRun(conversationId, input.requestId);
        throw error;
      }

      return {
        accepted: true,
        requestId: input.requestId,
        userMessageId: input.userMessage.id,
        responseMessageId: input.responseMessage.id,
        completion: consumeRequest(input),
      };
    },
    [consumeRequest, conversationId, store],
  );

  const send = useCallback(
    (
      input: string,
      sendOptions: SendMessageOptions = {},
    ): SendMessageResult => {
      if (!input.trim()) {
        return { accepted: false, reason: "empty" };
      }
      ensureConversation();

      const { idFactory, now } = latestRef.current;
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
        ...(sendOptions.attachments?.length
          ? { attachments: sendOptions.attachments }
          : {}),
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
      const existingMessages = selectConversationMessages(conversationId)(
        store.getState(),
      );
      return startRequest({
        userMessage,
        responseMessage,
        requestMessages: [...existingMessages, userMessage],
        requestId: idFactory("request"),
        appendUserMessage: true,
        requestMetadata: sendOptions.requestMetadata,
      });
    },
    [conversationId, ensureConversation, startRequest, store],
  );

  const retry = useCallback(
    (retryOptions: RetryMessageOptions = {}): SendMessageResult => {
      ensureConversation();
      const currentMessages = selectConversationMessages(conversationId)(
        store.getState(),
      );
      let userIndex = -1;
      for (let index = currentMessages.length - 1; index >= 0; index -= 1) {
        if (currentMessages[index]?.role === "user") {
          userIndex = index;
          break;
        }
      }
      const userMessage = currentMessages[userIndex];
      if (!userMessage || userIndex === -1) {
        return { accepted: false, reason: "no-user-message" };
      }

      const { idFactory, now } = latestRef.current;
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
      return startRequest({
        userMessage,
        responseMessage,
        requestMessages: currentMessages.slice(0, userIndex + 1),
        requestId: idFactory("request"),
        appendUserMessage: false,
        requestMetadata: retryOptions.requestMetadata,
      });
    },
    [conversationId, ensureConversation, startRequest, store],
  );

  const stop = useCallback((): boolean => {
    const active = activeRequests.get(store)?.get(conversationId);
    if (!active) {
      return false;
    }
    const state = store.getState();
    const runState = state.runsByConversation[conversationId];
    if (
      runState?.requestId !== active.requestId ||
      runState.status !== "streaming"
    ) {
      removeActiveRequest(store, conversationId, active.requestId);
      return false;
    }
    active.flush();
    active.controller.abort("Stopped by the user");
    state.patchMessage(runState.responseMessageId, (message) =>
      abortMessagePatch(message, latestRef.current.now()),
    );
    state.abortRun(conversationId, active.requestId);
    return true;
  }, [conversationId, store]);

  const clear = useCallback((): void => {
    stop();
    store.getState().clearConversation(conversationId);
  }, [conversationId, stop, store]);

  useEffect(
    () => () => {
      if (options.stopOnUnmount !== false) {
        stop();
      }
    },
    [options.stopOnUnmount, stop],
  );

  return {
    store,
    conversationId,
    conversation,
    messages,
    status: run?.status ?? "idle",
    isStreaming: run?.status === "streaming",
    error: run?.error,
    send,
    stop,
    retry,
    clear,
  };
}
