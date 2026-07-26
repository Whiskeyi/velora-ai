import { createAgentStore, type AgentStore, type CreateAgentStoreOptions } from "./store";
import type { AgentMessage, Conversation } from "./types";

export interface AgentStoreSnapshotV1 {
  readonly version: 1;
  readonly conversations: readonly Conversation[];
  readonly messages: readonly AgentMessage[];
  readonly activeConversationId: string | null;
}

export type AgentStoreSnapshot = AgentStoreSnapshotV1;

export interface AgentPersistenceAdapter {
  load(): AgentStoreSnapshot | null | Promise<AgentStoreSnapshot | null>;
  save(snapshot: AgentStoreSnapshot): void | Promise<void>;
}

/** Captures only durable conversation data; active requests are never persisted. */
export function snapshotAgentStore(store: AgentStore): AgentStoreSnapshot {
  const state = store.getState();
  const conversations = state.conversationOrder.flatMap((id) => {
    const conversation = state.conversationsById[id];
    return conversation ? [conversation] : [];
  });
  const messages = conversations.flatMap((conversation) =>
    conversation.messageIds.flatMap((id) => {
      const message = state.messagesById[id];
      return message ? [message] : [];
    }),
  );
  return {
    version: 1,
    conversations,
    messages,
    activeConversationId: state.activeConversationId,
  };
}

export function createAgentStoreFromSnapshot(
  snapshot: AgentStoreSnapshot,
  options: Pick<CreateAgentStoreOptions, "idFactory" | "now"> = {},
): AgentStore {
  if (snapshot.version !== 1) {
    throw new Error(`Unsupported AgentStore snapshot version: ${String(snapshot.version)}`);
  }
  return createAgentStore({
    ...options,
    conversations: snapshot.conversations,
    messages: snapshot.messages,
    activeConversationId: snapshot.activeConversationId,
  });
}

export async function loadAgentStore(
  adapter: AgentPersistenceAdapter,
  options: Pick<CreateAgentStoreOptions, "idFactory" | "now"> = {},
): Promise<AgentStore> {
  const snapshot = await adapter.load();
  return snapshot ? createAgentStoreFromSnapshot(snapshot, options) : createAgentStore(options);
}
