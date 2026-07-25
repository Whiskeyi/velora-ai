import katex, { type KatexOptions } from "katex";
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
import { cx, errorMessage } from "./utils";

export type FormulaAlignment = "start" | "center" | "end";

export interface FormulaProps
  extends Omit<
    HTMLAttributes<HTMLSpanElement>,
    "children" | "dangerouslySetInnerHTML" | "onCopy"
  > {
  formula: string;
  displayMode?: boolean;
  /** Inline-axis alignment. Defaults to start to preserve document reading flow. */
  align?: FormulaAlignment;
  options?: Omit<KatexOptions, "displayMode">;
  renderError?: (error: Error, formula: string) => ReactNode;
  showCopy?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  onCopy?: (formula: string, success: boolean) => void;
}

export const Formula = forwardRef<HTMLSpanElement, FormulaProps>(function Formula(
  {
    formula,
    displayMode = false,
    align = "start",
    options,
    renderError,
    showCopy = false,
    copyLabel,
    copiedLabel,
    onCopy,
    className,
    ...rest
  },
  ref,
) {
  const componentClass = useComponentClass("formula");
  const { messages } = useVelora();
  const resolvedCopyLabel = copyLabel ?? messages.formula.copy;
  const resolvedCopiedLabel = copiedLabel ?? messages.formula.copied;
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rendered = useMemo(() => {
    try {
      return {
        html: katex.renderToString(formula, {
          strict: "warn",
          output: "htmlAndMathml",
          ...options,
          throwOnError: options?.throwOnError ?? renderError != null,
          displayMode,
        }),
        error: null,
      };
    } catch (cause) {
      return {
        html: null,
        error: cause instanceof Error ? cause : new Error(errorMessage(cause)),
      };
    }
  }, [displayMode, formula, options, renderError]);

  useEffect(
    () => () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    },
    [],
  );

  const copyFormula = async () => {
    let success = false;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(formula);
      success = true;
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
    onCopy?.(formula, success);
  };

  return (
    <span
      {...rest}
      ref={ref}
      className={cx(componentClass, className)}
      data-display={displayMode ? "block" : "inline"}
      data-align={align}
      data-error={rendered.error ? "true" : undefined}
    >
      <span className="vl-formula__content">
        {rendered.html ? (
          <span dangerouslySetInnerHTML={{ __html: rendered.html }} />
        ) : rendered.error ? (
          <span role="alert">
            {renderError?.(rendered.error, formula) ?? <code>{formula}</code>}
          </span>
        ) : null}
      </span>
      {showCopy ? (
        <button
          className="vl-formula__copy"
          type="button"
          onClick={copyFormula}
          aria-label={resolvedCopyLabel}
        >
          {copied ? resolvedCopiedLabel : resolvedCopyLabel}
        </button>
      ) : null}
    </span>
  );
});
