import { createStore, type StoreApi } from "zustand/vanilla";

import type {
  AgentError,
  AgentMessage,
  AgentRunStatus,
  AgentStep,
  AgentToolCall,
  Conversation,
  CreateConversationInput,
  VeloraIdFactory,
  VeloraIdKind,
} from "./types";

export interface AgentRunState {
  readonly requestId: string;
  readonly responseMessageId: string;
  readonly status: AgentRunStatus;
  readonly startedAt: number;
  readonly error?: AgentError;
}

export type AgentMessagePatch = Partial<
  Omit<AgentMessage, "id" | "conversationId" | "createdAt" | "updatedAt">
>;

export type ConversationPatch = Partial<
  Omit<Conversation, "id" | "messageIds" | "createdAt" | "updatedAt">
>;

export interface AgentStoreData {
  readonly conversationsById: Readonly<Record<string, Conversation>>;
  readonly messagesById: Readonly<Record<string, AgentMessage>>;
  readonly conversationOrder: readonly string[];
  readonly messageVersionByConversation: Readonly<Record<string, number>>;
  readonly lastChangedMessageIdByConversation: Readonly<Partial<Record<string, string>>>;
  readonly runsByConversation: Readonly<Record<string, AgentRunState>>;
  readonly activeConversationId: string | null;
}

export interface AgentStoreActions {
  createConversation(input?: CreateConversationInput): string;
  patchConversation(conversationId: string, patch: ConversationPatch): void;
  removeConversation(conversationId: string): void;
  clearConversation(conversationId: string): void;
  setActiveConversation(conversationId: string | null): void;
  appendMessages(messages: readonly AgentMessage[]): void;
  patchMessage(
    messageId: string,
    patch: AgentMessagePatch | ((message: AgentMessage) => AgentMessagePatch),
  ): void;
  removeMessage(messageId: string): void;
  appendMessageText(messageId: string, delta: string): void;
  appendMessageReasoning(messageId: string, delta: string): void;
  appendMessageDeltas(
    messageId: string,
    deltas: { readonly text?: string; readonly reasoning?: string },
  ): void;
  upsertStep(messageId: string, step: AgentStep): void;
  patchStep(messageId: string, stepId: string, patch: Partial<Omit<AgentStep, "id">>): void;
  upsertToolCall(messageId: string, toolCall: AgentToolCall): void;
  patchToolCall(
    messageId: string,
    toolCallId: string,
    patch: Partial<Omit<AgentToolCall, "id">>,
  ): void;
  beginRun(conversationId: string, run: Omit<AgentRunState, "status">): boolean;
  setRunStatus(
    conversationId: string,
    requestId: string,
    status: Exclude<AgentRunStatus, "error">,
  ): void;
  finishRun(conversationId: string, requestId: string, error?: AgentError): void;
  abortRun(conversationId: string, requestId: string): void;
}

export type AgentStoreState = AgentStoreData & AgentStoreActions;
export type AgentStore = StoreApi<AgentStoreState>;

export interface CreateAgentStoreOptions {
  readonly conversations?: readonly Conversation[];
  readonly messages?: readonly AgentMessage[];
  readonly activeConversationId?: string | null;
  readonly idFactory?: VeloraIdFactory;
  readonly now?: () => number;
}

let fallbackId = 0;

/** Default collision-resistant id generator used by Velora runtime primitives. */
export function createVeloraId(kind: VeloraIdKind): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) {
    return `velora-${kind}-${randomId}`;
  }
  fallbackId += 1;
  return `velora-${kind}-${Date.now().toString(36)}-${fallbackId.toString(36)}`;
}

function deleteKey<T>(source: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const result = { ...source };
  delete result[key];
  return result;
}

