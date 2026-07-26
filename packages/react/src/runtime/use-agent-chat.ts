"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";

import {
  createAgentRuntime,
  type AgentRuntime,
  type AgentRuntimeOptions,
  type AgentRuntimeTelemetryEvent,
} from "./agent-runtime";
import {
  createVeloraId,
  selectConversation,
  selectConversationMessages,
  selectRun,
  type AgentStore,
} from "./store";
import type {
  AgentError,
  AgentMessage,
  AgentRunStatus,
  AgentStreamEvent,
  AgentToolDecisionOptions,
  AgentToolDecisionResult,
  AgentTransport,
  Conversation,
  CreateConversationInput,
  RetryMessageOptions,
  SendMessageOptions,
  SendMessageResult,
  VeloraIdFactory,
} from "./types";

export type AgentChatStatus = "idle" | AgentRunStatus;

export interface UseAgentChatOptions {
  readonly transport: AgentTransport;
  /** Reuse a headless runtime across routes, panes, or background views. */
  readonly runtime?: AgentRuntime;
  /** Store for an internally-created runtime. Ignored when runtime is supplied. */
  readonly store?: AgentStore;
  readonly conversationId?: string;
  readonly initialConversation?: CreateConversationInput;
  readonly idFactory?: VeloraIdFactory;
  readonly now?: () => number;
  readonly streamBatchMs?: number;
  /** Explicit opt-in. Headless runs survive view unmounts by default. */
  readonly stopOnUnmount?: boolean;
  readonly onEvent?: (event: AgentStreamEvent) => void;
  readonly onError?: (error: AgentError) => void;
  readonly onWarning?: (warning: AgentError) => void;
  readonly onTelemetry?: (event: AgentRuntimeTelemetryEvent) => void;
  readonly prepareRequestMessages?: AgentRuntimeOptions["prepareRequestMessages"];
}

export interface UseAgentChatResult {
  readonly runtime: AgentRuntime;
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
  approveToolCall(
    toolCallId: string,
    options?: AgentToolDecisionOptions,
  ): Promise<AgentToolDecisionResult>;
  rejectToolCall(
    toolCallId: string,
    options?: AgentToolDecisionOptions,
  ): Promise<AgentToolDecisionResult>;
}

function runtimeOptions(options: UseAgentChatOptions): Omit<AgentRuntimeOptions, "store"> {
  return {
    transport: options.transport,
    ...(options.idFactory ? { idFactory: options.idFactory } : {}),
    ...(options.now ? { now: options.now } : {}),
    ...(options.streamBatchMs !== undefined ? { streamBatchMs: options.streamBatchMs } : {}),
    ...(options.onEvent ? { onEvent: options.onEvent } : {}),
    ...(options.onError ? { onError: options.onError } : {}),
    ...(options.onWarning ? { onWarning: options.onWarning } : {}),
    ...(options.onTelemetry ? { onTelemetry: options.onTelemetry } : {}),
    ...(options.prepareRequestMessages
      ? { prepareRequestMessages: options.prepareRequestMessages }
      : {}),
  };
}

function isActive(status: AgentRunStatus | undefined): boolean {
  return status !== undefined && status !== "error";
}

/** Subscribes a React view to a headless AgentRuntime conversation. */
export function useAgentChat(options: UseAgentChatOptions): UseAgentChatResult {
  const internalRuntimeRef = useRef<AgentRuntime | null>(null);
  if (!internalRuntimeRef.current) {
    internalRuntimeRef.current = createAgentRuntime({
      ...runtimeOptions(options),
      ...(options.store ? { store: options.store } : {}),
    });
  }
  const runtime = options.runtime ?? internalRuntimeRef.current;
  if (options.runtime && options.store && options.runtime.store !== options.store) {
    throw new Error("Use either runtime or its store, not a different store");
  }
  runtime.configure(runtimeOptions(options));
  const store = runtime.store;

  const generatedConversationIdRef = useRef<string | null>(null);
  if (!generatedConversationIdRef.current) {
    generatedConversationIdRef.current =
      options.conversationId ??
      options.initialConversation?.id ??
      (options.idFactory ?? createVeloraId)("conversation");
  }
  const conversationId = options.conversationId ?? generatedConversationIdRef.current;

  useEffect(() => {
    runtime.ensureConversation(conversationId, options.initialConversation);
  }, [conversationId, options.initialConversation, runtime]);

  const conversationSelector = useMemo(() => selectConversation(conversationId), [conversationId]);
  const messageSelector = useMemo(
    () => selectConversationMessages(conversationId),
    [conversationId],
  );
  const runSelector = useMemo(() => selectRun(conversationId), [conversationId]);
  const conversation = useStore(store, conversationSelector);
  const messages = useStore(store, messageSelector);
  const run = useStore(store, runSelector);

  const send = useCallback(
    (input: string, sendOptions?: SendMessageOptions) =>
      runtime.send(conversationId, input, sendOptions, options.initialConversation),
    [conversationId, options.initialConversation, runtime],
  );
  const retry = useCallback(
    (retryOptions?: RetryMessageOptions) =>
      runtime.retry(conversationId, retryOptions, options.initialConversation),
    [conversationId, options.initialConversation, runtime],
  );
  const stop = useCallback(() => runtime.stop(conversationId), [conversationId, runtime]);
  const clear = useCallback(() => runtime.clear(conversationId), [conversationId, runtime]);
  const approveToolCall = useCallback(
    (toolCallId: string, decisionOptions?: AgentToolDecisionOptions) =>
      runtime.approveToolCall(conversationId, toolCallId, decisionOptions),
    [conversationId, runtime],
  );
  const rejectToolCall = useCallback(
    (toolCallId: string, decisionOptions?: AgentToolDecisionOptions) =>
      runtime.rejectToolCall(conversationId, toolCallId, decisionOptions),
    [conversationId, runtime],
  );

  useEffect(
    () => () => {
      if (options.stopOnUnmount === true) stop();
    },
    [options.stopOnUnmount, stop],
  );

  return {
    runtime,
    store,
    conversationId,
    conversation,
    messages,
    status: run?.status ?? "idle",
    isStreaming: isActive(run?.status),
    error: run?.error,
    send,
    stop,
    retry,
    clear,
    approveToolCall,
    rejectToolCall,
  };
}
