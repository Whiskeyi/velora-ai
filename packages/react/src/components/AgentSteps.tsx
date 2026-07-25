import {
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AgentStep, AgentStepStatus } from "../runtime";
import { StreamingIndicator } from "./StreamingIndicator";
import { useComponentClass, useVelora } from "./VeloraProvider";
import {
  composeStyles,
  cx,
  errorMessage,
  type SemanticClassNames,
  type SemanticStyles,
  useDocumentVisibleInterval,
  useControllableState,
} from "./utils";

/** Status alias used by AgentSteps labels and render contexts. */
export type AgentStepsStatus = AgentStepStatus;
export type AgentStepsAutoExpand = "never" | "running" | "error" | "running-and-error";

export type AgentStepsSlot =
  | "root"
  | "item"
  | "rail"
  | "statusIcon"
  | "body"
  | "trigger"
  | "copy"
  | "title"
  | "description"
  | "status"
  | "duration"
  | "chevron"
  | "reveal"
  | "detail"
  | "retry"
  | "retryError"
  | "empty";

export interface AgentStepRetryContext {
  index: number;
  status: AgentStepsStatus;
  duration: number | undefined;
}

export interface AgentStepRenderContext extends AgentStepRetryContext {
  expanded: boolean;
  toggle: () => void;
  retry: () => Promise<void>;
  retrying: boolean;
  retryError: unknown;
}

export interface AgentStepsProps extends Omit<HTMLAttributes<HTMLOListElement>, "children"> {
  steps: readonly AgentStep[];
  expandedStepIds?: readonly string[];
  defaultExpandedStepIds?: readonly string[];
  onExpandedStepIdsChange?: (ids: readonly string[]) => void;
  collapsible?: boolean;
  autoExpand?: AgentStepsAutoExpand;
  renderDetail?: (step: AgentStep, context: AgentStepRenderContext) => ReactNode;
  statusLabels?: Partial<Record<AgentStepsStatus, ReactNode>>;
  showDuration?: boolean;
  durationUpdateInterval?: number;
  formatDuration?: (durationMs: number, step: AgentStep, index: number) => ReactNode;
  onRetry?: (step: AgentStep, context: AgentStepRetryContext) => void | Promise<void>;
  onRetryError?: (error: unknown, step: AgentStep) => void;
  retryLabel?: ReactNode;
  retryingLabel?: ReactNode;
  empty?: ReactNode;
  classNames?: SemanticClassNames<AgentStepsSlot>;
  styles?: SemanticStyles<AgentStepsSlot>;
}

