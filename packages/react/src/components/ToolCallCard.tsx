import {
  forwardRef,
  type HTMLAttributes,
  isValidElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { StreamingIndicator } from "./StreamingIndicator";
import { useComponentClass, useVelora } from "./VeloraProvider";
import {
  composeStyles,
  cx,
  errorMessage,
  type SemanticClassNames,
  type SemanticStyles,
  useControllableState,
} from "./utils";

export type ToolCallStatus =
  | "draft"
  | "approval-required"
  | "running"
  | "complete"
  | "error"
  | "cancelled";

export type ToolCallRisk = "low" | "medium" | "high" | "critical";
export type ToolCallAction = "approve" | "reject" | "retry";
export type ToolCallValueKind = "arguments" | "result" | "error";
export type ToolCallAutoOpen = "attention" | "always" | "never";

export type ToolCallCardSlot =
  | "root"
  | "header"
  | "identity"
  | "name"
  | "description"
  | "status"
  | "risk"
  | "chevron"
  | "body"
  | "section"
  | "sectionLabel"
  | "value"
  | "actions"
  | "approve"
  | "reject"
  | "retry"
  | "actionError";

export interface ToolCallActionContext {
  action: ToolCallAction;
  status: ToolCallStatus;
  risk: ToolCallRisk;
}

export interface ToolCallCardProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  toolName: string;
  description?: ReactNode;
  arguments?: unknown;
  result?: unknown;
  error?: unknown;
  status?: ToolCallStatus;
  risk?: ToolCallRisk;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Opens new approval/error states until the user manually toggles the card. */
  autoOpen?: ToolCallAutoOpen;
  collapsible?: boolean;
  disabled?: boolean;
  onApprove?: (context: ToolCallActionContext) => void | Promise<void>;
  onReject?: (context: ToolCallActionContext) => void | Promise<void>;
  onRetry?: (context: ToolCallActionContext) => void | Promise<void>;
  onActionError?: (error: unknown, context: ToolCallActionContext) => void;
  renderValue?: (value: unknown, kind: ToolCallValueKind) => ReactNode;
  statusLabels?: Partial<Record<ToolCallStatus, ReactNode>>;
  riskLabels?: Partial<Record<ToolCallRisk, ReactNode>>;
  argumentsLabel?: ReactNode;
  resultLabel?: ReactNode;
  errorLabel?: ReactNode;
  approveLabel?: ReactNode;
  approvingLabel?: ReactNode;
  rejectLabel?: ReactNode;
  rejectingLabel?: ReactNode;
  retryLabel?: ReactNode;
  retryingLabel?: ReactNode;
  classNames?: SemanticClassNames<ToolCallCardSlot>;
  styles?: SemanticStyles<ToolCallCardSlot>;
}

function serializeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.message;
  try {
    const serialized = JSON.stringify(value, null, 2);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return String(value);
  }
}

function DefaultValue({ value }: { value: unknown }) {
  if (isValidElement(value)) return value;
  return (
    <pre>
      <code>{serializeValue(value)}</code>
    </pre>
  );
}

function actionAccessibleLabel(label: ReactNode, fallback: string, toolName: string): string {
  return `${typeof label === "string" ? label : fallback}: ${toolName}`;
}

