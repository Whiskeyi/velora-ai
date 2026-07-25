import { forwardRef, type HTMLAttributes } from "react";
import { useComponentClass, useVelora } from "./VeloraProvider";
import { cx } from "./utils";

export interface StreamingIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  label?: string;
  size?: "small" | "medium";
  visibleLabel?: boolean;
  variant?: "dots" | "pulse" | "wave";
  tone?: "neutral" | "accent" | "success" | "danger";
  active?: boolean;
  progress?: number;
  announce?: boolean;
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
    return (
      <span
        {...rest}
        ref={ref}
        className={cx(componentClass, className)}
        data-size={size}
        data-variant={variant}
        data-tone={tone}
        data-active={active ? "true" : "false"}
        role={determinate ? "progressbar" : active ? "status" : undefined}
        aria-label={ariaLabel ?? (determinate ? resolvedLabel : undefined)}
        aria-live={announce && active && !determinate ? "polite" : undefined}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? 100 : undefined}
        aria-valuenow={normalizedProgress}
      >
        <span className="vl-streaming-indicator__motion" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className={visibleLabel ? "vl-streaming-indicator__label" : "vl-sr-only"}>
          {resolvedLabel}
          {normalizedProgress === undefined ? "" : ` · ${Math.round(normalizedProgress)}%`}
        </span>
      </span>
    );
  },
);
