import { forwardRef, memo, type HTMLAttributes, type ReactNode } from "react";
import type { AgentMessage } from "../runtime";
import { StreamingIndicator } from "./StreamingIndicator";
import { useComponentClass, useVelora } from "./VeloraProvider";
import {
  composeStyles,
  cx,
  errorMessage,
  type SemanticClassNames,
  type SemanticStyles,
} from "./utils";

export type MessageBubbleSlot =
  | "root"
  | "avatar"
  | "container"
  | "header"
  | "author"
  | "timestamp"
  | "attachments"
  | "body"
  | "status"
  | "error"
  | "branchNavigator"
  | "actions"
  | "footer";

export interface MessageBubbleRenderContext {
  message: AgentMessage;
  streaming: boolean;
  terminal: boolean;
  hasError: boolean;
}

export type MessageBubbleSlotRenderer = (
  message: AgentMessage,
  context: MessageBubbleRenderContext,
) => ReactNode;

export type MessageBubbleSlotContent = ReactNode | MessageBubbleSlotRenderer;

export interface MessageBubbleProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  message: AgentMessage;
  /** Overrides the default plain-text content. Pass a MarkdownRenderer for rich output. */
  children?: ReactNode;
  avatar?: ReactNode;
  /** Optional files, images, or generated artifacts associated with this message. */
  attachments?: MessageBubbleSlotContent;
  /** Optional response-version control, usually a MessageBranchNavigator. */
  branchNavigator?: MessageBubbleSlotContent;
  actions?: MessageBubbleSlotContent;
  footer?: MessageBubbleSlotContent;
  author?: ReactNode;
  showTimestamp?: boolean;
  formatTimestamp?: (timestamp: number, message: AgentMessage) => ReactNode;
  roleLabels?: Partial<Record<AgentMessage["role"], ReactNode>>;
  statusLabels?: Partial<Record<AgentMessage["status"], ReactNode>>;
  classNames?: SemanticClassNames<MessageBubbleSlot>;
  styles?: SemanticStyles<MessageBubbleSlot>;
}

function renderSlot(
  slot: MessageBubbleSlotContent | undefined,
  message: AgentMessage,
  context: MessageBubbleRenderContext,
): ReactNode {
  return typeof slot === "function" ? slot(message, context) : slot;
}

function MessageBubbleInner(
  {
    message,
    children,
    avatar,
    attachments,
    branchNavigator,
    actions,
    footer,
    author,
    showTimestamp = false,
    formatTimestamp,
    roleLabels,
    statusLabels,
    className,
    style,
    classNames,
    styles,
    ...rest
  }: MessageBubbleProps,
  ref: React.ForwardedRef<HTMLElement>,
) {
  const componentClass = useComponentClass("message-bubble");
  const { messages } = useVelora();
  const copy = messages.messageBubble;
  const mergedRoleLabels: Record<AgentMessage["role"], ReactNode> = {
    system: copy.system,
    user: copy.user,
    assistant: copy.assistant,
    tool: copy.tool,
    ...roleLabels,
  };
  const mergedStatusLabels: Partial<Record<AgentMessage["status"], ReactNode>> = {
    queued: copy.queued,
    streaming: copy.streaming,
    complete: copy.complete,
    error: copy.error,
    aborted: copy.aborted,
    ...statusLabels,
  };
  const timestamp = showTimestamp ? new Date(message.createdAt) : null;
  const timestampContent = showTimestamp
    ? formatTimestamp
      ? formatTimestamp(message.createdAt, message)
      : timestamp?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const messageError = message.error ? errorMessage(message.error) : null;
  const renderContext: MessageBubbleRenderContext = {
    message,
    streaming: message.status === "streaming",
    terminal:
      message.status === "complete" || message.status === "error" || message.status === "aborted",
    hasError: messageError != null,
  };
  const renderedAttachments = renderSlot(attachments, message, renderContext);
  const renderedBranchNavigator = renderSlot(branchNavigator, message, renderContext);
  const renderedActions = renderSlot(actions, message, renderContext);
  const renderedFooter = renderSlot(footer, message, renderContext);
  const showUserHeader =
    message.role === "user" && (showTimestamp || author != null || roleLabels?.user != null);

  return (
    <article
      {...rest}
      ref={ref}
      className={cx(componentClass, classNames?.root, className)}
      style={composeStyles(styles?.root, style)}
      data-role={message.role}
      data-status={message.status}
      data-show-header={showUserHeader ? "true" : undefined}
      data-slot="root"
      aria-busy={message.status === "streaming" || undefined}
    >
      {avatar != null ? (
        <div
          className={cx("vl-message-bubble__avatar", classNames?.avatar)}
          style={styles?.avatar}
          data-slot="avatar"
          aria-hidden="true"
        >
          {avatar}
        </div>
      ) : null}

      <div
        className={cx("vl-message-bubble__container", classNames?.container)}
        style={styles?.container}
        data-slot="container"
      >
        <header
          className={cx("vl-message-bubble__header", classNames?.header)}
          style={styles?.header}
          data-slot="header"
        >
          <span
            className={cx("vl-message-bubble__author", classNames?.author)}
            style={styles?.author}
            data-slot="author"
          >
            {author ?? mergedRoleLabels[message.role]}
          </span>
          {showTimestamp ? (
            <time
              className={cx("vl-message-bubble__timestamp", classNames?.timestamp)}
              style={styles?.timestamp}
              dateTime={timestamp?.toISOString()}
              data-slot="timestamp"
            >
              {timestampContent}
            </time>
          ) : null}
        </header>

        {renderedAttachments != null ? (
          <div
            className={cx("vl-message-bubble__attachments", classNames?.attachments)}
            style={styles?.attachments}
            data-slot="attachments"
          >
            {renderedAttachments}
          </div>
        ) : null}

        <div
          className={cx("vl-message-bubble__body", classNames?.body)}
          style={styles?.body}
          data-slot="body"
        >
          {children === undefined ? String(message.content ?? "") : children}
          {message.status === "streaming" ? (
            <StreamingIndicator
              className="vl-message-bubble__streaming"
              label="Response is streaming"
              size="small"
            />
          ) : null}
        </div>

        {messageError ? (
          <div
            className={cx("vl-message-bubble__error", classNames?.error)}
            style={styles?.error}
            role="alert"
            data-slot="error"
          >
            {messageError}
          </div>
        ) : null}

        {mergedStatusLabels[message.status] != null ? (
          <div
            className={cx("vl-message-bubble__status", classNames?.status)}
            style={styles?.status}
            data-slot="status"
          >
            {mergedStatusLabels[message.status]}
          </div>
        ) : null}

        {renderedBranchNavigator != null ? (
          <div
            className={cx("vl-message-bubble__branch-navigator", classNames?.branchNavigator)}
            style={styles?.branchNavigator}
            data-slot="branch-navigator"
          >
            {renderedBranchNavigator}
          </div>
        ) : null}

        {renderedActions != null ? (
          <div
            className={cx("vl-message-bubble__actions", classNames?.actions)}
            style={styles?.actions}
            data-slot="actions"
          >
            {renderedActions}
          </div>
        ) : null}
        {renderedFooter != null ? (
          <footer
            className={cx("vl-message-bubble__footer", classNames?.footer)}
            style={styles?.footer}
            data-slot="footer"
          >
            {renderedFooter}
          </footer>
        ) : null}
      </div>
    </article>
  );
}

const ForwardedMessageBubble = forwardRef<HTMLElement, MessageBubbleProps>(MessageBubbleInner);
ForwardedMessageBubble.displayName = "MessageBubble";

export const MessageBubble = memo(ForwardedMessageBubble);
