// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Conversation } from "../runtime";
import { ConversationList } from "./ConversationList";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

async function render(node: ReactNode): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(node));
  return container;
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

const conversations: readonly Conversation[] = [
  {
    id: "active",
    title: "Active build",
    messageIds: [],
    createdAt: 1,
    updatedAt: 3,
    metadata: { group: "Today" },
  },
  {
    id: "research",
    title: "Research notes",
    messageIds: [],
    createdAt: 1,
    updatedAt: 2,
    metadata: { group: "Earlier" },
  },
];

describe("ConversationList deep interactions", () => {
  it("filters without losing selection and distinguishes no-results from empty", async () => {
    const onActiveChange = vi.fn();
    const view = await render(
      <ConversationList
        conversations={conversations}
        searchable
        defaultActiveId="active"
        onActiveChange={onActiveChange}
      />,
    );
    const search = view.querySelector<HTMLInputElement>("input[type='search']");
    await act(async () => {
      if (!search) return;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(search, "research");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(view.querySelectorAll(".vl-conversation-list__button")).toHaveLength(1);
    expect(view.textContent).toContain("Research notes");
    await act(async () =>
      view.querySelector<HTMLButtonElement>(".vl-conversation-list__button")?.click(),
    );
    expect(onActiveChange).toHaveBeenCalledWith("research", conversations[1]);

    await act(async () => {
      if (!search) return;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(search, "missing");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(view.textContent).toContain("No matching conversations");
  });

  it("renders grouped status and per-item actions outside the selection button", async () => {
    const onCreate = vi.fn();
    const action = vi.fn();
    const view = await render(
      <ConversationList
        conversations={conversations}
        groupBy={(conversation) => String(conversation.metadata?.group)}
        getStatus={(conversation) =>
          conversation.id === "active" ? "streaming" : "unread"
        }
        renderItemActions={(conversation) => (
          <button type="button" onClick={() => action(conversation.id)}>
            More
          </button>
        )}
        onCreate={onCreate}
      />,
    );

    expect(view.querySelectorAll(".vl-conversation-list__group-label")).toHaveLength(2);
    expect(view.querySelector("[data-status='streaming'] .vl-sr-only")?.textContent).toBe(
      "Generating response",
    );
    expect(
      view.querySelector(".vl-conversation-list__button .vl-conversation-list__actions"),
    ).toBeNull();
    await act(async () =>
      view.querySelector<HTMLButtonElement>(".vl-conversation-list__actions button")?.click(),
    );
    expect(action).toHaveBeenCalledWith("active");
    await act(async () =>
      view.querySelector<HTMLButtonElement>(".vl-conversation-list__create")?.click(),
    );
    expect(onCreate).toHaveBeenCalledOnce();
  });
});
