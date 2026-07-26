import type { AgentStore } from "./store";
import type {
  AgentError,
  AgentRunOutcome,
  AgentStreamEvent,
  JsonObject,
} from "./types";

export interface AgentStreamTarget {
  readonly conversationId: string;
  readonly requestId: string;
  readonly responseMessageId: string;
}

export type AgentStreamUpdate =
  | { readonly kind: "continue" }
  | { readonly kind: "text-delta"; readonly delta: string }
  | { readonly kind: "reasoning-delta"; readonly delta: string }
  | { readonly kind: "warning"; readonly error: AgentError }
  | {
      readonly kind: "terminal";
      readonly outcome: AgentRunOutcome["outcome"];
      readonly error?: AgentError;
    };

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

/**
 * Applies one normalized event to store state.
 * Scheduling, transport consumption, batching, and callbacks stay in AgentRuntime.
 */
export function applyAgentStreamEvent(
  store: AgentStore,
  target: AgentStreamTarget,
  event: AgentStreamEvent,
): AgentStreamUpdate {
  const actions = store.getState();

  switch (event.type) {
    case "start":
      actions.setRunStatus(target.conversationId, target.requestId, "streaming");
      actions.patchMessage(target.responseMessageId, {
        status: "streaming",
        ...(event.messageId && event.messageId !== target.responseMessageId
          ? {
              metadata: mergeMetadata(
                actions.messagesById[target.responseMessageId]?.metadata,
                { serverMessageId: event.messageId },
              ),
            }
          : {}),
      });
      return { kind: "continue" };
    case "text-delta":
      actions.setRunStatus(target.conversationId, target.requestId, "streaming");
      return { kind: "text-delta", delta: event.delta };
    case "reasoning-delta":
    case "reasoning-summary-delta":
      actions.setRunStatus(target.conversationId, target.requestId, "streaming");
      return { kind: "reasoning-delta", delta: event.delta };
    case "step":
      actions.upsertStep(target.responseMessageId, event.step);
      return { kind: "continue" };
    case "step-update":
      actions.patchStep(target.responseMessageId, event.stepId, event.patch);
      return { kind: "continue" };
    case "tool-call":
      actions.upsertToolCall(target.responseMessageId, event.toolCall);
      if (event.toolCall.status === "approval-required") {
        actions.setRunStatus(target.conversationId, target.requestId, "awaiting-approval");
      } else if (event.toolCall.status === "running") {
        actions.setRunStatus(target.conversationId, target.requestId, "running-tool");
      }
      return { kind: "continue" };
    case "tool-call-update":
      actions.patchToolCall(target.responseMessageId, event.toolCallId, event.patch);
      if (event.patch.status === "approval-required") {
        actions.setRunStatus(target.conversationId, target.requestId, "awaiting-approval");
      } else if (event.patch.status === "running") {
        actions.setRunStatus(target.conversationId, target.requestId, "running-tool");
      } else if (event.patch.status) {
        actions.setRunStatus(target.conversationId, target.requestId, "streaming");
      }
      return { kind: "continue" };
    case "message": {
      actions.patchMessage(target.responseMessageId, {
        content: event.message.content,
        status: event.message.status,
        ...(event.message.reasoning !== undefined ? { reasoning: event.message.reasoning } : {}),
        ...(event.message.attachments !== undefined
          ? { attachments: event.message.attachments }
          : {}),
        ...(event.message.steps !== undefined ? { steps: event.message.steps } : {}),
        ...(event.message.toolCalls !== undefined ? { toolCalls: event.message.toolCalls } : {}),
        ...(event.message.branch !== undefined ? { branch: event.message.branch } : {}),
        ...(event.message.error !== undefined ? { error: event.message.error } : {}),
        metadata: mergeMetadata(
          actions.messagesById[target.responseMessageId]?.metadata,
          event.message.metadata,
        ),
      });
      if (event.message.status === "error") {
        const error = event.message.error ?? {
          message: "The agent returned an error message",
        };
        if (event.message.error === undefined) {
          actions.patchMessage(target.responseMessageId, { error });
        }
        actions.finishRun(target.conversationId, target.requestId, error);
        return { kind: "terminal", outcome: "error", error };
      }
      if (event.message.status === "aborted") {
        actions.abortRun(target.conversationId, target.requestId);
        return { kind: "terminal", outcome: "aborted" };
      }
      return { kind: "continue" };
    }
    case "metadata":
      actions.patchMessage(target.responseMessageId, (message) => ({
        metadata: mergeMetadata(message.metadata, event.metadata),
      }));
      return { kind: "continue" };
    case "error":
      if (event.terminal === false) {
        return { kind: "warning", error: event.error };
      }
      actions.patchMessage(target.responseMessageId, {
        status: "error",
        error: event.error,
      });
      actions.finishRun(target.conversationId, target.requestId, event.error);
      return { kind: "terminal", outcome: "error", error: event.error };
    case "done":
      actions.patchMessage(target.responseMessageId, (message) => ({
        status: "complete",
        metadata: mergeMetadata(message.metadata, completionMetadata(event)),
      }));
      actions.finishRun(target.conversationId, target.requestId);
      return { kind: "terminal", outcome: "complete" };
  }
}
