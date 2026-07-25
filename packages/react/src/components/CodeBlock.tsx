import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useComponentClass, useVelora } from "./VeloraProvider";
import { cx, errorMessage, useControllableState } from "./utils";

export interface TrustedHighlightedCode {
  /** Trusted HTML produced by the consumer-supplied syntax highlighter. */
  html: string;
}

export interface CodeHighlightContext {
  signal: AbortSignal;
}

export type CodeHighlightResult = ReactNode | TrustedHighlightedCode;
export type CodeHighlighter = (
  code: string,
  language: string | undefined,
  context: CodeHighlightContext,
) => CodeHighlightResult | Promise<CodeHighlightResult>;

export interface CodeBlockProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onCopy"> {
  code: string;
  language?: string;
  filename?: ReactNode;
  highlighter?: CodeHighlighter;
  showCopy?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  onCopy?: (code: string, success: boolean) => void;
  wrap?: boolean;
  defaultWrap?: boolean;
  onWrapChange?: (wrap: boolean) => void;
  showWrapToggle?: boolean;
  wrapLabel?: string;
  unwrapLabel?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapseAfterLines?: number;
  expandLabel?: string;
  collapseLabel?: string;
  showDownload?: boolean;
  downloadFilename?: string;
  downloadLabel?: string;
  onDownload?: (code: string, filename: string) => void;
  actions?: ReactNode;
  retryHighlightLabel?: string;
  onHighlightError?: (error: unknown) => void;
}

function isTrustedHtml(value: CodeHighlightResult): value is TrustedHighlightedCode {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "html" in value &&
      typeof (value as TrustedHighlightedCode).html === "string",
  );
}

async function writeClipboard(value: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === "undefined") throw new Error("Clipboard is unavailable");
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard write failed");
}

export const CodeBlock = forwardRef<HTMLDivElement, CodeBlockProps>(function CodeBlock(
  {
    code,
    language,
    filename,
    highlighter,
    showCopy = true,
    copyLabel,
    copiedLabel,
    onCopy,
    wrap,
    defaultWrap = false,
    onWrapChange,
    showWrapToggle = false,
    wrapLabel,
    unwrapLabel,
    collapsible = false,
    collapsed,
    defaultCollapsed = true,
    onCollapsedChange,
    collapseAfterLines = 16,
    expandLabel,
    collapseLabel,
    showDownload = false,
    downloadFilename,
    downloadLabel,
    onDownload,
    actions,
    retryHighlightLabel,
    onHighlightError,
    className,
    ...rest
  },
  ref,
) {
  const componentClass = useComponentClass("code-block");
  const { messages } = useVelora();
  const copy = messages.codeBlock;
  const resolvedCopyLabel = copyLabel ?? copy.copy;
  const resolvedCopiedLabel = copiedLabel ?? copy.copied;
  const resolvedWrapLabel = wrapLabel ?? copy.wrap;
  const resolvedUnwrapLabel = unwrapLabel ?? copy.unwrap;
  const resolvedExpandLabel = expandLabel ?? copy.expand;
  const resolvedCollapseLabel = collapseLabel ?? copy.collapse;
  const resolvedDownloadLabel = downloadLabel ?? copy.download;
  const resolvedRetryHighlightLabel = retryHighlightLabel ?? copy.retryHighlight;
  const [highlighted, setHighlighted] = useState<CodeHighlightResult | null>(null);
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const [highlighting, setHighlighting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [highlightAttempt, setHighlightAttempt] = useState(0);
  const [lineWrap, setLineWrap] = useControllableState({
    value: wrap,
    defaultValue: defaultWrap,
    onChange: onWrapChange,
  });
  const [isCollapsed, setIsCollapsed] = useControllableState({
    value: collapsed,
    defaultValue: defaultCollapsed,
    onChange: onCollapsedChange,
  });
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHighlightErrorRef = useRef(onHighlightError);
  onHighlightErrorRef.current = onHighlightError;
  const lineCount = useMemo(
    () => (code.length === 0 ? 1 : code.split("\n").length),
    [code],
  );
  const canCollapse = collapsible && lineCount > Math.max(1, collapseAfterLines);

  useEffect(() => {
    const controller = new AbortController();
    setHighlighted(null);
    setHighlightError(null);
    if (!highlighter) {
      setHighlighting(false);
      return () => controller.abort();
    }

    setHighlighting(true);
    Promise.resolve()
      .then(() => highlighter(code, language, { signal: controller.signal }))
      .then((result) => {
        if (controller.signal.aborted) return;
        setHighlighted(result);
        setHighlighting(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setHighlightError(errorMessage(error));
        setHighlighting(false);
        onHighlightErrorRef.current?.(error);
      });

    return () => controller.abort();
  }, [code, highlighter, highlightAttempt, language]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const handleCopy = async () => {
    let success = false;
    try {
      await writeClipboard(code);
      success = true;
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
    onCopy?.(code, success);
  };

  const handleDownload = () => {
    const filename = downloadFilename ?? `snippet.${language || "txt"}`;
    onDownload?.(code, filename);
    if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") {
      return;
    }
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      {...rest}
      ref={ref}
      className={cx(componentClass, className)}
      data-language={language}
      data-wrap={lineWrap ? "true" : "false"}
      data-collapsed={canCollapse && isCollapsed ? "true" : "false"}
      data-highlighting={highlighting ? "true" : "false"}
      aria-busy={highlighting || undefined}
    >
      <div className="vl-code-block__toolbar">
        <div className="vl-code-block__identity">
          {filename != null ? <span className="vl-code-block__filename">{filename}</span> : null}
          {language ? <span className="vl-code-block__language">{language}</span> : null}
        </div>
        <div className="vl-code-block__actions">
          {actions}
          {highlightError && highlighter ? (
            <button
              className="vl-code-block__action"
              type="button"
              onClick={() => setHighlightAttempt((current) => current + 1)}
            >
              {resolvedRetryHighlightLabel}
            </button>
          ) : null}
          {showWrapToggle ? (
            <button
              className="vl-code-block__action"
              type="button"
              aria-pressed={lineWrap}
              onClick={() => setLineWrap((current) => !current)}
            >
              {lineWrap ? resolvedUnwrapLabel : resolvedWrapLabel}
            </button>
          ) : null}
          {showDownload ? (
            <button
              className="vl-code-block__action"
              type="button"
              onClick={handleDownload}
            >
              {resolvedDownloadLabel}
            </button>
          ) : null}
          {showCopy ? (
          <button className="vl-code-block__copy" type="button" onClick={handleCopy}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <rect x="7" y="7" width="9" height="9" rx="2" />
              <path d="M13 7V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h1" />
            </svg>
            <span aria-live="polite">
              {copied ? resolvedCopiedLabel : resolvedCopyLabel}
            </span>
          </button>
          ) : null}
        </div>
      </div>
      <pre className="vl-code-block__pre" tabIndex={0}>
        {isTrustedHtml(highlighted) ? (
          <code dangerouslySetInnerHTML={{ __html: highlighted.html }} />
        ) : highlighted != null ? (
          <code>{highlighted}</code>
        ) : (
          <code>{code}</code>
        )}
      </pre>
      {canCollapse ? (
        <button
          className="vl-code-block__expand"
          type="button"
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((current) => !current)}
        >
          {isCollapsed ? resolvedExpandLabel : resolvedCollapseLabel}
        </button>
      ) : null}
      {highlightError ? (
        <span className="vl-sr-only" role="status">
          {copy.highlightUnavailable(highlightError)}
        </span>
      ) : null}
    </div>
  );
});
