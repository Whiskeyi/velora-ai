// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentMessage, Conversation } from "../runtime";
import { AgentShell } from "./AgentShell";
import { AgentSteps } from "./AgentSteps";
import { CodeBlock } from "./CodeBlock";
import { ConversationList } from "./ConversationList";
import { Formula } from "./Formula";
import { MessageBubble } from "./MessageBubble";
import { MessageList } from "./MessageList";
import { ReasoningPanel } from "./ReasoningPanel";

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

describe("component interaction contracts", () => {
  it("selects conversations without requiring controlled state", async () => {
    const conversations: Conversation[] = [
      { id: "one", title: "One", messageIds: [], createdAt: 1, updatedAt: 1 },
      { id: "two", title: "Two", messageIds: [], createdAt: 2, updatedAt: 2 },
    ];
    const onActiveChange = vi.fn();
    const view = await render(
      <ConversationList
        conversations={conversations}
        defaultActiveId="one"
        onActiveChange={onActiveChange}
      />,
    );
    const buttons = view.querySelectorAll<HTMLButtonElement>(
      ".vl-conversation-list__button",
    );

    expect(buttons[0]?.getAttribute("aria-current")).toBe("page");
    await act(async () => buttons[1]?.click());
    expect(buttons[0]?.hasAttribute("aria-current")).toBe(false);
    expect(buttons[1]?.getAttribute("aria-current")).toBe("page");
    expect(onActiveChange).toHaveBeenCalledWith("two", conversations[1]);
  });

  it("keeps ConversationList selection controlled when activeId is provided", async () => {
    const conversations: Conversation[] = [
      { id: "one", title: "One", messageIds: [], createdAt: 1, updatedAt: 1 },
      { id: "two", title: "Two", messageIds: [], createdAt: 2, updatedAt: 2 },
    ];
    const onActiveChange = vi.fn();
    const view = await render(
      <ConversationList
        conversations={conversations}
        activeId="one"
        onActiveChange={onActiveChange}
      />,
    );
    const buttons = view.querySelectorAll<HTMLButtonElement>(
      ".vl-conversation-list__button",
    );

    await act(async () => buttons[1]?.click());
    expect(buttons[0]?.getAttribute("aria-current")).toBe("page");
    expect(buttons[1]?.hasAttribute("aria-current")).toBe(false);
    expect(onActiveChange).toHaveBeenCalledWith("two", conversations[1]);
  });

  it("reports non-collapsible agent details as expanded", async () => {
    const onExpandedStepIdsChange = vi.fn();
    const renderExpanded = vi.fn();
    const view = await render(
      <AgentSteps
        collapsible={false}
        steps={[{ id: "inspect", title: "Inspect", status: "complete" }]}
        onExpandedStepIdsChange={onExpandedStepIdsChange}
        renderDetail={(_step, context) => {
          renderExpanded(context.expanded);
          return <button onClick={context.toggle}>Detail</button>;
        }}
      />,
    );

    expect(renderExpanded).toHaveBeenCalledWith(true);
    expect(
      view.querySelector(".vl-agent-steps__item")?.getAttribute("data-expanded"),
    ).toBe("true");
    await act(async () => view.querySelector<HTMLButtonElement>("button")?.click());
    expect(onExpandedStepIdsChange).not.toHaveBeenCalled();
  });

  it("falls back to raw code when a highlighter throws synchronously", async () => {
    const highlighter = vi.fn(() => {
      throw new Error("Unavailable");
    });
    const view = await render(<CodeBlock code="const value = 1;" highlighter={highlighter} />);

    await act(async () => Promise.resolve());
    expect(view.querySelector("pre")?.textContent).toContain("const value = 1;");
    expect(view.querySelector("[role='status']")?.textContent).toContain(
      "Syntax highlighting unavailable: Unavailable",
    );
  });

  it("uses Formula renderError for invalid input by default", async () => {
    const renderError = vi.fn(() => <strong>Formula unavailable</strong>);
    const view = await render(
      <Formula formula="\\definitelynotacommand{" renderError={renderError} />,
    );

    expect(renderError).toHaveBeenCalledOnce();
    expect(view.textContent).toContain("Formula unavailable");
  });

  it("shows an explicitly requested user message timestamp", async () => {
    const message: AgentMessage = {
      id: "user-message",
      conversationId: "conversation",
      role: "user",
      content: "Hello",
      status: "complete",
      createdAt: 1,
      updatedAt: 1,
    };
    const view = await render(<MessageBubble message={message} showTimestamp />);
    const bubble = view.querySelector<HTMLElement>(".vl-message-bubble");
    expect(bubble?.getAttribute("data-show-header")).toBe("true");
    expect(bubble?.querySelector("time")).not.toBeNull();
  });

  it("does not evaluate a hidden MessageBubble timestamp formatter", async () => {
    const formatTimestamp = vi.fn(() => "Never rendered");
    const message: AgentMessage = {
      id: "assistant-message",
      conversationId: "conversation",
      role: "assistant",
      content: "Hello",
      status: "complete",
      createdAt: 1,
      updatedAt: 1,
    };
    await render(
      <MessageBubble message={message} formatTimestamp={formatTimestamp} />,
    );

    expect(formatTimestamp).not.toHaveBeenCalled();
  });

  it("removes collapsed reasoning content from focus navigation", async () => {
    const view = await render(
      <ReasoningPanel>
        <button type="button">Focusable detail</button>
      </ReasoningPanel>,
    );
    const reveal = view.querySelector<HTMLElement>(".vl-reasoning-panel__reveal");
    expect(reveal?.hasAttribute("inert")).toBe(true);
    expect(reveal?.getAttribute("aria-hidden")).toBe("true");

    await act(async () =>
      view.querySelector<HTMLButtonElement>(".vl-reasoning-panel__trigger")?.click(),
    );
    expect(reveal?.hasAttribute("inert")).toBe(false);
    expect(reveal?.hasAttribute("aria-hidden")).toBe(false);
  });

  it("marks non-collapsible reasoning as open", async () => {
    const view = await render(
      <ReasoningPanel collapsible={false}>Always visible</ReasoningPanel>,
    );
    const panel = view.querySelector<HTMLElement>(".vl-reasoning-panel");
    const reveal = view.querySelector<HTMLElement>(".vl-reasoning-panel__reveal");

    expect(panel?.getAttribute("data-open")).toBe("true");
    expect(reveal?.getAttribute("data-open")).toBe("true");
    expect(reveal?.hasAttribute("inert")).toBe(false);
  });

  it("lets the native style prop intentionally override a semantic root slot", async () => {
    const view = await render(
      <AgentShell style={{ color: "red" }} styles={{ root: { color: "blue" } }}>
        Content
      </AgentShell>,
    );
    expect(view.querySelector<HTMLElement>(".vl-agent-shell")?.style.color).toBe("red");
  });

  it("preserves unchanged message rows across a streaming update", async () => {
    const first: AgentMessage = {
      id: "first",
      conversationId: "conversation",
      role: "user",
      content: "Question",
      status: "complete",
      createdAt: 1,
      updatedAt: 1,
    };
    const second: AgentMessage = {
      id: "second",
      conversationId: "conversation",
      role: "assistant",
      content: "Par",
      status: "streaming",
      createdAt: 2,
      updatedAt: 2,
    };
    const renderMessage = vi.fn((message: AgentMessage) => <span>{message.content}</span>);
    await render(
      <MessageList
        autoScroll={false}
        messages={[first, second]}
        renderMessage={renderMessage}
      />,
    );
    expect(renderMessage).toHaveBeenCalledTimes(2);

    await act(async () =>
      root?.render(
        <MessageList
          autoScroll={false}
          messages={[first, { ...second, content: "Partial", updatedAt: 3 }]}
          renderMessage={renderMessage}
        />,
      ),
    );
    expect(renderMessage).toHaveBeenCalledTimes(3);
  });
});