function defaultFormatDuration(durationMs: number): string {
  const safeDuration = Math.max(0, durationMs);
  if (safeDuration < 1_000) return `${Math.round(safeDuration)}ms`;
  const seconds = safeDuration / 1_000;
  if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.floor(seconds % 60)}s`;
}

function isActiveStatus(status: AgentStepsStatus): boolean {
  return status === "running" || status === "waiting";
}

function shouldAutoExpand(status: AgentStepsStatus, policy: AgentStepsAutoExpand): boolean {
  if (policy === "never") return false;
  if (policy === "running") return status === "running";
  if (policy === "error") return status === "error";
  return status === "running" || status === "error";
}

function StepStatusIcon({
  status,
  runningLabel,
  className,
  style,
}: {
  status: AgentStepsStatus;
  runningLabel: string;
  className?: string;
  style?: CSSProperties;
}) {
  if (status === "running") {
    return (
      <span
        className={cx("vl-agent-steps__status-icon", className)}
        style={style}
        data-slot="statusIcon"
      >
        <StreamingIndicator label={runningLabel} size="small" announce={false} />
      </span>
    );
  }

  return (
    <span
      className={cx("vl-agent-steps__status-icon", className)}
      style={style}
      data-slot="statusIcon"
      aria-hidden="true"
    >
      {status === "complete" ? (
        <svg viewBox="0 0 20 20">
          <path d="m5 10 3.2 3.2L15 6.8" />
        </svg>
      ) : status === "error" ? (
        <svg viewBox="0 0 20 20">
          <path d="m6.5 6.5 7 7m0-7-7 7" />
        </svg>
      ) : status === "waiting" ? (
        <svg viewBox="0 0 20 20">
          <path d="M6.5 5.5v9m7-9v9" />
        </svg>
      ) : status === "cancelled" ? (
        <svg viewBox="0 0 20 20">
          <path d="M5.5 10h9" />
        </svg>
      ) : (
        <span />
      )}
    </span>
  );
}

export const AgentSteps = forwardRef<HTMLOListElement, AgentStepsProps>(function AgentSteps(
  {
    steps,
    expandedStepIds,
    defaultExpandedStepIds = [],
    onExpandedStepIdsChange,
    collapsible = true,
    autoExpand = "running-and-error",
    renderDetail,
    statusLabels,
    showDuration = true,
    durationUpdateInterval = 1_000,
    formatDuration = defaultFormatDuration,
    onRetry,
    onRetryError,
    retryLabel,
    retryingLabel,
    empty,
    className,
    style,
    classNames,
    styles,
    ...rest
  },
  ref,
) {
  const componentClass = useComponentClass("agent-steps");
  const { messages } = useVelora();
  const copy = messages.agentSteps;
  const resolvedRetryLabel = retryLabel ?? copy.retry;
  const resolvedRetryingLabel = retryingLabel ?? copy.retrying;
  const resolvedEmpty = empty ?? copy.empty;
  const generatedId = useId().replace(/:/g, "");
  const [expanded, setExpanded] = useControllableState<readonly string[]>({
    value: expandedStepIds,
    defaultValue: defaultExpandedStepIds,
    onChange: onExpandedStepIdsChange,
  });
  const [now, setNow] = useState(0);
  const [retryingIds, setRetryingIds] = useState<ReadonlySet<string>>(() => new Set());
  const [retryErrors, setRetryErrors] = useState<ReadonlyMap<string, unknown>>(() => new Map());
  const pendingRetryIdsRef = useRef(new Set<string>());
  const manualStatusRef = useRef(new Map<string, AgentStepsStatus>());
  const previousStatusRef = useRef(new Map<string, AgentStepsStatus>());
  const mountedRef = useRef(true);
  const labels: Record<AgentStepsStatus, ReactNode> = {
    pending: copy.pending,
    waiting: copy.waiting,
    running: copy.running,
    complete: copy.complete,
    error: copy.error,
    cancelled: copy.cancelled,
    ...statusLabels,
  };
  const statusSignature = steps
    .map((step) => `${step.id}:${step.status}:${step.detail == null ? "0" : "1"}`)
    .join("|");
  const hasActiveTimedStep = useMemo(
    () =>
      showDuration &&
      steps.some(
        (step) =>
          step.startedAt !== undefined &&
          isActiveStatus(step.status as AgentStepsStatus),
      ),
    [showDuration, steps],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useDocumentVisibleInterval(
    () => setNow(Date.now()),
    durationUpdateInterval,
    hasActiveTimedStep,
  );

  useEffect(() => {
    const currentIds = new Set(steps.map((step) => step.id));
    for (const id of manualStatusRef.current.keys()) {
      if (!currentIds.has(id)) manualStatusRef.current.delete(id);
    }
    for (const id of previousStatusRef.current.keys()) {
      if (!currentIds.has(id)) previousStatusRef.current.delete(id);
    }

    const autoIds: string[] = [];
    for (const step of steps) {
      const status = step.status as AgentStepsStatus;
      const previousStatus = previousStatusRef.current.get(step.id);
      if (previousStatus !== undefined && previousStatus !== status) {
        manualStatusRef.current.delete(step.id);
      }
      previousStatusRef.current.set(step.id, status);

      const canReveal =
        step.detail != null ||
        step.error != null ||
        renderDetail != null ||
        (onRetry != null && (status === "error" || status === "cancelled"));
      if (
        collapsible &&
        canReveal &&
        shouldAutoExpand(status, autoExpand) &&
        manualStatusRef.current.get(step.id) !== status
      ) {
        autoIds.push(step.id);
      }
    }

    if (autoIds.length > 0) {
      setExpanded((current) => {
        const missing = autoIds.filter((id) => !current.includes(id));
        return missing.length > 0 ? [...current, ...missing] : current;
      });
    }
  }, [autoExpand, collapsible, onRetry, renderDetail, setExpanded, statusSignature, steps]);

  const durationById = useMemo(() => {
    const durations = new Map<string, number>();
    steps.forEach((step) => {
      if (step.startedAt === undefined) return;
      const status = step.status as AgentStepsStatus;
      const end = step.completedAt ?? (isActiveStatus(status) ? now : undefined);
      if (end !== undefined) durations.set(step.id, Math.max(0, end - step.startedAt));
    });
    return durations;
  }, [now, steps]);

  const toggleStep = (stepId: string, status: AgentStepsStatus) => {
    manualStatusRef.current.set(stepId, status);
    setExpanded((current) =>
      current.includes(stepId) ? current.filter((id) => id !== stepId) : [...current, stepId],
    );
  };

  const retryStep = async (step: AgentStep, context: AgentStepRetryContext): Promise<void> => {
    if (!onRetry || pendingRetryIdsRef.current.has(step.id)) return;
    pendingRetryIdsRef.current.add(step.id);
    setRetryingIds((current) => new Set(current).add(step.id));
    setRetryErrors((current) => {
      if (!current.has(step.id)) return current;
      const next = new Map(current);
      next.delete(step.id);
      return next;
    });

    try {
      await Promise.resolve(onRetry(step, context));
    } catch (error) {
      if (mountedRef.current) {
        setRetryErrors((current) => new Map(current).set(step.id, error));
      }
      onRetryError?.(error, step);
    } finally {
      pendingRetryIdsRef.current.delete(step.id);
      if (mountedRef.current) {
        setRetryingIds((current) => {
          const next = new Set(current);
          next.delete(step.id);
          return next;
        });
      }
    }
  };

  if (steps.length === 0) {
    return (
      <ol
        {...rest}
        ref={ref}
        className={cx(componentClass, classNames?.root, className)}
        style={composeStyles(styles?.root, style)}
        data-slot="root"
        data-empty="true"
      >
        <li
          className={cx("vl-agent-steps__empty", classNames?.empty)}
          style={styles?.empty}
          data-slot="empty"
        >
          {resolvedEmpty}
        </li>
      </ol>
    );
  }

  return (
    <ol
      {...rest}
      ref={ref}
      className={cx(componentClass, classNames?.root, className)}
      style={composeStyles(styles?.root, style)}
      data-slot="root"
      aria-busy={retryingIds.size > 0 || undefined}
    >
      {steps.map((step, index) => {
        const status = step.status as AgentStepsStatus;
        const duration = durationById.get(step.id);
        const detail = step.detail ?? (step.error ? errorMessage(step.error) : undefined);
        const canRetry = onRetry != null && (status === "error" || status === "cancelled");
        const hasDetail = detail != null || renderDetail != null || canRetry;
        const isExpanded = hasDetail && (!collapsible || expanded.includes(step.id));
        const contentId = `vl-step-${generatedId}-${index}`;
        const retrying = retryingIds.has(step.id);
        const retryError = retryErrors.get(step.id);
        const retryContext: AgentStepRetryContext = { index, status, duration };
        const retry = () => retryStep(step, retryContext);
        const context: AgentStepRenderContext = {
          ...retryContext,
          expanded: isExpanded,
          toggle: collapsible ? () => toggleStep(step.id, status) : () => undefined,
          retry,
          retrying,
          retryError,
        };
        const durationContent =
          showDuration && duration !== undefined ? formatDuration(duration, step, index) : null;

        const triggerContent = (
          <>
            <span
              className={cx("vl-agent-steps__copy", classNames?.copy)}
              style={styles?.copy}
              data-slot="copy"
            >
              <span
                className={cx("vl-agent-steps__title", classNames?.title)}
                style={styles?.title}
                data-slot="title"
              >
                {step.title}
              </span>
              {step.description ? (
                <span
                  className={cx("vl-agent-steps__description", classNames?.description)}
                  style={styles?.description}
                  data-slot="description"
                >
                  {step.description}
                </span>
              ) : null}
            </span>
            <span
              className={cx("vl-agent-steps__status", classNames?.status)}
              style={styles?.status}
              data-slot="status"
              role="status"
              aria-live="polite"
            >
              {labels[status]}
            </span>
            {durationContent != null ? (
              <span
                className={cx("vl-agent-steps__duration", classNames?.duration)}
                style={styles?.duration}
                data-slot="duration"
              >
                {durationContent}
              </span>
            ) : null}
            {collapsible && hasDetail ? (
              <svg
                className={cx("vl-agent-steps__chevron", classNames?.chevron)}
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
          <li
            key={step.id}
            className={cx("vl-agent-steps__item", classNames?.item)}
            style={styles?.item}
            data-slot="item"
            data-status={status}
            data-expanded={isExpanded ? "true" : "false"}
            data-retrying={retrying ? "true" : undefined}
          >
            <span
              className={cx("vl-agent-steps__rail", classNames?.rail)}
              style={styles?.rail}
              data-slot="rail"
              aria-hidden="true"
            >
              <StepStatusIcon
                status={status}
                runningLabel={copy.running}
                className={classNames?.statusIcon}
                style={styles?.statusIcon}
              />
            </span>
            <div
              className={cx("vl-agent-steps__body", classNames?.body)}
              style={styles?.body}
              data-slot="body"
            >
              {collapsible && hasDetail ? (
                <button
                  className={cx("vl-agent-steps__trigger", classNames?.trigger)}
                  style={styles?.trigger}
                  data-slot="trigger"
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={contentId}
                  onClick={context.toggle}
                >
                  {triggerContent}
                </button>
              ) : (
                <div
                  className={cx("vl-agent-steps__trigger", classNames?.trigger)}
                  style={styles?.trigger}
                  data-slot="trigger"
                >
                  {triggerContent}
                </div>
              )}
              {hasDetail ? (
                <div
                  className={cx("vl-agent-steps__reveal", classNames?.reveal)}
                  style={styles?.reveal}
                  data-slot="reveal"
                  data-open={isExpanded ? "true" : "false"}
                  inert={!isExpanded ? true : undefined}
                  aria-hidden={!isExpanded ? true : undefined}
                >
                  <div
                    id={contentId}
                    className={cx("vl-agent-steps__detail", classNames?.detail)}
                    style={styles?.detail}
                    data-slot="detail"
                  >
                    {renderDetail?.(step, context) ?? detail}
                    {canRetry ? (
                      <button
                        className={cx("vl-agent-steps__retry", classNames?.retry)}
                        style={styles?.retry}
                        data-slot="retry"
                        type="button"
                        disabled={retrying}
                        aria-label={`${
                          typeof resolvedRetryLabel === "string"
                            ? resolvedRetryLabel
                            : copy.retry
                        }: ${step.title}`}
                        onClick={() => void retry()}
                      >
                        {retrying ? resolvedRetryingLabel : resolvedRetryLabel}
                      </button>
                    ) : null}
                    {retryError != null ? (
                      <div
                        className={cx("vl-agent-steps__retry-error", classNames?.retryError)}
                        style={styles?.retryError}
                        data-slot="retryError"
                        role="alert"
                      >
                        {errorMessage(retryError)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
});
