import {
  forwardRef,
  type HTMLAttributes,
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
  type SemanticClassNames,
  type SemanticStyles,
  useDocumentVisibleInterval,
  useControllableState,
} from "./utils";

export type ReasoningPanelStatus = "idle" | "running" | "complete" | "error";
export type ReasoningPanelAutoOpen = "while-running" | "always" | "never";

export type ReasoningPanelSlot =
  | "root"
  | "trigger"
  | "icon"
  | "heading"
  | "title"
  | "description"
  | "meta"
  | "elapsed"
  | "announcement"
  | "reveal"
  | "content";

export interface ReasoningPanelProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "title"
> {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  status?: ReasoningPanelStatus;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapsible?: boolean;
  /** Automatic expansion policy. A user's first manual toggle takes precedence thereafter. */
  autoOpen?: ReasoningPanelAutoOpen;
  /** Explicit duration content. Takes precedence over the built-in elapsed timer. */
  duration?: ReactNode;
  /** Epoch timestamp used as the timer origin. Defaults to the first running transition. */
  startedAt?: number;
  /** Controlled elapsed value in milliseconds. */
  elapsedMs?: number;
  showElapsed?: boolean;
  elapsedUpdateInterval?: number;
  formatElapsed?: (elapsedMs: number, status: ReasoningPanelStatus) => ReactNode;
  runningLabel?: string;
  statusLabels?: Partial<Record<ReasoningPanelStatus, string>>;
  classNames?: SemanticClassNames<ReasoningPanelSlot>;
  styles?: SemanticStyles<ReasoningPanelSlot>;
}

function defaultFormatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export const ReasoningPanel = forwardRef<HTMLElement, ReasoningPanelProps>(function ReasoningPanel(
  {
    children,
    title,
    description,
    status = "complete",
    open,
    defaultOpen = false,
    onOpenChange,
    collapsible = true,
    autoOpen = "while-running",
    duration,
    startedAt,
    elapsedMs,
    showElapsed = true,
    elapsedUpdateInterval = 1_000,
    formatElapsed = defaultFormatElapsed,
    runningLabel,
    statusLabels,
    className,
    style,
    classNames,
    styles,
    ...rest
  },
  ref,
) {
  const componentClass = useComponentClass("reasoning-panel");
  const { messages } = useVelora();
  const copy = messages.reasoningPanel;
  const resolvedTitle = title ?? copy.title;
  const resolvedRunningLabel = runningLabel ?? copy.thinking;
  const [expanded, setExpanded] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const generatedId = useId();
  const contentId = `vl-reasoning-${generatedId.replace(/:/g, "")}`;
  const manualOpenRef = useRef(false);
  const previousStatusRef = useRef(status);
  const internalStartedAtRef = useRef<number | undefined>(undefined);
  const internalCompletedAtRef = useRef<number | undefined>(undefined);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const currentTime = Date.now();
    const previousStatus = previousStatusRef.current;
    if (status === "running") {
      if (previousStatus !== "running" || internalStartedAtRef.current === undefined) {
        internalStartedAtRef.current = currentTime;
        internalCompletedAtRef.current = undefined;
      }
      setNow(currentTime);
    } else if (previousStatus === "running") {
      internalCompletedAtRef.current = currentTime;
      setNow(currentTime);
    } else if (startedAt !== undefined && internalCompletedAtRef.current === undefined) {
      internalCompletedAtRef.current = currentTime;
      setNow(currentTime);
    }
    previousStatusRef.current = status;
  }, [startedAt, status]);

  useDocumentVisibleInterval(
    () => setNow(Date.now()),
    elapsedUpdateInterval,
    showElapsed && duration == null && elapsedMs === undefined && status === "running",
  );

  useEffect(() => {
    if (!collapsible || manualOpenRef.current || autoOpen === "never") return;
    setExpanded(autoOpen === "always" || status === "running");
  }, [autoOpen, collapsible, setExpanded, status]);

  const effectiveStartedAt = startedAt ?? internalStartedAtRef.current;
  const effectiveElapsed =
    elapsedMs ??
    (effectiveStartedAt === undefined
      ? undefined
      : Math.max(
          0,
          (status === "running"
            ? now
            : (internalCompletedAtRef.current ?? now)) - effectiveStartedAt,
        ));
  const elapsedContent =
    showElapsed && effectiveElapsed !== undefined ? formatElapsed(effectiveElapsed, status) : null;
  const metaContent = duration ?? elapsedContent;
  const resolvedStatusLabels = {
    idle: copy.idle,
    running: copy.running,
    complete: copy.complete,
    error: copy.error,
    ...statusLabels,
  };
  const isOpen = !collapsible || expanded;
  const toggle = () => {
    manualOpenRef.current = true;
    setExpanded((current) => !current);
  };

  const heading = (
    <>
      {collapsible ? (
        <span
          className={cx("vl-reasoning-panel__icon", classNames?.icon)}
          style={styles?.icon}
          data-slot="icon"
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20">
            <path d="m7.5 5 5 5-5 5" />
          </svg>
        </span>
      ) : null}
      <span
        className={cx("vl-reasoning-panel__heading", classNames?.heading)}
        style={styles?.heading}
        data-slot="heading"
      >
        <span
          className={cx("vl-reasoning-panel__title", classNames?.title)}
          style={styles?.title}
          data-slot="title"
        >
          {resolvedTitle}
        </span>
        {description != null ? (
          <span
            className={cx("vl-reasoning-panel__description", classNames?.description)}
            style={styles?.description}
            data-slot="description"
          >
            {description}
          </span>
        ) : null}
      </span>
      <span
        className={cx("vl-reasoning-panel__meta", classNames?.meta)}
        style={styles?.meta}
        data-slot="meta"
      >
        {status === "running" ? (
          <StreamingIndicator
            label={resolvedRunningLabel}
            size="small"
            visibleLabel
            announce={false}
          />
        ) : null}
        {metaContent != null ? (
          <span
            className={cx("vl-reasoning-panel__elapsed", classNames?.elapsed)}
            style={styles?.elapsed}
            data-slot="elapsed"
          >
            {metaContent}
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <section
      {...rest}
      ref={ref}
      className={cx(componentClass, classNames?.root, className)}
      style={composeStyles(styles?.root, style)}
      data-slot="root"
      data-status={status}
      data-open={isOpen ? "true" : "false"}
      aria-busy={status === "running" || undefined}
    >
      <span
        className={cx("vl-sr-only", classNames?.announcement)}
        style={styles?.announcement}
        data-slot="announcement"
        role={status === "error" ? "alert" : "status"}
        aria-live={status === "error" ? "assertive" : "polite"}
      >
        {resolvedStatusLabels[status]}
      </span>
      {collapsible ? (
        <button
          className={cx("vl-reasoning-panel__trigger", classNames?.trigger)}
          style={styles?.trigger}
          data-slot="trigger"
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={toggle}
        >
          {heading}
        </button>
      ) : (
        <div
          className={cx("vl-reasoning-panel__trigger", classNames?.trigger)}
          style={styles?.trigger}
          data-slot="trigger"
        >
          {heading}
        </div>
      )}
      <div
        className={cx("vl-reasoning-panel__reveal", classNames?.reveal)}
        style={styles?.reveal}
        data-slot="reveal"
        data-open={isOpen ? "true" : "false"}
        inert={!isOpen ? true : undefined}
        aria-hidden={!isOpen ? true : undefined}
      >
        <div
          id={contentId}
          className={cx("vl-reasoning-panel__content", classNames?.content)}
          style={styles?.content}
          data-slot="content"
          role="region"
          aria-label={typeof resolvedTitle === "string" ? resolvedTitle : copy.details}
        >
          {children}
        </div>
      </div>
    </section>
  );
});