function createInitialData(options: CreateAgentStoreOptions): AgentStoreData {
  let conversationsById: Record<string, Conversation> = {};
  const conversationOrder: string[] = [];
  for (const conversation of options.conversations ?? []) {
    if (conversationsById[conversation.id]) {
      throw new Error(`Duplicate conversation id: ${conversation.id}`);
    }
    if (new Set(conversation.messageIds).size !== conversation.messageIds.length) {
      throw new Error(`Conversation ${conversation.id} contains duplicate message ids`);
    }
    conversationsById[conversation.id] = {
      ...conversation,
      messageIds: [...conversation.messageIds],
    };
    conversationOrder.push(conversation.id);
  }

  const messagesById: Record<string, AgentMessage> = {};
  for (const message of options.messages ?? []) {
    if (messagesById[message.id]) {
      throw new Error(`Duplicate message id: ${message.id}`);
    }
    const conversation = conversationsById[message.conversationId];
    if (!conversation) {
      throw new Error(
        `Message ${message.id} references unknown conversation ${message.conversationId}`,
      );
    }
    messagesById[message.id] = message;
    if (!conversation.messageIds.includes(message.id)) {
      conversationsById = {
        ...conversationsById,
        [conversation.id]: {
          ...conversation,
          messageIds: [...conversation.messageIds, message.id],
        },
      };
    }
  }

  for (const conversation of Object.values(conversationsById)) {
    for (const messageId of conversation.messageIds) {
      const message = messagesById[messageId];
      if (!message || message.conversationId !== conversation.id) {
        throw new Error(`Conversation ${conversation.id} references invalid message ${messageId}`);
      }
    }
  }

  const activeConversationId = options.activeConversationId ?? null;
  if (activeConversationId && !conversationsById[activeConversationId]) {
    throw new Error(`Unknown active conversation: ${activeConversationId}`);
  }

  return {
    conversationsById,
    messagesById,
    conversationOrder,
    messageVersionByConversation: Object.fromEntries(conversationOrder.map((id) => [id, 0])),
    lastChangedMessageIdByConversation: {},
    runsByConversation: {},
    activeConversationId,
  };
}

