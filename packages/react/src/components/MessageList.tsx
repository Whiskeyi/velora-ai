import {
  forwardRef,
  memo,
  type HTMLAttributes,
  type ReactNode,
  type UIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AgentMessage } from "../runtime";
import { MessageBubble } from "./MessageBubble";
import { useComponentClass, useVelora } from "./VeloraProvider";
import { assignRef, cx, useMediaQuery } from "./utils";

export type MessageGroupPosition = "single" | "first" | "middle" | "last";

export interface MessageListRenderContext {
  index: number;
  streaming: boolean;
  groupPosition: MessageGroupPosition;
  isLatest: boolean;
  following: boolean;
}

export type MessageListLiveActivityKind = "added" | "complete" | "error" | "aborted";
export type MessageListEmptyPlacement = "start" | "center";

export interface MessageListWindowingOptions {
  /** Message count at which windowing starts. Defaults to 200. */
  threshold?: number;
  /** Estimated rendered row height including spacing. Defaults to 112px. */
  estimateRowHeight?: number;
  /** Extra rows rendered before and after the viewport. Defaults to 6. */
  overscan?: number;
}

export interface MessageListWindowRange {
  start: number;
  end: number;
  total: number;
}

export interface MessageListLiveActivityContext {
  kind: MessageListLiveActivityKind;
  previousMessage?: AgentMessage;
  count: number;
}

export interface MessageListProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  messages: readonly AgentMessage[];
  /** Stable identity for the displayed dataset. Changing it resets scroll and activity state. */
  conversationKey?: string | number;
  renderMessage?: (message: AgentMessage, context: MessageListRenderContext) => ReactNode;
  empty?: ReactNode;
  /** Empty-state placement. Start keeps the state in reading flow; center is opt-in. */
  emptyPlacement?: MessageListEmptyPlacement;
  autoScroll?: boolean;
  /** Distance from the bottom, in pixels, that still counts as following the output. */
  followThreshold?: number;
  /** Distance from the top that triggers `onReachStart`. */
  reachStartThreshold?: number;
  scrollBehavior?: ScrollBehavior;
  showJumpToLatest?: boolean;
  jumpToLatestLabel?: string;
  formatNewActivityLabel?: (count: number, jumpLabel: string) => ReactNode;
  ariaLabel?: string;
  /** Produces concise announcements for additions and terminal status changes only. */
  getLiveAnnouncement?: (
    message: AgentMessage,
    context: MessageListLiveActivityContext,
  ) => string | null;
  onFollowChange?: (following: boolean) => void;
  onNewActivityCountChange?: (count: number) => void;
  onReachStart?: (element: HTMLDivElement) => void | Promise<void>;
  /** Receives synchronous throws and rejected history-loading promises. */
  onReachStartError?: (error: unknown, element: HTMLDivElement) => void;
  /** Opt-in estimated windowing for very long conversations. */
  windowing?: boolean | MessageListWindowingOptions;
  onWindowChange?: (range: MessageListWindowRange) => void;
}

interface MessageListRowProps {
  message: AgentMessage;
  index: number;
  groupPosition: MessageGroupPosition;
  isLatest: boolean;
  following: boolean;
  renderMessage?: MessageListProps["renderMessage"];
}

interface LayoutSnapshot {
  messages: readonly AgentMessage[];
  scrollHeight: number;
  scrollTop: number;
}

interface LiveAnnouncement {
  sequence: number;
  text: string;
}

interface VisualAnchor {
  element: HTMLElement;
  offset: number;
}

const MessageListRow = memo(function MessageListRow({
  message,
  index,
  groupPosition,
  isLatest,
  following,
  renderMessage,
}: MessageListRowProps) {
  return (
    <div
      className="vl-message-list__item"
      data-role={message.role}
      data-group-position={groupPosition}
      data-latest={isLatest ? "true" : undefined}
    >
      {renderMessage?.(message, {
        index,
        streaming: message.status === "streaming",
        groupPosition,
        isLatest,
        following,
      }) ?? <MessageBubble message={message} />}
    </div>
  );
});

function getGroupPosition(messages: readonly AgentMessage[], index: number): MessageGroupPosition {
  const message = messages[index];
  const groupedWithPrevious = index > 0 && messages[index - 1]?.role === message?.role;
  const groupedWithNext =
    index < messages.length - 1 && messages[index + 1]?.role === message?.role;

  if (groupedWithPrevious && groupedWithNext) return "middle";
  if (groupedWithPrevious) return "last";
  if (groupedWithNext) return "first";
  return "single";
}

