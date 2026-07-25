import type { MermaidConfig, RenderResult } from "mermaid";
import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { StreamingIndicator } from "./StreamingIndicator";
import { useComponentClass, useVelora } from "./VeloraProvider";
import { assignRef, cx, errorMessage, useControllableState } from "./utils";

export type SafeMermaidConfig = Omit<
  MermaidConfig,
  "securityLevel" | "startOnLoad" | "suppressErrorRendering"
>;
export type MermaidAlignment = "start" | "center" | "end";

let mermaidModule: Promise<typeof import("mermaid")> | undefined;
let renderQueue: Promise<unknown> = Promise.resolve();
const renderCache = new Map<string, Promise<RenderResult>>();
const MAX_CACHE_ENTRIES = 32;

function loadMermaid(): Promise<typeof import("mermaid")> {
  mermaidModule ??= import("mermaid").catch((error: unknown) => {
    mermaidModule = undefined;
    throw error;
  });
  return mermaidModule;
}

function stableSerialize(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "function") return JSON.stringify(String(value));
    return JSON.stringify(value) ?? String(value);
  }
  if (seen.has(value)) return '"[Circular]"';
  seen.add(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item, seen)).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item, seen)}`)
    .join(",")}}`;
}

function scheduleRender(
  cacheKey: string,
  renderId: string,
  chart: string,
  config: SafeMermaidConfig,
): Promise<RenderResult> {
  const cached = renderCache.get(cacheKey);
  if (cached) return cached;

  const task = renderQueue.then(async () => {
    const module = await loadMermaid();
    const mermaid = module.default;
    mermaid.initialize({
      ...config,
      startOnLoad: false,
      securityLevel: "strict",
      suppressErrorRendering: true,
    });
    return mermaid.render(renderId, chart);
  });

  renderQueue = task.catch(() => undefined);
  renderCache.set(cacheKey, task);
  task.catch(() => renderCache.delete(cacheKey));

  if (renderCache.size > MAX_CACHE_ENTRIES) {
    const oldest = renderCache.keys().next().value as string | undefined;
    if (oldest) renderCache.delete(oldest);
  }
  return task;
}

export interface MermaidDiagramProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onError" | "title"> {
  chart: string;
  /** Inline-axis alignment of the diagram canvas. Defaults to start. */
  align?: MermaidAlignment;
  /** Mermaid options with Velora's strict security invariants intentionally excluded. */
  config?: SafeMermaidConfig;
  title?: ReactNode;
  loading?: ReactNode;
  renderError?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error) => void;
  onRender?: (svg: string) => void;
  interactive?: boolean;
  zoom?: number;
  defaultZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  onZoomChange?: (zoom: number) => void;
  controlsLabel?: string;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  resetZoomLabel?: string;
  showCopySource?: boolean;
  copySourceLabel?: string;
  copiedSourceLabel?: string;
  onCopySource?: (chart: string, success: boolean) => void;
}