/** Creates an isolated, normalized Zustand vanilla store. */
export function createAgentStore(options: CreateAgentStoreOptions = {}): AgentStore {
  const now = options.now ?? Date.now;
  const idFactory = options.idFactory ?? createVeloraId;
  const initialData = createInitialData(options);

  return createStore<AgentStoreState>()((set) => ({
    ...initialData,

    createConversation(input = {}) {
      const id = input.id ?? idFactory("conversation");
      set((state) => {
        if (state.conversationsById[id]) {
          return state;
        }
        const createdAt = input.createdAt ?? now();
        const conversation: Conversation = {
          id,
          messageIds: [],
          createdAt,
          updatedAt: createdAt,
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        };
        return {
          ...state,
          conversationsById: {
            ...state.conversationsById,
            [id]: conversation,
          },
          conversationOrder: [...state.conversationOrder, id],
          messageVersionByConversation: {
            ...state.messageVersionByConversation,
            [id]: 0,
          },
        };
      });
      return id;
    },

    patchConversation(conversationId, patch) {
      set((state) => {
        const conversation = state.conversationsById[conversationId];
        if (!conversation) {
          return state;
        }
        return {
          ...state,
          conversationsById: {
            ...state.conversationsById,
            [conversationId]: {
              ...conversation,
              ...patch,
              updatedAt: now(),
            },
          },
        };
      });
    },

    removeConversation(conversationId) {
      set((state) => {
        const conversation = state.conversationsById[conversationId];
        if (!conversation) {
          return state;
        }
        let messagesById = { ...state.messagesById };
        for (const messageId of conversation.messageIds) {
          delete messagesById[messageId];
        }
        return {
          ...state,
          conversationsById: deleteKey(state.conversationsById, conversationId),
          messagesById,
          conversationOrder: state.conversationOrder.filter((id) => id !== conversationId),
          messageVersionByConversation: deleteKey(
            state.messageVersionByConversation,
            conversationId,
          ),
          lastChangedMessageIdByConversation: deleteKey(
            state.lastChangedMessageIdByConversation,
            conversationId,
          ),
          runsByConversation: deleteKey(state.runsByConversation, conversationId),
          activeConversationId:
            state.activeConversationId === conversationId ? null : state.activeConversationId,
        };
      });
    },

    clearConversation(conversationId) {
      set((state) => {
        const conversation = state.conversationsById[conversationId];
        if (!conversation) {
          return state;
        }
        const messagesById = { ...state.messagesById };
        for (const messageId of conversation.messageIds) {
          delete messagesById[messageId];
        }
        return {
          ...state,
          conversationsById: {
            ...state.conversationsById,
            [conversationId]: {
              ...conversation,
              messageIds: [],
              updatedAt: now(),
            },
          },
          messagesById,
          messageVersionByConversation: {
            ...state.messageVersionByConversation,
            [conversationId]: (state.messageVersionByConversation[conversationId] ?? 0) + 1,
          },
          lastChangedMessageIdByConversation: deleteKey(
            state.lastChangedMessageIdByConversation,
            conversationId,
          ),
          runsByConversation: deleteKey(state.runsByConversation, conversationId),
        };
      });
    },

    setActiveConversation(conversationId) {
      set((state) => {
        if (
          state.activeConversationId === conversationId ||
          (conversationId !== null && !state.conversationsById[conversationId])
        ) {
          return state;
        }
        return { ...state, activeConversationId: conversationId };
      });
    },

    appendMessages(messages) {
      if (messages.length === 0) {
        return;
      }
      set((state) => {
        const messagesById = { ...state.messagesById };
        const conversationsById = { ...state.conversationsById };
        const messageVersionByConversation = {
          ...state.messageVersionByConversation,
        };
        const lastChangedMessageIdByConversation = {
          ...state.lastChangedMessageIdByConversation,
        };
        const batchIds = new Set<string>();

        for (const message of messages) {
          if (messagesById[message.id] || batchIds.has(message.id)) {
            throw new Error(`Duplicate message id: ${message.id}`);
          }
          const conversation = conversationsById[message.conversationId];
          if (!conversation) {
            throw new Error(
              `Unknown conversation for message ${message.id}: ${message.conversationId}`,
            );
          }
          batchIds.add(message.id);
          messagesById[message.id] = message;
          conversationsById[conversation.id] = {
            ...conversation,
            messageIds: [...conversation.messageIds, message.id],
            updatedAt: Math.max(conversation.updatedAt, message.updatedAt),
          };
          messageVersionByConversation[conversation.id] =
            (messageVersionByConversation[conversation.id] ?? 0) + 1;
          lastChangedMessageIdByConversation[conversation.id] = message.id;
        }

        return {
          ...state,
          messagesById,
          conversationsById,
          messageVersionByConversation,
          lastChangedMessageIdByConversation,
        };
      });
    },

    patchMessage(messageId, patch) {
      set((state) => {
        const message = state.messagesById[messageId];
        if (!message) {
          return state;
        }
        const resolvedPatch = typeof patch === "function" ? patch(message) : patch;
        const updatedMessage: AgentMessage = {
          ...message,
          ...resolvedPatch,
          id: message.id,
          conversationId: message.conversationId,
          createdAt: message.createdAt,
          updatedAt: now(),
        };
        return {
          ...state,
          messagesById: {
            ...state.messagesById,
            [messageId]: updatedMessage,
          },
          messageVersionByConversation: {
            ...state.messageVersionByConversation,
            [message.conversationId]:
              (state.messageVersionByConversation[message.conversationId] ?? 0) + 1,
          },
          lastChangedMessageIdByConversation: {
            ...state.lastChangedMessageIdByConversation,
            [message.conversationId]: messageId,
          },
        };
      });
    },

    removeMessage(messageId) {
      set((state) => {
        const message = state.messagesById[messageId];
        if (!message) {
          return state;
        }
        const conversation = state.conversationsById[message.conversationId];
        return {
          ...state,
          messagesById: deleteKey(state.messagesById, messageId),
          conversationsById: conversation
            ? {
                ...state.conversationsById,
                [conversation.id]: {
                  ...conversation,
                  messageIds: conversation.messageIds.filter((id) => id !== messageId),
                  updatedAt: now(),
                },
              }
            : state.conversationsById,
          messageVersionByConversation: {
            ...state.messageVersionByConversation,
            [message.conversationId]:
              (state.messageVersionByConversation[message.conversationId] ?? 0) + 1,
          },
          lastChangedMessageIdByConversation: {
            ...state.lastChangedMessageIdByConversation,
            [message.conversationId]: messageId,
          },
        };
      });
    },

    appendMessageText(messageId, delta) {
      if (!delta) {
        return;
      }
      set((state) => {
        const message = state.messagesById[messageId];
        if (!message) {
          return state;
        }
        return {
          ...state,
          messagesById: {
            ...state.messagesById,
            [messageId]: {
              ...message,
              content: message.content + delta,
              updatedAt: now(),
            },
          },
          messageVersionByConversation: {
            ...state.messageVersionByConversation,
            [message.conversationId]:
              (state.messageVersionByConversation[message.conversationId] ?? 0) + 1,
          },
          lastChangedMessageIdByConversation: {
            ...state.lastChangedMessageIdByConversation,
            [message.conversationId]: messageId,
          },
        };
      });
    },

    appendMessageReasoning(messageId, delta) {
      if (!delta) {
        return;
      }
      set((state) => {
        const message = state.messagesById[messageId];
        if (!message) {
          return state;
        }
        return {
          ...state,
          messagesById: {
            ...state.messagesById,
            [messageId]: {
              ...message,
              reasoning: (message.reasoning ?? "") + delta,
              updatedAt: now(),
            },
          },
          messageVersionByConversation: {
            ...state.messageVersionByConversation,
            [message.conversationId]:
              (state.messageVersionByConversation[message.conversationId] ?? 0) + 1,
          },
          lastChangedMessageIdByConversation: {
            ...state.lastChangedMessageIdByConversation,
            [message.conversationId]: messageId,
          },
        };
      });
    },

    appendMessageDeltas(messageId, deltas) {
      if (!deltas.text && !deltas.reasoning) {
        return;
      }
      set((state) => {
        const message = state.messagesById[messageId];
        if (!message) {
          return state;
        }
        return {
          ...state,
          messagesById: {
            ...state.messagesById,
            [messageId]: {
              ...message,
              ...(deltas.text ? { content: message.content + deltas.text } : {}),
              ...(deltas.reasoning
                ? {
                    reasoning: (message.reasoning ?? "") + deltas.reasoning,
                  }
                : {}),
              updatedAt: now(),
            },
          },
          messageVersionByConversation: {
            ...state.messageVersionByConversation,
            [message.conversationId]:
              (state.messageVersionByConversation[message.conversationId] ?? 0) + 1,
          },
          lastChangedMessageIdByConversation: {
            ...state.lastChangedMessageIdByConversation,
            [message.conversationId]: messageId,
          },
        };
      });
    },

    upsertStep(messageId, step) {
      set((state) => {
        const message = state.messagesById[messageId];
        if (!message) {
          return state;
        }
        const steps = [...(message.steps ?? [])];
        const index = steps.findIndex((candidate) => candidate.id === step.id);
        if (index === -1) {
          steps.push(step);
        } else {
          steps[index] = { ...steps[index], ...step };
        }
        return {
          ...state,
          messagesById: {
            ...state.messagesById,
            [messageId]: { ...message, steps, updatedAt: now() },
          },
          messageVersionByConversation: {
            ...state.messageVersionByConversation,
            [message.conversationId]:
              (state.messageVersionByConversation[message.conversationId] ?? 0) + 1,
          },
          lastChangedMessageIdByConversation: {
            ...state.lastChangedMessageIdByConversation,
            [message.conversationId]: messageId,
          },
        };
      });
    },

    patchStep(messageId, stepId, patch) {
      set((state) => {
        const message = state.messagesById[messageId];
        const index = message?.steps?.findIndex((step) => step.id === stepId) ?? -1;
        if (!message?.steps || index === -1) {
          return state;
        }
        const steps = [...message.steps];
        const currentStep = steps[index];
        if (!currentStep) {
          return state;
        }
        steps[index] = { ...currentStep, ...patch, id: currentStep.id };
        return {
          ...state,
          messagesById: {
            ...state.messagesById,
            [messageId]: { ...message, steps, updatedAt: now() },
          },
          messageVersionByConversation: {
            ...state.messageVersionByConversation,
            [message.conversationId]:
              (state.messageVersionByConversation[message.conversationId] ?? 0) + 1,
          },
          lastChangedMessageIdByConversation: {
            ...state.lastChangedMessageIdByConversation,
            [message.conversationId]: messageId,
          },
        };
      });
    },

    upsertToolCall(messageId, toolCall) {
      set((state) => {
        const message = state.messagesById[messageId];
        if (!message) return state;
        const toolCalls = [...(message.toolCalls ?? [])];
        const index = toolCalls.findIndex((candidate) => candidate.id === toolCall.id);
        if (index === -1) toolCalls.push(toolCall);
        else toolCalls[index] = { ...toolCalls[index], ...toolCall };
        return {
          ...state,
          messagesById: {
            ...state.messagesById,
            [messageId]: { ...message, toolCalls, updatedAt: now() },
          },
          messageVersionByConversation: {
            ...state.messageVersionByConversation,
            [message.conversationId]:
              (state.messageVersionByConversation[message.conversationId] ?? 0) + 1,
          },
          lastChangedMessageIdByConversation: {
            ...state.lastChangedMessageIdByConversation,
            [message.conversationId]: messageId,
          },
        };
      });
    },

    patchToolCall(messageId, toolCallId, patch) {
      set((state) => {
        const message = state.messagesById[messageId];
        const index = message?.toolCalls?.findIndex((toolCall) => toolCall.id === toolCallId) ?? -1;
        if (!message?.toolCalls || index === -1) return state;
        const toolCalls = [...message.toolCalls];
        const current = toolCalls[index];
        if (!current) return state;
        toolCalls[index] = { ...current, ...patch, id: current.id };
        return {
          ...state,
          messagesById: {
            ...state.messagesById,
            [messageId]: { ...message, toolCalls, updatedAt: now() },
          },
          messageVersionByConversation: {
            ...state.messageVersionByConversation,
            [message.conversationId]:
              (state.messageVersionByConversation[message.conversationId] ?? 0) + 1,
          },
          lastChangedMessageIdByConversation: {
            ...state.lastChangedMessageIdByConversation,
            [message.conversationId]: messageId,
          },
        };
      });
    },

    beginRun(conversationId, run) {
      let started = false;
      set((state) => {
        if (
          !state.conversationsById[conversationId] ||
          (state.runsByConversation[conversationId] &&
            state.runsByConversation[conversationId]?.status !== "error")
        ) {
          return state;
        }
        started = true;
        return {
          ...state,
          runsByConversation: {
            ...state.runsByConversation,
            [conversationId]: { ...run, status: "streaming" },
          },
        };
      });
      return started;
    },

    setRunStatus(conversationId, requestId, status) {
      set((state) => {
        const run = state.runsByConversation[conversationId];
        if (!run || run.requestId !== requestId || run.status === "error") {
          return state;
        }
        return {
          ...state,
          runsByConversation: {
            ...state.runsByConversation,
            [conversationId]: { ...run, status },
          },
        };
      });
    },

    finishRun(conversationId, requestId, error) {
      set((state) => {
        const run = state.runsByConversation[conversationId];
        if (!run || run.requestId !== requestId) {
          return state;
        }
        return {
          ...state,
          runsByConversation: error
            ? {
                ...state.runsByConversation,
                [conversationId]: { ...run, status: "error", error },
              }
            : deleteKey(state.runsByConversation, conversationId),
        };
      });
    },

    abortRun(conversationId, requestId) {
      set((state) => {
        const run = state.runsByConversation[conversationId];
        if (!run || run.requestId !== requestId) {
          return state;
        }
        return {
          ...state,
          runsByConversation: deleteKey(state.runsByConversation, conversationId),
        };
      });
    },
  }));
}

