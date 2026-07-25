// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentMessage } from "../runtime";
import { MessageActions } from "./MessageActions";
import { MessageBranchNavigator } from "./MessageBranchNavigator";
import { MessageBubble } from "./MessageBubble";
import { MessageList, type MessageListRenderContext } from "./MessageList";
import { VeloraProvider } from "./VeloraProvider";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function message(
  id: string,
  role: AgentMessage["role"] = "assistant",
  patch: Partial<AgentMessage> = {},
): AgentMessage {
  return {
    id,
    conversationId: "conversation",
    role,
    content: `Message ${id}`,
    status: "complete",
    createdAt: Number(id.replace(/\D/g, "")) || 1,
    updatedAt: Number(id.replace(/\D/g, "")) || 1,
    ...patch,
  };
}

async function render(node: ReactNode): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(node));
  return container;
}

async function rerender(node: ReactNode): Promise<void> {
  await act(async () => root?.render(node));
}

function deferred<T = void>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, "clipboard");
  }
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MessageActions", () => {
  it("copies content and reports clipboard failure without claiming success", async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Permission denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onCopy = vi.fn();
    const onActionError = vi.fn();
    const item = message("1", "assistant", { content: "Copy this" });
    const view = await render(
      <MessageActions
        message={item}
        showFeedback={false}
        onCopy={onCopy}
        onActionError={onActionError}
      />,
    );
    const copy = view.querySelector<HTMLButtonElement>("[data-action='copy']");

    await act(async () => {
      copy?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith("Copy this");
    expect(onCopy).toHaveBeenLastCalledWith(item, true);
    expect(view.querySelector("[role='status']")?.textContent).toBe("Message copied");

    await act(async () => {
      copy?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onCopy).toHaveBeenLastCalledWith(item, false);
    expect(view.querySelector("[role='alert']")?.textContent).toContain("Permission denied");
    expect(onActionError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ action: "copy", message: item }),
    );
  });

  it("locks every action during async work and exposes pending and rejected state", async () => {
    let rejectRegeneration: (error: Error) => void = () => undefined;
    const pending = new Promise<void>((_, reject) => {
      rejectRegeneration = reject;
    });
    const onRegenerate = vi.fn(() => pending);
    const view = await render(
      <MessageActions
        message={message("1")}
        showCopy={false}
        showFeedback
        onRegenerate={onRegenerate}
      />,
    );
    const regenerate = view.querySelector<HTMLButtonElement>("[data-action='regenerate']");

    await act(async () => {
      regenerate?.click();
      regenerate?.click();
      await Promise.resolve();
    });
    expect(onRegenerate).toHaveBeenCalledOnce();
    expect(view.querySelector("[role='toolbar']")?.getAttribute("aria-busy")).toBe("true");
    expect(regenerate?.getAttribute("aria-busy")).toBe("true");
    expect(
      [...view.querySelectorAll<HTMLButtonElement>("button")].every((button) => button.disabled),
    ).toBe(true);

    await act(async () => {
      rejectRegeneration(new Error("Transport offline"));
      await pending.catch(() => undefined);
    });
    expect(view.querySelector("[role='toolbar']")?.hasAttribute("aria-busy")).toBe(false);
    expect(view.querySelector("[role='alert']")?.textContent).toContain("Transport offline");
  });

  it("does not let an earlier success timer clear a later pending action", async () => {
    vi.useFakeTimers();
    const editing = deferred();
    const view = await render(
      <MessageActions
        message={message("1")}
        showCopy={false}
        showFeedback={false}
        onRegenerate={() => undefined}
        onEdit={() => editing.promise}
      />,
    );

    await act(async () => {
      view.querySelector<HTMLButtonElement>("[data-action='regenerate']")?.click();
      await Promise.resolve();
    });
    expect(view.querySelector("[role='status']")?.textContent).toBe(
      "New response requested",
    );

    await act(async () => vi.advanceTimersByTime(1_000));
    await act(async () => {
      view.querySelector<HTMLButtonElement>("[data-action='edit']")?.click();
      await Promise.resolve();
    });
    await act(async () => vi.advanceTimersByTime(1_000));
    expect(view.querySelector("[role='status']")?.textContent).toBe(
      "Opening message editor",
    );

    await act(async () => editing.resolve());
  });

  it("supports optimistic uncontrolled feedback with rollback and controlled feedback", async () => {
    const saveFeedback = vi
      .fn<(feedback: "like" | "dislike" | null) => Promise<void>>()
      .mockRejectedValueOnce(new Error("Save failed"))
      .mockResolvedValue(undefined);
    const item = message("1");
    const view = await render(
      <MessageActions
        message={item}
        showCopy={false}
        onFeedbackChange={(feedback) => saveFeedback(feedback)}
      />,
    );
    const like = view.querySelector<HTMLButtonElement>("[data-action='like']");

    await act(async () => {
      like?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(saveFeedback).toHaveBeenCalledWith("like");
    expect(like?.getAttribute("aria-pressed")).toBe("false");
    expect(view.querySelector("[role='alert']")?.textContent).toContain("Save failed");

    await rerender(
      <MessageActions
        message={item}
        showCopy={false}
        feedback="dislike"
        onFeedbackChange={(feedback) => saveFeedback(feedback)}
      />,
    );
    const dislike = view.querySelector<HTMLButtonElement>("[data-action='dislike']");
    await act(async () => {
      dislike?.click();
      await Promise.resolve();
    });
    expect(saveFeedback).toHaveBeenLastCalledWith(null);
    expect(dislike?.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("MessageBranchNavigator", () => {
  it("normalizes invalid indexes and removes inactive groups from the tab order", async () => {
    const view = await render(
      <MessageBranchNavigator count={3} defaultIndex={Number.NaN} disabled />,
    );
    const navigator = view.querySelector<HTMLElement>("[role='group']");
    expect(navigator?.tabIndex).toBe(-1);
    expect(view.querySelector("[role='status']")?.textContent).toBe("1 / 3");

    const arrow = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => navigator?.dispatchEvent(arrow));
    expect(arrow.defaultPrevented).toBe(false);

    await rerender(<MessageBranchNavigator count={0} />);
    expect(view.querySelector<HTMLElement>("[role='group']")?.tabIndex).toBe(-1);
  });

  it("navigates with buttons and keyboard while enforcing branch boundaries", async () => {
    const onIndexChange = vi.fn();
    const view = await render(
      <MessageBranchNavigator count={3} defaultIndex={1} onIndexChange={onIndexChange} />,
    );
    const navigator = view.querySelector<HTMLElement>("[role='group']");
    const previous = view.querySelector<HTMLButtonElement>("[data-action='previous']");
    const next = view.querySelector<HTMLButtonElement>("[data-action='next']");
    expect(view.querySelector("[role='status']")?.textContent).toBe("2 / 3");

    await act(async () => next?.click());
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    expect(next?.disabled).toBe(true);

    await act(async () => {
      navigator?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }),
      );
    });
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
    expect(previous?.disabled).toBe(true);

    await act(async () => {
      navigator?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
    expect(view.querySelector("[role='status']")?.textContent).toBe("2 / 3");
  });

  it("keeps a controlled branch stable until its index prop changes", async () => {
    const onIndexChange = vi.fn();
    const view = await render(
      <MessageBranchNavigator count={2} index={0} onIndexChange={onIndexChange} />,
    );
    await act(async () => view.querySelector<HTMLButtonElement>("[data-action='next']")?.click());
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(view.querySelector("[role='status']")?.textContent).toBe("1 / 2");
  });

  it("maps horizontal keyboard navigation to the reading direction", async () => {
    const onIndexChange = vi.fn();
    const view = await render(
      <VeloraProvider direction="rtl">
        <MessageBranchNavigator
          count={3}
          defaultIndex={1}
          onIndexChange={onIndexChange}
        />
      </VeloraProvider>,
    );
    const navigator = view.querySelector<HTMLElement>("[role='group']");
    expect(navigator?.getAttribute("data-direction")).toBe("rtl");

    await act(async () => {
      navigator?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowLeft",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(onIndexChange).toHaveBeenLastCalledWith(2);

    await act(async () => {
      navigator?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
  });
});

describe("MessageBubble interaction slots", () => {
  it("renders attachment, branch, action, and footer slots from message context", async () => {
    const item = message("1", "assistant", { status: "streaming" });
    const actions = vi.fn((received: AgentMessage, context: { streaming: boolean }) => (
      <button type="button">{context.streaming ? "Stop" : received.id}</button>
    ));
    const view = await render(
      <MessageBubble
        message={item}
        attachments={(received) => <span>Attachment for {received.id}</span>}
        branchNavigator={(_received, context) => (
          <span>{context.terminal ? "Final" : "Draft branch"}</span>
        )}
        actions={actions}
        footer={(received) => <span>Footer {received.role}</span>}
      />,
    );

    expect(view.querySelector("[data-slot='attachments']")?.textContent).toBe("Attachment for 1");
    expect(view.querySelector("[data-slot='branch-navigator']")?.textContent).toBe("Draft branch");
    expect(view.querySelector("[data-slot='actions']")?.textContent).toBe("Stop");
    expect(view.querySelector("[data-slot='footer']")?.textContent).toBe("Footer assistant");
    expect(actions).toHaveBeenCalledWith(
      item,
      expect.objectContaining({ message: item, streaming: true, terminal: false }),
    );
  });
});

describe("MessageList streaming behavior", () => {
  it("keeps empty content at the reading start unless centering is explicit", async () => {
    const view = await render(<MessageList messages={[]} />);
    expect(
      view.querySelector(".vl-message-list")?.getAttribute("data-empty-placement"),
    ).toBe("start");

    await rerender(<MessageList messages={[]} emptyPlacement="center" />);
    expect(
      view.querySelector(".vl-message-list")?.getAttribute("data-empty-placement"),
    ).toBe("center");
  });

  it("resets follow, activity, and scroll state when the conversation changes", async () => {
    const first = message("launch-1", "user");
    const partial = message("launch-2", "assistant", {
      status: "streaming",
      updatedAt: 2,
    });
    const onFollowChange = vi.fn();
    const view = await render(
      <MessageList
        conversationKey="launch"
        messages={[first, partial]}
        onFollowChange={onFollowChange}
      />,
    );
    const list = view.querySelector<HTMLDivElement>("[role='log']");
    Object.defineProperties(list as HTMLDivElement, {
      scrollHeight: { configurable: true, get: () => 500 },
      clientHeight: { configurable: true, get: () => 100 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });

    await act(async () => list?.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect(list?.dataset.following).toBe("false");

    await rerender(
      <MessageList
        conversationKey="launch"
        messages={[first, { ...partial, content: "More", updatedAt: 3 }]}
        onFollowChange={onFollowChange}
      />,
    );
    expect(list?.dataset.newActivityCount).toBe("1");

    await rerender(
      <MessageList
        conversationKey="research"
        messages={[message("research-1", "assistant")]}
        onFollowChange={onFollowChange}
      />,
    );

    expect(list?.dataset.following).toBe("true");
    expect(list?.dataset.newActivityCount).toBe("0");
    expect(list?.scrollTop).toBe(500);
    expect(view.querySelector(".vl-message-list__jump")).toBeNull();
    expect(view.querySelector("[data-slot='live-region']")?.textContent).toBe("");
    expect(onFollowChange).toHaveBeenLastCalledWith(true);
  });

  it("contains rejected history loads, prevents overlap, and rearms retry", async () => {
    const failure = new Error("History unavailable");
    const onReachStart = vi.fn().mockRejectedValue(failure);
    const onReachStartError = vi.fn();
    const view = await render(
      <MessageList
        autoScroll={false}
        messages={[message("1"), message("2")]}
        onReachStart={onReachStart}
        onReachStartError={onReachStartError}
      />,
    );
    const list = view.querySelector<HTMLDivElement>("[role='log']");
    Object.defineProperties(list as HTMLDivElement, {
      scrollHeight: { configurable: true, get: () => 500 },
      clientHeight: { configurable: true, get: () => 100 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    });

    await act(async () => {
      list?.dispatchEvent(new Event("scroll", { bubbles: true }));
      list?.dispatchEvent(new Event("scroll", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onReachStart).toHaveBeenCalledOnce();
    expect(onReachStartError).toHaveBeenCalledWith(failure, list);

    await act(async () => {
      list?.dispatchEvent(new Event("scroll", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onReachStart).toHaveBeenCalledTimes(2);
    expect(onReachStartError).toHaveBeenCalledTimes(2);
  });

  it("keeps keyboard focus on the log until a jump actually reaches the bottom", async () => {
    const view = await render(
      <MessageList autoScroll={false} messages={[message("1"), message("2")]} />,
    );
    const list = view.querySelector<HTMLDivElement>("[role='log']");
    Object.defineProperties(list as HTMLDivElement, {
      scrollHeight: { configurable: true, get: () => 500 },
      clientHeight: { configurable: true, get: () => 100 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });

    await act(async () => list?.dispatchEvent(new Event("scroll", { bubbles: true })));
    const jump = view.querySelector<HTMLButtonElement>(".vl-message-list__jump");
    expect(list?.tabIndex).toBe(0);
    jump?.focus();

    await act(async () => jump?.click());
    expect(document.activeElement).toBe(list);
    expect(view.querySelector(".vl-message-list__jump")).not.toBeNull();

    if (list) list.scrollTop = 400;
    await act(async () => list?.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect(document.activeElement).toBe(list);
    expect(view.querySelector(".vl-message-list__jump")).toBeNull();
  });

  it("preserves the visible row when prepended rich content grows later", async () => {
    let resize: ResizeObserverCallback = () => undefined;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const second = message("2");
    const third = message("3");
    const view = await render(
      <MessageList autoScroll={false} messages={[second, third]} />,
    );
    const list = view.querySelector<HTMLDivElement>("[role='log']");
    const anchoredRow = view.querySelector<HTMLElement>(".vl-message-list__item");
    let scrollHeight = 300;
    let anchorContentTop = 90;
    Object.defineProperties(list as HTMLDivElement, {
      scrollHeight: { configurable: true, get: () => scrollHeight },
      clientHeight: { configurable: true, get: () => 100 },
      scrollTop: { configurable: true, writable: true, value: 80 },
      getBoundingClientRect: {
        configurable: true,
        value: () => ({
          top: 0,
          bottom: 100,
          left: 0,
          right: 100,
          width: 100,
          height: 100,
          x: 0,
          y: 0,
          toJSON() {},
        }),
      },
    });
    Object.defineProperty(anchoredRow as HTMLElement, "getBoundingClientRect", {
      configurable: true,
      value: () => {
        const top = anchorContentTop - (list?.scrollTop ?? 0);
        return {
          top,
          bottom: top + 100,
          left: 0,
          right: 100,
          width: 100,
          height: 100,
          x: 0,
          y: top,
          toJSON() {},
        };
      },
    });

    await act(async () => list?.dispatchEvent(new Event("scroll", { bubbles: true })));
    scrollHeight = 500;
    anchorContentTop = 290;
    await rerender(
      <MessageList
        autoScroll={false}
        messages={[message("0"), message("1"), second, third]}
      />,
    );
    expect(list?.scrollTop).toBe(280);

    scrollHeight = 550;
    anchorContentTop = 340;
    await act(async () => resize([], {} as ResizeObserver));
    expect(list?.scrollTop).toBe(330);
  });

  it("provides grouping, latest, and following context without replaying token deltas", async () => {
    const first = message("1", "assistant");
    const second = message("2", "assistant");
    const third = message("3", "assistant", { status: "streaming" });
    const fourth = message("4", "user");
    const contexts: MessageListRenderContext[] = [];
    const renderMessage = (_item: AgentMessage, context: MessageListRenderContext) => {
      contexts[context.index] = context;
      return <span>{context.index}</span>;
    };
    const view = await render(
      <MessageList
        autoScroll={false}
        messages={[first, second, third, fourth]}
        renderMessage={renderMessage}
      />,
    );
    expect(contexts.map((context) => context.groupPosition)).toEqual([
      "first",
      "middle",
      "last",
      "single",
    ]);
    expect(contexts.map((context) => context.isLatest)).toEqual([false, false, false, true]);
    expect(view.querySelector("[role='log']")?.getAttribute("aria-live")).toBe("off");
    expect(view.querySelector("[data-slot='live-region']")?.textContent).toBe("");

    await rerender(
      <MessageList
        autoScroll={false}
        messages={[first, second, { ...third, content: "One more token", updatedAt: 5 }, fourth]}
        renderMessage={renderMessage}
      />,
    );
    expect(view.querySelector("[data-slot='live-region']")?.textContent).toBe("");
  });

  it("counts unique unseen activity, announces completion once, and clears at bottom", async () => {
    const first = message("1", "user");
    const partial = message("2", "assistant", {
      content: "Part",
      status: "streaming",
      updatedAt: 2,
    });
    const onNewActivityCountChange = vi.fn();
    const view = await render(
      <MessageList
        autoScroll={false}
        messages={[first, partial]}
        onNewActivityCountChange={onNewActivityCountChange}
      />,
    );
    const list = view.querySelector<HTMLDivElement>("[role='log']");
    let scrollHeight = 500;
    Object.defineProperties(list as HTMLDivElement, {
      scrollHeight: { configurable: true, get: () => scrollHeight },
      clientHeight: { configurable: true, get: () => 100 },
      scrollTop: { configurable: true, writable: true, value: 100 },
    });

    await act(async () => list?.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect(list?.dataset.following).toBe("false");

    const morePartial = { ...partial, content: "Partial response", updatedAt: 3 };
    await rerender(
      <MessageList
        autoScroll={false}
        messages={[first, morePartial]}
        onNewActivityCountChange={onNewActivityCountChange}
      />,
    );
    expect(list?.dataset.newActivityCount).toBe("1");
    expect(view.querySelector(".vl-message-list__jump")?.textContent).toContain("1 new update");

    await rerender(
      <MessageList
        autoScroll={false}
        messages={[first, { ...morePartial, content: "More tokens", updatedAt: 4 }]}
        onNewActivityCountChange={onNewActivityCountChange}
      />,
    );
    expect(list?.dataset.newActivityCount).toBe("1");

    await rerender(
      <MessageList
        autoScroll={false}
        messages={[first, { ...morePartial, content: "Done", status: "complete", updatedAt: 5 }]}
        onNewActivityCountChange={onNewActivityCountChange}
      />,
    );
    expect(view.querySelector("[data-slot='live-region']")?.textContent).toBe(
      "Assistant response complete",
    );
    expect(list?.dataset.newActivityCount).toBe("1");

    if (list) list.scrollTop = scrollHeight - 100;
    await act(async () => list?.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect(list?.dataset.following).toBe("true");
    expect(list?.dataset.newActivityCount).toBe("0");
    expect(view.querySelector(".vl-message-list__jump")).toBeNull();
    expect(onNewActivityCountChange).toHaveBeenLastCalledWith(0);
    scrollHeight = 500;
  });

  it("preserves the viewport when history is prepended and gates onReachStart", async () => {
    const second = message("2");
    const third = message("3");
    const onReachStart = vi.fn();
    const view = await render(
      <MessageList
        autoScroll={false}
        messages={[second, third]}
        reachStartThreshold={20}
        onReachStart={onReachStart}
      />,
    );
    const list = view.querySelector<HTMLDivElement>("[role='log']");
    let scrollHeight = 300;
    Object.defineProperties(list as HTMLDivElement, {
      scrollHeight: { configurable: true, get: () => scrollHeight },
      clientHeight: { configurable: true, get: () => 100 },
      scrollTop: { configurable: true, writable: true, value: 80 },
    });
    await act(async () => list?.dispatchEvent(new Event("scroll", { bubbles: true })));

    scrollHeight = 500;
    await rerender(
      <MessageList
        autoScroll={false}
        messages={[message("0"), message("1"), second, third]}
        reachStartThreshold={20}
        onReachStart={onReachStart}
      />,
    );
    expect(list?.scrollTop).toBe(280);
    expect(list?.dataset.newActivityCount).toBe("0");

    if (list) list.scrollTop = 10;
    await act(async () => list?.dispatchEvent(new Event("scroll", { bubbles: true })));
    await act(async () => list?.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect(onReachStart).toHaveBeenCalledOnce();

    if (list) list.scrollTop = 30;
    await act(async () => list?.dispatchEvent(new Event("scroll", { bubbles: true })));
    if (list) list.scrollTop = 5;
    await act(async () => list?.dispatchEvent(new Event("scroll", { bubbles: true })));
    expect(onReachStart).toHaveBeenCalledTimes(2);
    expect(onReachStart).toHaveBeenLastCalledWith(list);
  });
});