export const ToolCallCard = forwardRef<HTMLElement, ToolCallCardProps>(function ToolCallCard(
  {
    toolName,
    description,
    arguments: toolArguments,
    result,
    error,
    status = "draft",
    risk = "low",
    expanded,
    defaultExpanded,
    onExpandedChange,
    autoOpen = "attention",
    collapsible = true,
    disabled = false,
    onApprove,
    onReject,
    onRetry,
    onActionError,
    renderValue,
    statusLabels,
    riskLabels,
    argumentsLabel,
    resultLabel,
    errorLabel,
    approveLabel,
    approvingLabel,
    rejectLabel,
    rejectingLabel,
    retryLabel,
    retryingLabel,
    className,
    style,
    classNames,
    styles,
    ...rest
  },
  ref,
) {
  const componentClass = useComponentClass("tool-call-card");
  const { messages } = useVelora();
  const copy = messages.toolCallCard;
  const resolvedArgumentsLabel = argumentsLabel ?? copy.arguments;
  const resolvedResultLabel = resultLabel ?? copy.result;
  const resolvedErrorLabel = errorLabel ?? copy.errorLabel;
  const resolvedApproveLabel = approveLabel ?? copy.approve;
  const resolvedApprovingLabel = approvingLabel ?? copy.approving;
  const resolvedRejectLabel = rejectLabel ?? copy.reject;
  const resolvedRejectingLabel = rejectingLabel ?? copy.rejecting;
  const resolvedRetryLabel = retryLabel ?? copy.retry;
  const resolvedRetryingLabel = retryingLabel ?? copy.retrying;
  const generatedId = useId().replace(/:/g, "");
  const contentId = `vl-tool-call-${generatedId}`;
  const nameId = `${contentId}-name`;
  const descriptionId = `${contentId}-description`;
  const statusId = `${contentId}-status`;
  const [isExpanded, setExpanded] = useControllableState({
    value: expanded,
    defaultValue:
      defaultExpanded ??
      (autoOpen === "always" ||
        (autoOpen === "attention" &&
          (status === "approval-required" || status === "error"))),
    onChange: onExpandedChange,
  });
  const [pendingAction, setPendingAction] = useState<ToolCallAction | null>(null);
  const [actionError, setActionError] = useState<unknown>();
  const pendingActionRef = useRef<ToolCallAction | null>(null);
  const mountedRef = useRef(true);
  const manualExpansionRef = useRef(false);
  const previousStatusRef = useRef(status);
  const resolvedStatusLabels: Record<ToolCallStatus, ReactNode> = {
    draft: copy.draft,
    "approval-required": copy.approvalRequired,
    running: copy.running,
    complete: copy.complete,
    error: copy.error,
    cancelled: copy.cancelled,
    ...statusLabels,
  };
  const resolvedRiskLabels: Record<ToolCallRisk, ReactNode> = {
    low: copy.lowRisk,
    medium: copy.mediumRisk,
    high: copy.highRisk,
    critical: copy.criticalRisk,
    ...riskLabels,
  };
  const open = !collapsible || isExpanded;
  const hasDetails =
    toolArguments !== undefined ||
    result !== undefined ||
    error != null ||
    actionError != null ||
    status === "approval-required" ||
    ((status === "error" || status === "cancelled") && onRetry != null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setActionError(undefined);
  }, [status]);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;
    if (
      previousStatus === status ||
      expanded !== undefined ||
      manualExpansionRef.current ||
      !collapsible
    ) {
      return;
    }
    if (
      autoOpen === "always" ||
      (autoOpen === "attention" &&
        (status === "approval-required" || status === "error"))
    ) {
      setExpanded(true);
    }
  }, [autoOpen, collapsible, expanded, setExpanded, status]);

  const runAction = async (
    action: ToolCallAction,
    handler: ((context: ToolCallActionContext) => void | Promise<void>) | undefined,
  ) => {
    if (disabled || !handler || pendingActionRef.current != null) return;
    const context: ToolCallActionContext = { action, status, risk };
    pendingActionRef.current = action;
    setPendingAction(action);
    setActionError(undefined);

    try {
      await Promise.resolve(handler(context));
    } catch (caughtError) {
      if (mountedRef.current) setActionError(caughtError);
      onActionError?.(caughtError, context);
    } finally {
      pendingActionRef.current = null;
      if (mountedRef.current) setPendingAction(null);
    }
  };

  const renderSection = (label: ReactNode, value: unknown, kind: ToolCallValueKind) => (
    <section
      className={cx("vl-tool-call-card__section", classNames?.section)}
      style={styles?.section}
      data-slot="section"
      data-kind={kind}
    >
      <h4
        className={cx("vl-tool-call-card__section-label", classNames?.sectionLabel)}
        style={styles?.sectionLabel}
        data-slot="sectionLabel"
      >
        {label}
      </h4>
      <div
        className={cx("vl-tool-call-card__value", classNames?.value)}
        style={styles?.value}
        data-slot="value"
      >
        {renderValue ? renderValue(value, kind) : <DefaultValue value={value} />}
      </div>
    </section>
  );

  const statusContent =
    pendingAction === "approve"
      ? resolvedApprovingLabel
      : pendingAction === "reject"
        ? resolvedRejectingLabel
        : pendingAction === "retry"
          ? resolvedRetryingLabel
          : resolvedStatusLabels[status];

  const headerContent = (
    <>
      <span
        className={cx("vl-tool-call-card__identity", classNames?.identity)}
        style={styles?.identity}
        data-slot="identity"
      >
        <span
          id={nameId}
          className={cx("vl-tool-call-card__name", classNames?.name)}
          style={styles?.name}
          data-slot="name"
        >
          {toolName}
        </span>
        {description != null ? (
          <span
            id={descriptionId}
            className={cx("vl-tool-call-card__description", classNames?.description)}
            style={styles?.description}
            data-slot="description"
          >
            {description}
          </span>
        ) : null}
      </span>
      <span
        id={statusId}
        className={cx("vl-tool-call-card__status", classNames?.status)}
        style={styles?.status}
        data-slot="status"
        role="status"
        aria-live="polite"
      >
        {status === "running" && pendingAction == null ? (
          <StreamingIndicator label={copy.running} size="small" announce={false} />
        ) : null}
        {statusContent}
      </span>
      <span
        className={cx("vl-tool-call-card__risk", classNames?.risk)}
        style={styles?.risk}
        data-slot="risk"
        data-risk={risk}
      >
        {resolvedRiskLabels[risk]}
      </span>
      {collapsible && hasDetails ? (
        <svg
          className={cx("vl-tool-call-card__chevron", classNames?.chevron)}
          style={styles?.chevron}
          data-slot="chevron"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="m7.5 5 5 5-5 5" />
        </svg>
      ) : null}
    </>
  );

  return (
    <article
      {...rest}
      ref={ref}
      className={cx(componentClass, classNames?.root, className)}
      style={composeStyles(styles?.root, style)}
      data-slot="root"
      data-status={status}
      data-risk={risk}
      data-expanded={open ? "true" : "false"}
      data-pending-action={pendingAction ?? undefined}
      aria-labelledby={nameId}
      aria-describedby={`${description != null ? `${descriptionId} ` : ""}${statusId}`}
      aria-busy={pendingAction != null || status === "running" || undefined}
    >
      {collapsible && hasDetails ? (
        <button
          className={cx("vl-tool-call-card__header", classNames?.header)}
          style={styles?.header}
          data-slot="header"
          type="button"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => {
            manualExpansionRef.current = true;
            setExpanded((current) => !current);
          }}
        >
          {headerContent}
        </button>
      ) : (
        <div
          className={cx("vl-tool-call-card__header", classNames?.header)}
          style={styles?.header}
          data-slot="header"
        >
          {headerContent}
        </div>
      )}

      {hasDetails ? (
        <div
          id={contentId}
          className={cx("vl-tool-call-card__body", classNames?.body)}
          style={styles?.body}
          data-slot="body"
          data-open={open ? "true" : "false"}
          role="region"
          aria-label={copy.details(toolName)}
          inert={!open ? true : undefined}
          aria-hidden={!open ? true : undefined}
        >
          {toolArguments !== undefined
            ? renderSection(resolvedArgumentsLabel, toolArguments, "arguments")
            : null}
          {result !== undefined ? renderSection(resolvedResultLabel, result, "result") : null}
          {error != null ? renderSection(resolvedErrorLabel, error, "error") : null}

          {status === "approval-required" && (onApprove || onReject) ? (
            <div
              className={cx("vl-tool-call-card__actions", classNames?.actions)}
              style={styles?.actions}
              data-slot="actions"
              role="group"
              aria-label={copy.approvalActions(toolName)}
            >
              {onReject ? (
                <button
                  className={cx("vl-tool-call-card__reject", classNames?.reject)}
                  style={styles?.reject}
                  data-slot="reject"
                  type="button"
                  disabled={disabled || pendingAction != null}
                  aria-label={actionAccessibleLabel(
                    resolvedRejectLabel,
                    copy.reject,
                    toolName,
                  )}
                  onClick={() => void runAction("reject", onReject)}
                >
                  {pendingAction === "reject"
                    ? resolvedRejectingLabel
                    : resolvedRejectLabel}
                </button>
              ) : null}
              {onApprove ? (
                <button
                  className={cx("vl-tool-call-card__approve", classNames?.approve)}
                  style={styles?.approve}
                  data-slot="approve"
                  type="button"
                  disabled={disabled || pendingAction != null}
                  aria-label={actionAccessibleLabel(
                    resolvedApproveLabel,
                    copy.approve,
                    toolName,
                  )}
                  onClick={() => void runAction("approve", onApprove)}
                >
                  {pendingAction === "approve"
                    ? resolvedApprovingLabel
                    : resolvedApproveLabel}
                </button>
              ) : null}
            </div>
          ) : null}

          {(status === "error" || status === "cancelled") && onRetry ? (
            <div
              className={cx("vl-tool-call-card__actions", classNames?.actions)}
              style={styles?.actions}
              data-slot="actions"
            >
              <button
                className={cx("vl-tool-call-card__retry", classNames?.retry)}
                style={styles?.retry}
                data-slot="retry"
                type="button"
                disabled={disabled || pendingAction != null}
                aria-label={actionAccessibleLabel(
                  resolvedRetryLabel,
                  copy.retry,
                  toolName,
                )}
                onClick={() => void runAction("retry", onRetry)}
              >
                {pendingAction === "retry" ? resolvedRetryingLabel : resolvedRetryLabel}
              </button>
            </div>
          ) : null}

          {actionError != null ? (
            <div
              className={cx("vl-tool-call-card__action-error", classNames?.actionError)}
              style={styles?.actionError}
              data-slot="actionError"
              role="alert"
            >
              {errorMessage(actionError)}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
});