const EMPTY_MESSAGES: readonly AgentMessage[] = Object.freeze([]);

export const selectConversation =
  (conversationId: string) =>
  (state: AgentStoreState): Conversation | undefined =>
    state.conversationsById[conversationId];

export const selectMessage =
  (messageId: string) =>
  (state: AgentStoreState): AgentMessage | undefined =>
    state.messagesById[messageId];

export const selectRun =
  (conversationId: string) =>
  (state: AgentStoreState): AgentRunState | undefined =>
    state.runsByConversation[conversationId];

export const selectIsStreaming =
  (conversationId: string) =>
  (state: AgentStoreState): boolean =>
    Boolean(
      state.runsByConversation[conversationId] &&
      state.runsByConversation[conversationId]?.status !== "error",
    );

export const selectActiveConversation = (state: AgentStoreState): Conversation | undefined =>
  state.activeConversationId ? state.conversationsById[state.activeConversationId] : undefined;

/** Memoized selector for ordered session navigation. */
export function selectConversations() {
  let previousOrder: readonly string[] | undefined;
  let previousConversations: readonly Conversation[] = [];

  return (state: AgentStoreState): readonly Conversation[] => {
    if (
      state.conversationOrder === previousOrder &&
      state.conversationOrder.length === previousConversations.length &&
      state.conversationOrder.every(
        (id, index) => state.conversationsById[id] === previousConversations[index],
      )
    ) {
      return previousConversations;
    }
    previousOrder = state.conversationOrder;
    previousConversations = state.conversationOrder.flatMap((id) => {
      const conversation = state.conversationsById[id];
      return conversation ? [conversation] : [];
    });
    return previousConversations;
  };
}