/** Returns the number of IDs inserted before an otherwise unchanged message sequence. */
function getPrependedCount(
  previous: readonly AgentMessage[],
  current: readonly AgentMessage[],
): number {
  if (previous.length === 0 || current.length <= previous.length) return 0;
  const firstPreviousId = previous[0]?.id;
  const offset = current.findIndex((message) => message.id === firstPreviousId);
  if (offset <= 0 || current.length < previous.length + offset) return 0;

  for (let index = 0; index < previous.length; index += 1) {
    if (current[index + offset]?.id !== previous[index]?.id) return 0;
  }
  return offset;
}

function messageHasChanged(previous: AgentMessage, current: AgentMessage): boolean {
  return (
    previous.updatedAt !== current.updatedAt ||
    previous.status !== current.status ||
    previous.content !== current.content ||
    previous.reasoning !== current.reasoning ||
    previous.error !== current.error ||
    previous.steps !== current.steps ||
    previous.metadata !== current.metadata
  );
}

function MessageListInner(
  {
    messages,
    conversationKey,
    renderMessage,
    empty,
    emptyPlacement = "start",
    autoScroll = true,
    followThreshold = 72,
    reachStartThreshold = 48,
    scrollBehavior = "smooth",
    showJumpToLatest = true,
    jumpToLatestLabel,
    formatNewActivityLabel,
    ariaLabel,
    tabIndex = 0,
    getLiveAnnouncement: getLiveAnnouncementProp,
    className,
    onScroll,
    onFollowChange,
    onNewActivityCountChange,
    onReachStart,
    onReachStartError,
    windowing = false,
    onWindowChange,
    ...rest
  }: MessageListProps,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const componentClass = useComponentClass("message-list");
  const { messages: localeMessages, reducedMotion } = useVelora();
  const copy = localeMessages.messageList;
  const resolvedEmpty = empty ?? copy.empty;
  const resolvedJumpToLatestLabel = jumpToLatestLabel ?? copy.jumpToLatest;
  const resolvedFormatNewActivityLabel =
    formatNewActivityLabel ?? copy.newActivity;
  const resolvedAriaLabel = ariaLabel ?? copy.ariaLabel;
  const getLiveAnnouncement = useCallback(
    (message: AgentMessage, context: MessageListLiveActivityContext) => {
      if (getLiveAnnouncementProp) return getLiveAnnouncementProp(message, context);
      const role =
        message.role === "assistant"
          ? copy.roleAssistant
          : message.role === "user"
            ? copy.roleUser
            : message.role === "tool"
              ? copy.roleTool
              : copy.roleSystem;
      if (context.kind === "complete") return copy.responseComplete(role);
      if (context.kind === "error") return copy.messageFailed(role);
      if (context.kind === "aborted") return copy.responseStopped(role);
      return copy.messageAdded(role, context.count);
    },
    [copy, getLiveAnnouncementProp],
  );
  const systemReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const followingRef = useRef(true);
  const reachedStartRef = useRef(false);
  const reachStartPendingRef = useRef(false);
  const reachStartRequestRef = useRef(0);
  const conversationKeyRef = useRef(conversationKey);
  const previousMessagesRef = useRef(messages);
  const activityIdsRef = useRef(new Set<string>());
  const newActivityCountRef = useRef(0);
  const layoutSnapshotRef = useRef<LayoutSnapshot | null>(null);
  const updateWasPrependRef = useRef(false);
  const skipNextAutoScrollRef = useRef(false);
  const visualAnchorRef = useRef<VisualAnchor | null>(null);
  const announcementSequenceRef = useRef(0);
  const [following, setFollowing] = useState(true);
  const [newActivityCount, setNewActivityCount] = useState(0);
  const [liveAnnouncement, setLiveAnnouncement] = useState<LiveAnnouncement | null>(null);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 });
  const windowFrameRef = useRef(0);

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      assignRef(forwardedRef, node);
    },
    [forwardedRef],
  );

  const updateActivityCount = useCallback(
    (next: number) => {
      if (newActivityCountRef.current === next) return;
      newActivityCountRef.current = next;
      setNewActivityCount(next);
      onNewActivityCountChange?.(next);
    },
    [onNewActivityCountChange],
  );

  const clearActivity = useCallback(() => {
    activityIdsRef.current.clear();
    updateActivityCount(0);
  }, [updateActivityCount]);

  const setFollowState = useCallback(
    (next: boolean) => {
      if (next) clearActivity();
      if (followingRef.current === next) return;
      followingRef.current = next;
      setFollowing(next);
      onFollowChange?.(next);
    },
    [clearActivity, onFollowChange],
  );

  const prefersReducedMotion =
    reducedMotion === true || (reducedMotion === "system" && systemReducedMotion);

  const captureVisualAnchor = useCallback(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content) {
      visualAnchorRef.current = null;
      return;
    }

    const rootTop = root.getBoundingClientRect().top;
    let anchor: HTMLElement | null = null;
    let fallback: HTMLElement | null = null;
    for (const element of content.children) {
      if (!(element instanceof HTMLElement)) continue;
      if (element.dataset.spacer) continue;
      fallback = element;
      if (element.getBoundingClientRect().bottom > rootTop) {
        anchor = element;
        break;
      }
    }
    anchor ??= fallback;

    visualAnchorRef.current = anchor
      ? { element: anchor, offset: anchor.getBoundingClientRect().top - rootTop }
      : null;
  }, []);

  const scrollToLatest = useCallback(
    (behavior: ScrollBehavior = scrollBehavior) => {
      const root = rootRef.current;
      if (!root) return;
      const resolvedBehavior = prefersReducedMotion ? "auto" : behavior;
      if (typeof root.scrollTo === "function") {
        root.scrollTo({ top: root.scrollHeight, behavior: resolvedBehavior });
      } else {
        root.scrollTop = root.scrollHeight;
      }
    },
    [prefersReducedMotion, scrollBehavior],
  );

  const handleReachStart = useCallback(
    (element: HTMLDivElement) => {
      if (!onReachStart || reachStartPendingRef.current) return;
      reachedStartRef.current = true;
      reachStartPendingRef.current = true;
      reachStartRequestRef.current += 1;
      const request = reachStartRequestRef.current;

      let result: void | Promise<void>;
      try {
        result = onReachStart(element);
      } catch (error) {
        reachStartPendingRef.current = false;
        reachedStartRef.current = false;
        onReachStartError?.(error, element);
        return;
      }

      void Promise.resolve(result).then(
        () => {
          if (reachStartRequestRef.current === request) {
            reachStartPendingRef.current = false;
          }
        },
        (error: unknown) => {
          if (reachStartRequestRef.current !== request) return;
          reachStartPendingRef.current = false;
          reachedStartRef.current = false;
          onReachStartError?.(error, element);
        },
      );
    },
    [onReachStart, onReachStartError],
  );

  useEffect(
    () => () => {
      reachStartRequestRef.current += 1;
      reachStartPendingRef.current = false;
    },
    [],
  );

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const distance = element.scrollHeight - element.clientHeight - element.scrollTop;
    setFollowState(distance <= Math.max(0, followThreshold));

    if (layoutSnapshotRef.current) {
      layoutSnapshotRef.current.scrollHeight = element.scrollHeight;
      layoutSnapshotRef.current.scrollTop = element.scrollTop;
    }

    const reachedStart = element.scrollTop <= Math.max(0, reachStartThreshold);
    if (reachedStart && !reachedStartRef.current) {
      handleReachStart(element);
    } else if (!reachedStart) {
      reachedStartRef.current = false;
    }
    if (followingRef.current) visualAnchorRef.current = null;
    else captureVisualAnchor();
    if (windowing) {
      cancelAnimationFrame(windowFrameRef.current);
      windowFrameRef.current = requestAnimationFrame(() => {
        setViewport({
          scrollTop: element.scrollTop,
          height: element.clientHeight,
        });
      });
    }
    onScroll?.(event);
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(windowFrameRef.current);
    },
    [],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !windowing) return;
    setViewport({ scrollTop: root.scrollTop, height: root.clientHeight });
  }, [conversationKey, messages.length, windowing]);

  useLayoutEffect(() => {
    if (Object.is(conversationKeyRef.current, conversationKey)) return;
    conversationKeyRef.current = conversationKey;
    reachStartRequestRef.current += 1;
    reachStartPendingRef.current = false;
    reachedStartRef.current = false;
    previousMessagesRef.current = messages;
    layoutSnapshotRef.current = null;
    updateWasPrependRef.current = false;
    visualAnchorRef.current = null;
    setLiveAnnouncement(null);
    setFollowState(true);
    scrollToLatest("auto");
    skipNextAutoScrollRef.current = true;
  }, [conversationKey, messages, scrollToLatest, setFollowState]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const previous = layoutSnapshotRef.current;
    const prependedCount = previous ? getPrependedCount(previous.messages, messages) : 0;
    updateWasPrependRef.current = prependedCount > 0;

    if (previous && prependedCount > 0) {
      const anchor = visualAnchorRef.current;
      const rootTop = root.getBoundingClientRect().top;
      const anchorOffsetChange = anchor?.element.isConnected
        ? anchor.element.getBoundingClientRect().top - rootTop - anchor.offset
        : 0;
      const addedHeight = Math.max(0, root.scrollHeight - previous.scrollHeight);
      root.scrollTop =
        Math.abs(anchorOffsetChange) > 0.5
          ? root.scrollTop + anchorOffsetChange
          : previous.scrollTop + addedHeight;
    }

    layoutSnapshotRef.current = {
      messages,
      scrollHeight: root.scrollHeight,
      scrollTop: root.scrollTop,
    };
    if (followingRef.current) visualAnchorRef.current = null;
    else if (prependedCount > 0 || !visualAnchorRef.current) captureVisualAnchor();
  }, [captureVisualAnchor, messages]);

  useEffect(() => {
    const previous = previousMessagesRef.current;
    if (previous === messages) return;
    const prependedCount = getPrependedCount(previous, messages);
    const previousById = new Map(previous.map((message) => [message.id, message]));
    const additions = messages.filter(
      (message, index) => !previousById.has(message.id) && index >= prependedCount,
    );

    if (!followingRef.current) {
      const currentIds = new Set(messages.map((message) => message.id));
      activityIdsRef.current.forEach((id) => {
        if (!currentIds.has(id)) activityIdsRef.current.delete(id);
      });
      messages.forEach((message, index) => {
        const previousMessage = previousById.get(message.id);
        const isPrependedHistory = !previousMessage && index < prependedCount;
        if (
          !isPrependedHistory &&
          (!previousMessage || messageHasChanged(previousMessage, message))
        ) {
          activityIdsRef.current.add(message.id);
        }
      });
      updateActivityCount(activityIdsRef.current.size);
    }

    let announcedMessage: AgentMessage | undefined;
    let announcedPrevious: AgentMessage | undefined;
    let kind: MessageListLiveActivityKind | undefined;
    if (additions.length > 0) {
      announcedMessage = additions[additions.length - 1];
      kind = "added";
    } else {
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        const previousMessage = message ? previousById.get(message.id) : undefined;
        if (!message || !previousMessage || previousMessage.status === message.status) continue;
        if (
          message.status === "complete" ||
          message.status === "error" ||
          message.status === "aborted"
        ) {
          announcedMessage = message;
          announcedPrevious = previousMessage;
          kind = message.status;
          break;
        }
      }
    }

    if (announcedMessage && kind) {
      const text = getLiveAnnouncement(announcedMessage, {
        kind,
        previousMessage: announcedPrevious,
        count: additions.length || 1,
      });
      if (text) {
        announcementSequenceRef.current += 1;
        setLiveAnnouncement({ sequence: announcementSequenceRef.current, text });
      }
    }

    previousMessagesRef.current = messages;
  }, [getLiveAnnouncement, messages, updateActivityCount]);

  const latestMessage = messages[messages.length - 1];
  const latestSignature = latestMessage
    ? `${latestMessage.id}:${latestMessage.updatedAt}:${latestMessage.status}:${latestMessage.content.length}`
    : "empty";

  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
    if (updateWasPrependRef.current) return;
    if (autoScroll && followingRef.current) {
      scrollToLatest(messages.length <= 1 ? "auto" : scrollBehavior);
    }
  }, [autoScroll, latestSignature, messages.length, scrollBehavior, scrollToLatest]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return undefined;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      const root = rootRef.current;
      if (!root) return;
      if (!followingRef.current) {
        const anchor = visualAnchorRef.current;
        if (anchor?.element.isConnected) {
          const rootTop = root.getBoundingClientRect().top;
          const nextOffset = anchor.element.getBoundingClientRect().top - rootTop;
          const offsetChange = nextOffset - anchor.offset;
          if (Math.abs(offsetChange) > 0.5) root.scrollTop += offsetChange;
        }
        captureVisualAnchor();
        if (layoutSnapshotRef.current) {
          layoutSnapshotRef.current.scrollHeight = root.scrollHeight;
          layoutSnapshotRef.current.scrollTop = root.scrollTop;
        }
        return;
      }
      if (!autoScroll) {
        if (layoutSnapshotRef.current) {
          layoutSnapshotRef.current.scrollHeight = root.scrollHeight;
          layoutSnapshotRef.current.scrollTop = root.scrollTop;
        }
        return;
      }
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (followingRef.current) scrollToLatest("auto");
      });
    });
    observer.observe(content);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [autoScroll, captureVisualAnchor, scrollToLatest]);

  const jumpButtonLabel =
    newActivityCount > 0
      ? copy.newActivity(newActivityCount, resolvedJumpToLatestLabel)
      : resolvedJumpToLatestLabel;
  const windowRange = useMemo<MessageListWindowRange>(() => {
    const options = typeof windowing === "object" ? windowing : {};
    const threshold = Math.max(1, Math.floor(options.threshold ?? 200));
    if (!windowing || messages.length < threshold) {
      return { start: 0, end: messages.length, total: messages.length };
    }
    const rowHeight = Math.max(24, options.estimateRowHeight ?? 112);
    const overscan = Math.max(1, Math.floor(options.overscan ?? 6));
    const visibleRows = Math.max(1, Math.ceil(viewport.height / rowHeight));
    const estimatedStart = Math.floor(viewport.scrollTop / rowHeight);
    const start = Math.max(
      0,
      Math.min(messages.length - 1, estimatedStart - overscan),
    );
    const end = Math.min(
      messages.length,
      start + visibleRows + overscan * 2,
    );
    return { start, end, total: messages.length };
  }, [messages.length, viewport.height, viewport.scrollTop, windowing]);
  const windowOptions = typeof windowing === "object" ? windowing : {};
  const estimatedRowHeight = Math.max(
    24,
    windowOptions.estimateRowHeight ?? 112,
  );

  useEffect(() => {
    onWindowChange?.(windowRange);
  }, [onWindowChange, windowRange]);

  return (
    <div
      {...rest}
      ref={setRootRef}
      className={cx(componentClass, className)}
      onScroll={handleScroll}
      role="log"
      aria-label={resolvedAriaLabel}
      aria-live="off"
      tabIndex={tabIndex}
      data-following={following ? "true" : "false"}
      data-new-activity-count={newActivityCount}
      data-empty-placement={emptyPlacement}
    >
      <div ref={contentRef} className="vl-message-list__content">
        {messages.length === 0 ? (
          <div className="vl-message-list__empty">{resolvedEmpty}</div>
        ) : (
          <>
            {windowRange.start > 0 ? (
              <div
                className="vl-message-list__spacer"
                style={{ height: windowRange.start * estimatedRowHeight }}
                aria-hidden="true"
                data-spacer="start"
              />
            ) : null}
            {messages
              .slice(windowRange.start, windowRange.end)
              .map((message, localIndex) => {
                const index = windowRange.start + localIndex;
                return (
                  <MessageListRow
                    key={message.id}
                    message={message}
                    index={index}
                    groupPosition={getGroupPosition(messages, index)}
                    isLatest={index === messages.length - 1}
                    following={following}
                    renderMessage={renderMessage}
                  />
                );
              })}
            {windowRange.end < messages.length ? (
              <div
                className="vl-message-list__spacer"
                style={{
                  height:
                    (messages.length - windowRange.end) * estimatedRowHeight,
                }}
                aria-hidden="true"
                data-spacer="end"
              />
            ) : null}
          </>
        )}
      </div>
      <span
        key={liveAnnouncement?.sequence ?? 0}
        className="vl-sr-only vl-message-list__live-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-slot="live-region"
      >
        {liveAnnouncement?.text}
      </span>
      {showJumpToLatest && !following ? (
        <button
          className="vl-message-list__jump"
          type="button"
          onClick={() => {
            const root = rootRef.current;
            scrollToLatest();
            root?.focus({ preventScroll: true });
          }}
          aria-label={jumpButtonLabel}
          data-new-activity-count={newActivityCount}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m5.5 8 4.5 4.5L14.5 8M10 3.5v8" />
          </svg>
          <span>
            {newActivityCount > 0
              ? resolvedFormatNewActivityLabel(
                  newActivityCount,
                  resolvedJumpToLatestLabel,
                )
              : resolvedJumpToLatestLabel}
          </span>
        </button>
      ) : null}
    </div>
  );
}

const ForwardedMessageList = forwardRef<HTMLDivElement, MessageListProps>(MessageListInner);
ForwardedMessageList.displayName = "MessageList";

/** Shallow memoization assumes immutable message updates, matching the runtime contract. */
export const MessageList = memo(ForwardedMessageList);
