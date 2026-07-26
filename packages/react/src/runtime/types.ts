/** JSON-safe values accepted by Velora metadata fields. */
export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

export type AgentRole = "system" | "user" | "assistant" | "tool";

export type AgentMessageStatus =
  | "queued"
  | "streaming"
  | "complete"
  | "error"
  | "aborted";

export type AgentStepStatus =
  | "pending"
  | "waiting"
  | "running"
  | "complete"
  | "error"
  | "cancelled";

export interface AgentError {
  readonly message: string;
  readonly code?: string;
  readonly retryable?: boolean;
  readonly details?: JsonValue;
}

export interface AgentStep {
  readonly id: string;
  readonly title: string;
  readonly status: AgentStepStatus;
  readonly description?: string;
  readonly detail?: string;
  readonly startedAt?: number;
  readonly completedAt?: number;
  readonly error?: AgentError;
  readonly metadata?: JsonObject;
}

export type AgentToolCallStatus =
  | "draft"
  | "approval-required"
  | "running"
  | "complete"
  | "error"
  | "cancelled";

export type AgentToolCallRisk = "low" | "medium" | "high" | "critical";

export interface AgentToolCall {
  readonly id: string;
  readonly name: string;
  readonly status: AgentToolCallStatus;
  readonly risk?: AgentToolCallRisk;
  readonly arguments?: JsonValue;
  readonly result?: JsonValue;
  readonly error?: AgentError;
  readonly metadata?: JsonObject;
}

export interface AgentMessageBranch {
  readonly id: string;
  readonly parentId?: string;
  readonly index: number;
  readonly count: number;
}

export type AgentAttachmentKind =
  | "file"
  | "image"
  | "audio"
  | "video"
  | (string & {});

export interface AgentAttachment {
  readonly id: string;
  readonly name: string;
  readonly kind?: AgentAttachmentKind;
  readonly mimeType?: string;
  readonly size?: number;
  readonly url?: string;
  readonly metadata?: JsonObject;
}

export interface AgentMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly role: AgentRole;
  readonly content: string;
  readonly status: AgentMessageStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly parentId?: string;
  readonly attachments?: readonly AgentAttachment[];
  readonly reasoning?: string;
  readonly steps?: readonly AgentStep[];
  readonly toolCalls?: readonly AgentToolCall[];
  readonly branch?: AgentMessageBranch;
  readonly error?: AgentError;
  readonly metadata?: JsonObject;
}

export interface Conversation {
  readonly id: string;
  readonly title?: string;
  readonly messageIds: readonly string[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly metadata?: JsonObject;
}

/** A serializable request passed to an AgentTransport. */
export interface ChatRequest {
  readonly conversationId: string;
  readonly responseMessageId: string;
  readonly messages: readonly AgentMessage[];
  readonly metadata?: JsonObject;
}

export type AgentFinishReason =
  | "stop"
  | "length"
  | "content-filter"
  | "tool-call"
  | "error"
  | (string & {});

export interface AgentUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

interface StreamEventBase {
  /** The SSE id, when the server supplied one. */
  readonly eventId?: string;
}

export type AgentStreamEvent =
  | (StreamEventBase & {
      readonly type: "start";
      readonly messageId?: string;
      readonly createdAt?: number;
    })
  | (StreamEventBase & {
      readonly type: "text-delta";
      readonly delta: string;
    })
  | (StreamEventBase & {
      readonly type: "reasoning-delta";
      readonly delta: string;
    })
  | (StreamEventBase & {
      readonly type: "step";
      readonly step: AgentStep;
    })
  | (StreamEventBase & {
      readonly type: "step-update";
      readonly stepId: string;
      readonly patch: Partial<Omit<AgentStep, "id">>;
    })
  | (StreamEventBase & {
      readonly type: "tool-call";
      readonly toolCall: AgentToolCall;
    })
  | (StreamEventBase & {
      readonly type: "tool-call-update";
      readonly toolCallId: string;
      readonly patch: Partial<Omit<AgentToolCall, "id">>;
    })
  | (StreamEventBase & {
      readonly type: "message";
      readonly message: AgentMessage;
    })
  | (StreamEventBase & {
      readonly type: "metadata";
      readonly metadata: JsonObject;
    })
  | (StreamEventBase & {
      readonly type: "error";
      readonly error: AgentError;
      /** False denotes a recoverable warning and keeps the stream active. */
      readonly terminal?: boolean;
    })
  | (StreamEventBase & {
      readonly type: "done";
      readonly finishReason?: AgentFinishReason;
      readonly usage?: AgentUsage;
      readonly metadata?: JsonObject;
    });

export interface AgentTransportOptions {
  readonly signal?: AbortSignal;
}

/** Transport contract shared by real SSE and deterministic mock adapters. */
export interface AgentTransport {
  readonly name?: string;
  stream(
    request: ChatRequest,
    options?: AgentTransportOptions,
  ): AsyncIterable<AgentStreamEvent>;
}

export type VeloraIdKind =
  | "conversation"
  | "message"
  | "request"
  | "step"
  | "tool-call";

export type VeloraIdFactory = (kind: VeloraIdKind) => string;

export interface CreateConversationInput {
  readonly id?: string;
  readonly title?: string;
  readonly metadata?: JsonObject;
  readonly createdAt?: number;
}

export interface SendMessageOptions {
  readonly metadata?: JsonObject;
  readonly requestMetadata?: JsonObject;
  readonly attachments?: readonly AgentAttachment[];
}

export interface RetryMessageOptions {
  readonly requestMetadata?: JsonObject;
}

export interface AcceptedSendResult {
  readonly accepted: true;
  readonly requestId: string;
  readonly userMessageId: string;
  readonly responseMessageId: string;
  /** Settles when the stream finishes; acceptance itself is synchronous. */
  readonly completion: Promise<AgentRunOutcome>;
}

export interface AgentRunOutcome {
  readonly requestId: string;
  readonly responseMessageId: string;
  readonly outcome: "complete" | "error" | "aborted";
  readonly error?: AgentError;
}

export interface RejectedSendResult {
  readonly accepted: false;
  readonly reason: "busy" | "empty" | "no-user-message";
}

export type SendMessageResult = AcceptedSendResult | RejectedSendResult;