/**
 * Memoized selector factory. Updates in unrelated conversations preserve the
 * returned array reference and therefore do not trigger subscribed views.
 */
export function selectConversationMessages(conversationId: string) {
  let previousIds: readonly string[] | undefined;
  let previousMessages: readonly AgentMessage[] = EMPTY_MESSAGES;
  let previousVersion: number | undefined;
  let indexById = new Map<string, number>();

  return (state: AgentStoreState): readonly AgentMessage[] => {
    const ids = state.conversationsById[conversationId]?.messageIds;
    const version = state.messageVersionByConversation[conversationId] ?? 0;
    if (!ids) {
      previousIds = undefined;
      previousMessages = EMPTY_MESSAGES;
      previousVersion = undefined;
      indexById = new Map();
      return EMPTY_MESSAGES;
    }

    if (ids === previousIds && ids.length === previousMessages.length) {
      if (version === previousVersion) return previousMessages;
      const changedId = state.lastChangedMessageIdByConversation[conversationId];
      const changedIndex = changedId ? indexById.get(changedId) : undefined;
      const changedMessage = changedId !== undefined ? state.messagesById[changedId] : undefined;
      if (changedIndex !== undefined && changedMessage) {
        const nextMessages = [...previousMessages];
        nextMessages[changedIndex] = changedMessage;
        previousMessages = nextMessages;
        previousVersion = version;
        return previousMessages;
      }
    }

    previousIds = ids;
    previousVersion = version;
    indexById = new Map(ids.map((id, index) => [id, index]));
    previousMessages = ids.flatMap((id) => {
      const message = state.messagesById[id];
      return message ? [message] : [];
    });
    return previousMessages;
  };
}
