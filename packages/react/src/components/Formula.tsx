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
import {
  composeStyles,
  cx,
  errorMessage,
  type SemanticClassNames,
  type SemanticStyles,
  writeClipboard,
} from "./utils";

export type FormulaAlignment = "start" | "center" | "end";
export type FormulaSlot = "root" | "content" | "error" | "copy";
export type SafeKatexOptions = Omit<
  KatexOptions,
  | "displayMode"
  | "trust"
  | "strict"
  | "globalGroup"
  | "maxSize"
  | "maxExpand"
> & {
  /** Finite layout cap. Values are clamped to 50em. Defaults to 20em. */
  maxSize?: number;
  /** Finite macro expansion cap. Values are clamped to 2,000. Defaults to 1,000. */
  maxExpand?: number;
};

export interface FormulaProps
  extends Omit<
    HTMLAttributes<HTMLSpanElement>,
    "children" | "dangerouslySetInnerHTML" | "onCopy"
  > {
  formula: string;
  displayMode?: boolean;
  /** Inline-axis alignment. Defaults to start to preserve document reading flow. */
  align?: FormulaAlignment;
  /** Security-sensitive KaTeX settings are intentionally controlled by Velora. */
  options?: SafeKatexOptions;
  renderError?: (error: Error, formula: string) => ReactNode;
  showCopy?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  onCopy?: (formula: string, success: boolean) => void;
  classNames?: SemanticClassNames<FormulaSlot>;
  styles?: SemanticStyles<FormulaSlot>;
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
    style,
    classNames,
    styles,
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
    const maxSize = Number.isFinite(options?.maxSize)
      ? Math.min(50, Math.max(1, options?.maxSize ?? 20))
      : 20;
    const maxExpand = Number.isFinite(options?.maxExpand)
      ? Math.min(2_000, Math.max(0, options?.maxExpand ?? 1_000))
      : 1_000;
    try {
      return {
        html: katex.renderToString(formula, {
          ...options,
          strict: "warn",
          trust: false,
          globalGroup: false,
          maxSize,
          maxExpand,
          output: "htmlAndMathml",
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
      await writeClipboard(formula);
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
      className={cx(componentClass, classNames?.root, className)}
      style={composeStyles(styles?.root, style)}
      data-slot="root"
      data-display={displayMode ? "block" : "inline"}
      data-align={align}
      data-error={rendered.error ? "true" : undefined}
    >
      <span
        className={cx("vl-formula__content", classNames?.content)}
        style={styles?.content}
        data-slot="content"
      >
        {rendered.html ? (
          <span dangerouslySetInnerHTML={{ __html: rendered.html }} />
        ) : rendered.error ? (
          <span
            className={classNames?.error}
            style={styles?.error}
            data-slot="error"
            role="alert"
          >
            {renderError?.(rendered.error, formula) ?? <code>{formula}</code>}
          </span>
        ) : null}
      </span>
      {showCopy ? (
        <button
          className={cx("vl-formula__copy", classNames?.copy)}
          style={styles?.copy}
          data-slot="copy"
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
