import { forwardRef, type HTMLAttributes } from "react";
import { useComponentClass, useVelora } from "./VeloraProvider";
import {
  composeStyles,
  cx,
  type SemanticClassNames,
  type SemanticStyles,
} from "./utils";

export type StreamingIndicatorSlot = "root" | "motion" | "label";

export interface StreamingIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  label?: string;
  size?: "small" | "medium";
  visibleLabel?: boolean;
  variant?: "dots" | "pulse" | "wave";
  tone?: "neutral" | "accent" | "success" | "danger";
  active?: boolean;
  progress?: number;
  announce?: boolean;
  classNames?: SemanticClassNames<StreamingIndicatorSlot>;
  styles?: SemanticStyles<StreamingIndicatorSlot>;
}

export const StreamingIndicator = forwardRef<HTMLSpanElement, StreamingIndicatorProps>(
  function StreamingIndicator(
    {
      label,
      size = "medium",
      visibleLabel = false,
      variant = "dots",
      tone = "neutral",
      active = true,
      progress,
      announce = true,
      className,
      style,
      classNames,
      styles,
      "aria-label": ariaLabel,
      ...rest
    },
    ref,
  ) {
    const componentClass = useComponentClass("streaming-indicator");
    const { messages } = useVelora();
    const resolvedLabel = label ?? messages.streamingIndicator.generating;
    const normalizedProgress =
      progress === undefined || !Number.isFinite(progress)
        ? undefined
        : Math.min(100, Math.max(0, progress));
    const determinate = normalizedProgress !== undefined;
    const effectiveActive =
      active && (normalizedProgress === undefined || normalizedProgress < 100);
    return (
      <span
        {...rest}
        ref={ref}
        className={cx(componentClass, classNames?.root, className)}
        style={composeStyles(styles?.root, style)}
        data-slot="root"
        data-size={size}
        data-variant={variant}
        data-tone={tone}
        data-active={effectiveActive ? "true" : "false"}
        role={determinate ? "progressbar" : effectiveActive ? "status" : undefined}
        aria-label={ariaLabel ?? (determinate ? resolvedLabel : undefined)}
        aria-live={announce && effectiveActive && !determinate ? "polite" : undefined}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? 100 : undefined}
        aria-valuenow={normalizedProgress}
      >
        <span
          className={cx("vl-streaming-indicator__motion", classNames?.motion)}
          style={styles?.motion}
          data-slot="motion"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </span>
        <span
          className={cx(
            visibleLabel ? "vl-streaming-indicator__label" : "vl-sr-only",
            classNames?.label,
          )}
          style={styles?.label}
          data-slot="label"
        >
          {resolvedLabel}
          {normalizedProgress === undefined ? "" : ` · ${Math.round(normalizedProgress)}%`}
        </span>
      </span>
    );
  },
);
