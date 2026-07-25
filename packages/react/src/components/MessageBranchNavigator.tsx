import {
  forwardRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
} from "react";
import { useComponentClass } from "./VeloraProvider";
import {
  composeStyles,
  cx,
  type SemanticClassNames,
  type SemanticStyles,
  useControllableState,
} from "./utils";

export type MessageBranchNavigatorSlot = "root" | "button" | "previous" | "counter" | "next";

export interface MessageBranchNavigatorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "onChange"
> {
  /** Number of available response branches. */
  count: number;
  /** Zero-based active branch index. */
  index?: number;
  /** Zero-based initial index for uncontrolled usage. */
  defaultIndex?: number;
  onIndexChange?: (index: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  formatCount?: (index: number, count: number) => ReactNode;
  previousIcon?: ReactNode;
  nextIcon?: ReactNode;
  classNames?: SemanticClassNames<MessageBranchNavigatorSlot>;
  styles?: SemanticStyles<MessageBranchNavigatorSlot>;
}

const clampIndex = (index: number, count: number) => {
  const finiteIndex = Number.isFinite(index) ? Math.floor(index) : 0;
  return count === 0 ? 0 : Math.min(Math.max(0, finiteIndex), count - 1);
};

export const MessageBranchNavigator = forwardRef<HTMLDivElement, MessageBranchNavigatorProps>(
  function MessageBranchNavigator(
    {
      count,
      index,
      defaultIndex = 0,
      onIndexChange,
      disabled = false,
      ariaLabel = "Response versions",
      previousLabel = "Previous response version",
      nextLabel = "Next response version",
      formatCount = (activeIndex, total) =>
        total === 0 ? "0 / 0" : `${activeIndex + 1} / ${total}`,
      previousIcon,
      nextIcon,
      className,
      style,
      classNames,
      styles,
      onKeyDown,
      tabIndex,
      ...rest
    },
    ref,
  ) {
    const componentClass = useComponentClass("message-branch-navigator");
    const normalizedCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    const [selectedIndex, setSelectedIndex] = useControllableState({
      value: index,
      defaultValue: clampIndex(defaultIndex, normalizedCount),
      onChange: onIndexChange,
    });
    const activeIndex = clampIndex(selectedIndex, normalizedCount);
    const canGoPrevious = !disabled && normalizedCount > 0 && activeIndex > 0;
    const canGoNext = !disabled && normalizedCount > 0 && activeIndex < normalizedCount - 1;
    const inactive = disabled || normalizedCount === 0;
    const resolvedTabIndex = tabIndex ?? (inactive ? -1 : 0);

    useEffect(() => {
      if (index === undefined && selectedIndex !== activeIndex) {
        setSelectedIndex(activeIndex);
      }
    }, [activeIndex, index, selectedIndex, setSelectedIndex]);

    const moveTo = (nextIndex: number) => {
      if (disabled || normalizedCount === 0) return;
      setSelectedIndex(clampIndex(nextIndex, normalizedCount));
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || inactive) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (canGoPrevious) moveTo(activeIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (canGoNext) moveTo(activeIndex + 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        moveTo(0);
      } else if (event.key === "End") {
        event.preventDefault();
        moveTo(normalizedCount - 1);
      }
    };

    return (
      <div
        {...rest}
        ref={ref}
        className={cx(componentClass, classNames?.root, className)}
        style={composeStyles(styles?.root, style)}
        role="group"
        aria-label={ariaLabel}
        aria-disabled={disabled || normalizedCount === 0 || undefined}
        data-index={activeIndex}
        data-count={normalizedCount}
        tabIndex={resolvedTabIndex}
        onKeyDown={handleKeyDown}
      >
        <button
          className={cx(
            "vl-message-branch-navigator__button",
            classNames?.button,
            classNames?.previous,
          )}
          style={composeStyles(styles?.button, styles?.previous)}
          type="button"
          aria-label={previousLabel}
          disabled={!canGoPrevious}
          data-action="previous"
          onClick={() => moveTo(activeIndex - 1)}
        >
          {previousIcon ?? (
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m12.5 5-5 5 5 5" />
            </svg>
          )}
        </button>
        <span
          className={cx("vl-message-branch-navigator__counter", classNames?.counter)}
          style={styles?.counter}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-slot="counter"
        >
          {formatCount(activeIndex, normalizedCount)}
        </span>
        <button
          className={cx(
            "vl-message-branch-navigator__button",
            classNames?.button,
            classNames?.next,
          )}
          style={composeStyles(styles?.button, styles?.next)}
          type="button"
          aria-label={nextLabel}
          disabled={!canGoNext}
          data-action="next"
          onClick={() => moveTo(activeIndex + 1)}
        >
          {nextIcon ?? (
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m7.5 5 5 5-5 5" />
            </svg>
          )}
        </button>
      </div>
    );
  },
);
