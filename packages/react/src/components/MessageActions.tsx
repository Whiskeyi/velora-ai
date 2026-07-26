import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { AgentMessage } from "../runtime";
import { useComponentClass, useVelora } from "./VeloraProvider";
import {
  composeStyles,
  cx,
  errorMessage,
  type SemanticClassNames,
  type SemanticStyles,
  writeClipboard,
} from "./utils";

export type MessageFeedback = "like" | "dislike" | null;

export type MessageActionKind = "copy" | "regenerate" | "edit" | "like" | "dislike";

export type MessageActionsSlot =
  | "root"
  | "button"
  | "copy"
  | "regenerate"
  | "edit"
  | "like"
  | "dislike"
  | "status"
  | "error";

export interface MessageActionErrorContext {
  action: MessageActionKind;
  message: AgentMessage;
}

export interface MessageActionsProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "onCopy" | "onError"
> {
  message: AgentMessage;
  /** Text written by the copy action. Defaults to `message.content`. */
  copyText?: string | ((message: AgentMessage) => string);
  showCopy?: boolean;
  showFeedback?: boolean;
  feedback?: MessageFeedback;
  defaultFeedback?: MessageFeedback;
  disabled?: boolean;
  onCopy?: (message: AgentMessage, success: boolean) => void;
  onRegenerate?: (message: AgentMessage) => void | Promise<void>;
  onEdit?: (message: AgentMessage) => void | Promise<void>;
  onFeedbackChange?: (feedback: MessageFeedback, message: AgentMessage) => void | Promise<void>;
  onActionError?: (error: unknown, context: MessageActionErrorContext) => void;
  ariaLabel?: string;
  copyLabel?: string;
  regenerateLabel?: string;
  editLabel?: string;
  likeLabel?: string;
  dislikeLabel?: string;
  copiedLabel?: string;
  pendingLabels?: Partial<Record<MessageActionKind, string>>;
  successLabels?: Partial<Record<MessageActionKind, string>>;
  errorLabel?: (error: unknown, context: MessageActionErrorContext) => ReactNode;
  copyIcon?: ReactNode;
  regenerateIcon?: ReactNode;
  editIcon?: ReactNode;
  likeIcon?: ReactNode;
  dislikeIcon?: ReactNode;
  classNames?: SemanticClassNames<MessageActionsSlot>;
  styles?: SemanticStyles<MessageActionsSlot>;
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="7" y="7" width="9" height="9" rx="2" />
      <path d="M13 7V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1" />
    </svg>
  );
}

function RegenerateIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M15.2 7A6 6 0 1 0 16 10" />
      <path d="M12.5 3.8H16V7.3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m12.8 4.2 3 3-8.5 8.5-3.8.8.8-3.8 8.5-8.5Z" />
    </svg>
  );
}

function LikeIcon({ dislike = false }: { dislike?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" data-direction={dislike ? "down" : "up"}>
      <path
        d="M7 8.5 9.8 3a1.6 1.6 0 0 1 1.7 1.6V8h3.1a1.9 1.9 0 0 1 1.8 2.4l-1.2 4.4A1.7 1.7 0 0 1 13.5 16H7M3.5 8.5H7V16H3.5z"
        transform={dislike ? "rotate(180 10 10)" : undefined}
      />
    </svg>
  );
}

