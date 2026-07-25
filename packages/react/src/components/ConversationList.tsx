import {
  type ChangeEvent,
  forwardRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { Conversation } from "../runtime";
import { useComponentClass } from "./VeloraProvider";
import {
  composeStyles,
  cx,
  type SemanticClassNames,
  type SemanticStyles,
  useControllableState,
} from "./utils";

export type ConversationListSlot =
  | "root"
  | "list"
  | "header"
  | "search"
  | "createButton"
  | "group"
  | "groupLabel"
  | "item"
  | "itemButton"
  | "itemContent"
  | "title"
  | "description"
  | "meta"
  | "status"
  | "itemActions"
  | "empty";

export type ConversationListStatus = "idle" | "unread" | "streaming" | "error";

export interface ConversationRenderContext {
  active: boolean;
  index: number;
  status: ConversationListStatus;
  select: () => void;
}

export interface ConversationListProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "onSelect"> {
  conversations: readonly Conversation[];
  activeId?: string | null;
  defaultActiveId?: string | null;
  onActiveChange?: (id: string, conversation: Conversation) => void;
  renderItem?: (conversation: Conversation, context: ConversationRenderContext) => ReactNode;
  renderItemActions?: (
    conversation: Conversation,
    context: ConversationRenderContext,
  ) => ReactNode;
  getTitle?: (conversation: Conversation) => ReactNode;
  getDescription?: (conversation: Conversation) => ReactNode;
  getMeta?: (conversation: Conversation) => ReactNode;
  getStatus?: (conversation: Conversation) => ConversationListStatus;
  statusLabels?: Partial<Record<ConversationListStatus, string>>;
  searchable?: boolean;
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  filterConversation?: (conversation: Conversation, query: string) => boolean;
  searchPlaceholder?: string;
  searchLabel?: string;
  groupBy?: (conversation: Conversation) => string;
  renderGroupLabel?: (group: string) => ReactNode;
  onCreate?: () => void;
  createLabel?: string;
  empty?: ReactNode;
  noResults?: ReactNode;
  ariaLabel?: string;
  classNames?: SemanticClassNames<ConversationListSlot>;
  styles?: SemanticStyles<ConversationListSlot>;
}

const defaultStatusLabels: Record<ConversationListStatus, string> = {
  idle: "Idle",
  unread: "Unread activity",
  streaming: "Generating response",
  error: "Needs attention",
};

function defaultTitle(conversation: Conversation): ReactNode {
  return conversation.title?.trim() || "Untitled conversation";
}

export const ConversationList = forwardRef<HTMLElement, ConversationListProps>(
  function ConversationList(
    {
      conversations,
      activeId,
      defaultActiveId = null,
      onActiveChange,
      renderItem,
      renderItemActions,
      getTitle = defaultTitle,
      getDescription,
      getMeta,
      getStatus = () => "idle",
      statusLabels,
      searchable = false,
      query,
      defaultQuery = "",
      onQueryChange,
      filterConversation,
      searchPlaceholder = "Search conversations",
      searchLabel = "Search conversations",
      groupBy,
      renderGroupLabel,
      onCreate,
      createLabel = "New conversation",
      empty = "No conversations yet",
      noResults = "No matching conversations",
      ariaLabel = "Conversations",
      className,
      style,
      classNames,
      styles,
      ...rest
    },
    ref,
  ) {
    const componentClass = useComponentClass("conversation-list");
    const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [currentActiveId, setCurrentActiveId] = useControllableState({
      value: activeId,
      defaultValue: defaultActiveId,
    });
    const [currentQuery, setCurrentQuery] = useControllableState({
      value: query,
      defaultValue: defaultQuery,
      onChange: onQueryChange,
    });
    const labels = { ...defaultStatusLabels, ...statusLabels };
    const visibleConversations = useMemo(() => {
      const normalized = currentQuery.trim();
      if (!normalized) return conversations;
      return conversations.filter((conversation) =>
        filterConversation
          ? filterConversation(conversation, normalized)
          : (conversation.title ?? "").toLocaleLowerCase().includes(
              normalized.toLocaleLowerCase(),
            ),
      );
    }, [conversations, currentQuery, filterConversation]);

    const focusAt = useCallback(
      (index: number) => {
        if (!visibleConversations.length) return;
        const normalized =
          (index + visibleConversations.length) % visibleConversations.length;
        buttonRefs.current[normalized]?.focus();
      },
      [visibleConversations.length],
    );

    const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
      const currentIndex = buttonRefs.current.findIndex(
        (button) => button === document.activeElement,
      );
      if (currentIndex < 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        focusAt(currentIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        focusAt(currentIndex - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        focusAt(0);
      } else if (event.key === "End") {
        event.preventDefault();
        focusAt(visibleConversations.length - 1);
      }
    };

    return (
      <nav
        {...rest}
        ref={ref}
        className={cx(componentClass, classNames?.root, className)}
        style={composeStyles(styles?.root, style)}
        aria-label={ariaLabel}
        data-slot="root"
      >
        {searchable || onCreate ? (
          <div
            className={cx("vl-conversation-list__header", classNames?.header)}
            style={styles?.header}
            data-slot="header"
          >
            {searchable ? (
              <label className="vl-conversation-list__search-wrap">
                <span className="vl-sr-only">{searchLabel}</span>
                <input
                  className={cx("vl-conversation-list__search", classNames?.search)}
                  style={styles?.search}
                  type="search"
                  value={currentQuery}
                  placeholder={searchPlaceholder}
                  aria-label={searchLabel}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setCurrentQuery(event.currentTarget.value)
                  }
                  data-slot="search"
                />
              </label>
            ) : null}
            {onCreate ? (
              <button
                className={cx(
                  "vl-conversation-list__create",
                  classNames?.createButton,
                )}
                style={styles?.createButton}
                type="button"
                onClick={onCreate}
                aria-label={createLabel}
                data-slot="createButton"
              >
                <span aria-hidden="true">+</span>
              </button>
            ) : null}
          </div>
        ) : null}
        {conversations.length === 0 || visibleConversations.length === 0 ? (
          <div
            className={cx("vl-conversation-list__empty", classNames?.empty)}
            style={styles?.empty}
            data-slot="empty"
          >
            {conversations.length === 0 ? empty : noResults}
          </div>
        ) : (
          <ul
            className={cx("vl-conversation-list__list", classNames?.list)}
            style={styles?.list}
            onKeyDown={handleKeyDown}
            data-slot="list"
          >
            {visibleConversations.map((conversation, index) => {
              const active = conversation.id === currentActiveId;
              const status = getStatus(conversation);
              const select = () => {
                setCurrentActiveId(conversation.id);
                onActiveChange?.(conversation.id, conversation);
              };
              const context: ConversationRenderContext = {
                active,
                index,
                status,
                select,
              };
              const content = renderItem?.(conversation, context);
              const previousGroup =
                index > 0 && groupBy
                  ? groupBy(visibleConversations[index - 1] as Conversation)
                  : undefined;
              const group = groupBy?.(conversation);
              const showGroup = group !== undefined && group !== previousGroup;
              return (
                <li key={conversation.id} className={cx("vl-conversation-list__group", classNames?.group)} style={styles?.group} data-slot="group">
                  {showGroup ? (
                    <div className={cx("vl-conversation-list__group-label", classNames?.groupLabel)} style={styles?.groupLabel} data-slot="groupLabel">
                      {renderGroupLabel?.(group) ?? group}
                    </div>
                  ) : null}
                  <div
                    className={cx("vl-conversation-list__item", classNames?.item)}
                    style={styles?.item}
                    data-slot="item"
                    data-status={status}
                  >
                  <button
                    ref={(node) => {
                      buttonRefs.current[index] = node;
                    }}
                    type="button"
                    className={cx(
                      "vl-conversation-list__button",
                      classNames?.itemButton,
                    )}
                    style={styles?.itemButton}
                    aria-current={active ? "page" : undefined}
                    onClick={select}
                    data-active={active ? "true" : "false"}
                    data-slot="itemButton"
                  >
                    {content ?? (
                      <span
                        className={cx(
                          "vl-conversation-list__content",
                          classNames?.itemContent,
                        )}
                        style={styles?.itemContent}
                        data-slot="itemContent"
                      >
                        <span
                          className={cx(
                            "vl-conversation-list__title",
                            classNames?.title,
                          )}
                          style={styles?.title}
                          data-slot="title"
                        >
                          {getTitle(conversation)}
                        </span>
                        {getDescription ? (
                          <span
                            className={cx(
                              "vl-conversation-list__description",
                              classNames?.description,
                            )}
                            style={styles?.description}
                            data-slot="description"
                          >
                            {getDescription(conversation)}
                          </span>
                        ) : null}
                      </span>
                    )}
                    {getMeta ? (
                      <span
                        className={cx("vl-conversation-list__meta", classNames?.meta)}
                        style={styles?.meta}
                        data-slot="meta"
                      >
                        {getMeta(conversation)}
                      </span>
                    ) : null}
                    {status !== "idle" ? (
                      <span className={cx("vl-conversation-list__status", classNames?.status)} style={styles?.status} data-slot="status" data-status={status}>
                        <span aria-hidden="true" />
                        <span className="vl-sr-only">{labels[status]}</span>
                      </span>
                    ) : null}
                  </button>
                  {renderItemActions ? (
                    <div className={cx("vl-conversation-list__actions", classNames?.itemActions)} style={styles?.itemActions} data-slot="itemActions">
                      {renderItemActions(conversation, context)}
                    </div>
                  ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    );
  },
);