export const MermaidDiagram = forwardRef<HTMLDivElement, MermaidDiagramProps>(
  function MermaidDiagram(
    {
      chart,
      align = "start",
      config = {},
      title,
      loading,
      renderError,
      onError,
      onRender,
      interactive = true,
      zoom,
      defaultZoom = 1,
      minZoom = 0.5,
      maxZoom = 2,
      zoomStep = 0.15,
      onZoomChange,
      controlsLabel,
      zoomInLabel,
      zoomOutLabel,
      resetZoomLabel,
      showCopySource = false,
      copySourceLabel,
      copiedSourceLabel,
      onCopySource,
      className,
      ...rest
    },
    forwardedRef,
  ) {
    const componentClass = useComponentClass("mermaid");
    const { messages } = useVelora();
    const copy = messages.mermaidDiagram;
    const resolvedControlsLabel = controlsLabel ?? copy.controls;
    const resolvedZoomInLabel = zoomInLabel ?? copy.zoomIn;
    const resolvedZoomOutLabel = zoomOutLabel ?? copy.zoomOut;
    const resolvedResetZoomLabel = resetZoomLabel ?? copy.resetZoom;
    const resolvedCopySourceLabel = copySourceLabel ?? copy.copySource;
    const resolvedCopiedSourceLabel = copiedSourceLabel ?? copy.copied;
    const generatedId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const renderId = `vl-mermaid-${generatedId}`;
    const errorId = `${renderId}-error`;
    const rootRef = useRef<HTMLDivElement | null>(null);
    const callbacksRef = useRef({ onError, onRender });
    callbacksRef.current = { onError, onRender };
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<RenderResult | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [pending, setPending] = useState(true);
    const [currentZoom, setCurrentZoom] = useControllableState({
      value: zoom,
      defaultValue: defaultZoom,
      onChange: onZoomChange,
    });
    const [copied, setCopied] = useState(false);
    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const configSignature = useMemo(() => stableSerialize(config), [config]);
    const cacheKey = `${renderId}:${attempt}:${configSignature}:${chart}`;

    useEffect(() => {
      let active = true;
      setPending(true);
      setError(null);
      setResult(null);

      if (!chart.trim()) {
        const emptyError = new Error(copy.empty);
        setError(emptyError);
        setPending(false);
        callbacksRef.current.onError?.(emptyError);
        return () => {
          active = false;
        };
      }

      scheduleRender(cacheKey, renderId, chart, config)
        .then((nextResult) => {
          if (!active) return;
          setResult(nextResult);
          setPending(false);
          callbacksRef.current.onRender?.(nextResult.svg);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          const nextError =
            cause instanceof Error ? cause : new Error(errorMessage(cause));
          setError(nextError);
          setPending(false);
          callbacksRef.current.onError?.(nextError);
        });

      return () => {
        active = false;
      };
    }, [cacheKey, chart, copy.empty, renderId]);

    useEffect(() => {
      if (result?.bindFunctions && rootRef.current) {
        result.bindFunctions(rootRef.current);
      }
    }, [result]);

    useEffect(
      () => () => {
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      },
      [],
    );

    const retry = () => {
      renderCache.delete(cacheKey);
      setAttempt((current) => current + 1);
    };

    const normalizedMinZoom = Math.min(minZoom, maxZoom);
    const normalizedMaxZoom = Math.max(minZoom, maxZoom);
    const updateZoom = (next: number) => {
      setCurrentZoom(Math.min(normalizedMaxZoom, Math.max(normalizedMinZoom, next)));
    };

    const copySource = async () => {
      let success = false;
      try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
        await navigator.clipboard.writeText(chart);
        success = true;
        setCopied(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopied(false), 1_800);
      } catch {
        setCopied(false);
      }
      onCopySource?.(chart, success);
    };

    const canvasStyle = {
      "--vl-mermaid-zoom": String(currentZoom),
    } as CSSProperties;

    return (
      <div
        {...rest}
        ref={(node) => {
          rootRef.current = node;
          assignRef(forwardedRef, node);
        }}
        className={cx(componentClass, className)}
        aria-busy={pending || undefined}
        data-state={pending ? "loading" : error ? "error" : "ready"}
        data-align={align}
      >
        {title != null ? <div className="vl-mermaid__title">{title}</div> : null}
        {pending ? (
          <div className="vl-mermaid__loading" role="status">
            {loading ?? (
              <StreamingIndicator label={copy.rendering} visibleLabel />
            )}
          </div>
        ) : null}
        {error ? (
          <div className="vl-mermaid__error" role="alert">
            {renderError?.(error, retry) ?? (
              <>
                <span id={errorId}>{error.message}</span>
                <button type="button" onClick={retry} aria-describedby={errorId}>
                  {copy.retry}
                </button>
              </>
            )}
          </div>
        ) : null}
        {result ? (
          <>
            {interactive || showCopySource ? (
              <div
                className="vl-mermaid__controls"
                role="toolbar"
                aria-label={resolvedControlsLabel}
              >
                {interactive ? (
                  <>
                    <button
                      type="button"
                      onClick={() => updateZoom(currentZoom - zoomStep)}
                      disabled={currentZoom <= normalizedMinZoom}
                      aria-label={resolvedZoomOutLabel}
                    >−</button>
                    <button
                      type="button"
                      className="vl-mermaid__zoom-value"
                      onClick={() => updateZoom(1)}
                      aria-label={resolvedResetZoomLabel}
                    >
                      {Math.round(currentZoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => updateZoom(currentZoom + zoomStep)}
                      disabled={currentZoom >= normalizedMaxZoom}
                      aria-label={resolvedZoomInLabel}
                    >+</button>
                  </>
                ) : null}
                {showCopySource ? (
                  <button
                    type="button"
                    onClick={copySource}
                    aria-label={resolvedCopySourceLabel}
                  >
                    {copied ? resolvedCopiedSourceLabel : resolvedCopySourceLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="vl-mermaid__viewport">
              <div
                className="vl-mermaid__canvas"
                style={canvasStyle}
                role="img"
                aria-label={typeof title === "string" ? title : copy.diagram}
                dangerouslySetInnerHTML={{ __html: result.svg }}
              />
            </div>
          </>
        ) : null}
      </div>
    );
  },
);