export const MessageActions = forwardRef<HTMLDivElement, MessageActionsProps>(
  function MessageActions(
    {
      message,
      copyText,
      showCopy = true,
      showFeedback = true,
      feedback,
      defaultFeedback = null,
      disabled = false,
      onCopy,
      onRegenerate,
      onEdit,
      onFeedbackChange,
      onActionError,
      ariaLabel,
      copyLabel,
      regenerateLabel,
      editLabel,
      likeLabel,
      dislikeLabel,
      copiedLabel,
      pendingLabels,
      successLabels,
      errorLabel,
      copyIcon,
      regenerateIcon,
      editIcon,
      likeIcon,
      dislikeIcon,
      className,
      style,
      classNames,
      styles,
      ...rest
    },
    ref,
  ) {
    const componentClass = useComponentClass("message-actions");
    const { messages } = useVelora();
    const copy = messages.messageActions;
    const resolvedAriaLabel = ariaLabel ?? copy.ariaLabel;
    const resolvedCopyLabel = copyLabel ?? copy.copy;
    const resolvedRegenerateLabel = regenerateLabel ?? copy.regenerate;
    const resolvedEditLabel = editLabel ?? copy.edit;
    const resolvedLikeLabel = likeLabel ?? copy.like;
    const resolvedDislikeLabel = dislikeLabel ?? copy.dislike;
    const resolvedCopiedLabel = copiedLabel ?? copy.copied;
    const controlled = feedback !== undefined;
    const [uncontrolledFeedback, setUncontrolledFeedback] =
      useState<MessageFeedback>(defaultFeedback);
    const currentFeedback = controlled ? feedback : uncontrolledFeedback;
    const [pendingAction, setPendingAction] = useState<MessageActionKind | null>(null);
    const [status, setStatus] = useState<ReactNode>(null);
    const [actionError, setActionError] = useState<ReactNode>(null);
    const pendingRef = useRef<MessageActionKind | null>(null);
    const mountedRef = useRef(true);
    const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      };
    }, []);

    const announceSuccess = (action: MessageActionKind) => {
      if (!mountedRef.current) return;
      setStatus(
        action === "copy" ? resolvedCopiedLabel : (successLabels?.[action] ?? copy.success[action]),
      );
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => {
        statusTimerRef.current = null;
        if (mountedRef.current) setStatus(null);
      }, 1_800);
    };

    const runAction = async (
      action: MessageActionKind,
      operation: () => void | Promise<void>,
      rollback?: () => void,
    ) => {
      if (disabled || pendingRef.current) return;
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
      pendingRef.current = action;
      setPendingAction(action);
      setActionError(null);
      setStatus(pendingLabels?.[action] ?? copy.pending[action]);

      try {
        await operation();
        announceSuccess(action);
      } catch (error) {
        if (mountedRef.current) {
          rollback?.();
          const context = { action, message } satisfies MessageActionErrorContext;
          setStatus(null);
          setActionError(
            errorLabel?.(error, context) ??
              copy.actionFailed(
                pendingLabels?.[action] ?? copy.pending[action],
                errorMessage(error),
              ),
          );
          onActionError?.(error, context);
        }
      } finally {
        pendingRef.current = null;
        if (mountedRef.current) setPendingAction(null);
      }
    };

    const handleCopy = () => {
      void runAction("copy", async () => {
        const text =
          typeof copyText === "function" ? copyText(message) : (copyText ?? message.content);
        try {
          await writeClipboard(text);
        } catch (error) {
          onCopy?.(message, false);
          throw error;
        }
        onCopy?.(message, true);
      });
    };

    const handleFeedback = (action: "like" | "dislike") => {
      if (disabled || pendingRef.current) return;
      const previous = currentFeedback;
      const next = currentFeedback === action ? null : action;
      if (!controlled) setUncontrolledFeedback(next);
      void runAction(
        action,
        () => onFeedbackChange?.(next, message),
        controlled ? undefined : () => setUncontrolledFeedback(previous),
      );
    };

    const buttonClassName = (slot: MessageActionsSlot) =>
      cx("vl-message-actions__button", classNames?.button, classNames?.[slot]);
    const buttonStyle = (slot: MessageActionsSlot) => composeStyles(styles?.button, styles?.[slot]);
    const actionDisabled = disabled || pendingAction != null;

    return (
      <div
        {...rest}
        ref={ref}
        className={cx(componentClass, classNames?.root, className)}
        style={composeStyles(styles?.root, style)}
        role="toolbar"
        aria-label={resolvedAriaLabel}
        aria-busy={pendingAction != null || undefined}
        data-pending={pendingAction ?? undefined}
      >
        {showCopy ? (
          <button
            className={buttonClassName("copy")}
            style={buttonStyle("copy")}
            type="button"
            aria-label={resolvedCopyLabel}
            aria-busy={pendingAction === "copy" || undefined}
            data-action="copy"
            disabled={actionDisabled}
            onClick={handleCopy}
          >
            {copyIcon ?? <CopyIcon />}
          </button>
        ) : null}
        {onRegenerate ? (
          <button
            className={buttonClassName("regenerate")}
            style={buttonStyle("regenerate")}
            type="button"
            aria-label={resolvedRegenerateLabel}
            aria-busy={pendingAction === "regenerate" || undefined}
            data-action="regenerate"
            disabled={actionDisabled}
            onClick={() => void runAction("regenerate", () => onRegenerate(message))}
          >
            {regenerateIcon ?? <RegenerateIcon />}
          </button>
        ) : null}
        {onEdit ? (
          <button
            className={buttonClassName("edit")}
            style={buttonStyle("edit")}
            type="button"
            aria-label={resolvedEditLabel}
            aria-busy={pendingAction === "edit" || undefined}
            data-action="edit"
            disabled={actionDisabled}
            onClick={() => void runAction("edit", () => onEdit(message))}
          >
            {editIcon ?? <EditIcon />}
          </button>
        ) : null}
        {showFeedback ? (
          <>
            <button
              className={buttonClassName("like")}
              style={buttonStyle("like")}
              type="button"
              aria-label={resolvedLikeLabel}
              aria-pressed={currentFeedback === "like"}
              aria-busy={pendingAction === "like" || undefined}
              data-action="like"
              disabled={actionDisabled}
              onClick={() => handleFeedback("like")}
            >
              {likeIcon ?? <LikeIcon />}
            </button>
            <button
              className={buttonClassName("dislike")}
              style={buttonStyle("dislike")}
              type="button"
              aria-label={resolvedDislikeLabel}
              aria-pressed={currentFeedback === "dislike"}
              aria-busy={pendingAction === "dislike" || undefined}
              data-action="dislike"
              disabled={actionDisabled}
              onClick={() => handleFeedback("dislike")}
            >
              {dislikeIcon ?? <LikeIcon dislike />}
            </button>
          </>
        ) : null}
        {status != null ? (
          <span
            className={cx("vl-message-actions__status", classNames?.status)}
            style={styles?.status}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {status}
          </span>
        ) : null}
        {actionError != null ? (
          <span
            className={cx("vl-message-actions__error", classNames?.error)}
            style={styles?.error}
            role="alert"
            data-slot="error"
          >
            {actionError}
          </span>
        ) : null}
      </div>
    );
  },
);
