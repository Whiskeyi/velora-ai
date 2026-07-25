// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentShell } from "./AgentShell";
import { CodeBlock } from "./CodeBlock";
import { Formula } from "./Formula";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { StreamingIndicator } from "./StreamingIndicator";

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

describe("advanced component interaction contracts", () => {
  it("keeps responsive AgentShell panels reachable and mutually exclusive", async () => {
    const view = await render(
      <AgentShell
        header={<strong>Workspace</strong>}
        sidebar={<button type="button">Conversation</button>}
        inspector={<button type="button">Inspector detail</button>}
        overlay={<button type="button">Overlay action</button>}
      >
        Content
      </AgentShell>,
    );
    const shell = view.querySelector<HTMLElement>(".vl-agent-shell");
    const sidebar = view.querySelector<HTMLElement>(".vl-agent-shell__sidebar");
    const workspace = view.querySelector<HTMLElement>(".vl-agent-shell__workspace");
    const overlay = view.querySelector<HTMLElement>(".vl-agent-shell__overlay");
    const openSidebar = view.querySelector<HTMLButtonElement>(
      "[aria-label='Open conversations']",
    );

    expect(shell?.getAttribute("data-mobile-sidebar-open")).toBe("false");
    expect(openSidebar?.getAttribute("aria-controls")).toBe(sidebar?.id);

    await act(async () => openSidebar?.click());
    expect(shell?.getAttribute("data-mobile-sidebar-open")).toBe("true");
    expect(sidebar?.getAttribute("data-open")).toBe("true");
    expect(sidebar?.getAttribute("role")).toBe("dialog");
    expect(sidebar?.getAttribute("aria-modal")).toBe("true");
    expect(workspace?.hasAttribute("inert")).toBe(true);
    expect(overlay?.hasAttribute("inert")).toBe(true);
    expect(document.activeElement?.textContent).toBe("Conversation");

    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
      );
    });
    expect(document.activeElement?.textContent).toBe("Conversation");

    const backdrop = view.querySelector<HTMLButtonElement>(
      ".vl-agent-shell__backdrop",
    );
    await act(async () => {
      backdrop?.click();
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(openSidebar);

    const openInspector = view.querySelector<HTMLButtonElement>(
      "[aria-label='Open inspector']",
    );
    await act(async () => openInspector?.click());
    expect(shell?.getAttribute("data-mobile-sidebar-open")).toBe("false");
    expect(shell?.getAttribute("data-mobile-inspector-open")).toBe("true");
    expect(document.activeElement?.textContent).toBe("Inspector detail");

    view.querySelector<HTMLButtonElement>(".vl-agent-shell__inspector button")?.focus();
    await act(async () => {
      shell?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
    expect(shell?.getAttribute("data-mobile-inspector-open")).toBe("false");
    expect(document.activeElement).toBe(openInspector);

    await act(async () => openInspector?.click());

    expect(backdrop?.getAttribute("aria-hidden")).toBeNull();
    await act(async () => backdrop?.click());
    expect(shell?.getAttribute("data-mobile-inspector-open")).toBe("false");
    expect(backdrop?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps interactive overlay children actionable", async () => {
    const onClick = vi.fn();
    const view = await render(
      <AgentShell overlay={<button onClick={onClick}>Confirm</button>}>
        Content
      </AgentShell>,
    );

    await act(async () => view.querySelector<HTMLButtonElement>("button")?.click());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("reconciles modal behavior when an AgentShell crosses container breakpoints", async () => {
    let resize: ResizeObserverCallback | undefined;
    const OriginalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;

    try {
      const view = await render(
        <AgentShell
          defaultMobileSidebarOpen
          header="Workspace"
          sidebar={<button type="button">Conversation</button>}
        >
          Content
        </AgentShell>,
      );
      const shell = view.querySelector<HTMLElement>(".vl-agent-shell");
      const workspace = view.querySelector<HTMLElement>(".vl-agent-shell__workspace");
      const backdrop = view.querySelector<HTMLElement>(".vl-agent-shell__backdrop");

      await act(async () => {
        resize?.(
          [{ contentRect: { width: 620 } } as ResizeObserverEntry],
          {} as ResizeObserver,
        );
      });
      expect(shell?.getAttribute("data-sidebar-mode")).toBe("drawer");
      expect(backdrop?.getAttribute("data-open")).toBe("true");
      expect(workspace?.hasAttribute("inert")).toBe(true);

      await act(async () => {
        resize?.(
          [{ contentRect: { width: 800 } } as ResizeObserverEntry],
          {} as ResizeObserver,
        );
      });
      expect(shell?.getAttribute("data-sidebar-mode")).toBe("inline");
      expect(shell?.getAttribute("data-mobile-sidebar-open")).toBe("true");
      expect(backdrop?.getAttribute("data-open")).toBe("false");
      expect(workspace?.hasAttribute("inert")).toBe(false);

      await act(async () => {
        shell?.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        );
      });
      expect(shell?.getAttribute("data-mobile-sidebar-open")).toBe("true");
    } finally {
      globalThis.ResizeObserver = OriginalResizeObserver;
    }
  });

  it("does not create a modal for absent AgentShell panels", async () => {
    const view = await render(
      <AgentShell defaultMobileSidebarOpen header="Workspace">
        Content
      </AgentShell>,
    );
    const workspace = view.querySelector<HTMLElement>(".vl-agent-shell__workspace");
    const backdrop = view.querySelector<HTMLElement>(".vl-agent-shell__backdrop");

    expect(workspace?.hasAttribute("inert")).toBe(false);
    expect(backdrop).toBeNull();
  });

  it("renders every fenced code block through CodeBlock", async () => {
    const view = await render(
      <MarkdownRenderer content={"```\nsingle line\n```\n\nUse `inline code` here."} />,
    );

    expect(view.querySelectorAll(".vl-code-block")).toHaveLength(1);
    expect(view.querySelector(".vl-code-block pre")?.textContent).toContain(
      "single line",
    );
    expect(view.querySelector("p > code")?.textContent).toBe("inline code");
  });

  it("preserves language metadata for fenced code blocks", async () => {
    const view = await render(
      <MarkdownRenderer content={"```tsx\nconst ready = true;\n```"} />,
    );

    expect(view.querySelector(".vl-code-block")?.getAttribute("data-language")).toBe(
      "tsx",
    );
  });

  it("preserves punctuation in fenced code language identifiers", async () => {
    const languages: Array<string | undefined> = [];
    await render(
      <MarkdownRenderer
        content={"```c++\nint main() {}\n```"}
        codeHighlighter={(_code, language) => {
          languages.push(language);
          return "highlighted";
        }}
      />,
    );

    await act(async () => Promise.resolve());
    expect(languages).toEqual(["c++"]);
  });

  it("supports code wrapping, collapsing, retrying highlights, and downloading", async () => {
    const highlighter = vi
      .fn()
      .mockRejectedValueOnce(new Error("Worker unavailable"))
      .mockResolvedValueOnce(<span>highlighted code</span>);
    const onDownload = vi.fn();
    const createObjectURL = vi.fn(() => "blob:code");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const code = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`).join("\n");
    const view = await render(
      <CodeBlock
        code={code}
        language="ts"
        highlighter={highlighter}
        showWrapToggle
        collapsible
        collapseAfterLines={5}
        showDownload
        onDownload={onDownload}
      />,
    );

    await act(async () => Promise.resolve());
    await act(async () => Promise.resolve());
    expect(view.querySelector(".vl-code-block")?.getAttribute("data-collapsed")).toBe("true");
    await act(async () => view.querySelector<HTMLButtonElement>("[aria-pressed='false']")?.click());
    expect(view.querySelector(".vl-code-block")?.getAttribute("data-wrap")).toBe("true");
    await act(async () =>
      view.querySelector<HTMLButtonElement>(".vl-code-block__expand")?.click(),
    );
    expect(view.querySelector(".vl-code-block")?.getAttribute("data-collapsed")).toBe("false");
    await act(async () =>
      Array.from(view.querySelectorAll<HTMLButtonElement>(".vl-code-block__action"))
        .find((button) => button.textContent === "Retry highlighting")
        ?.click(),
    );
    await act(async () => Promise.resolve());
    expect(view.textContent).toContain("highlighted code");
    await act(async () =>
      Array.from(view.querySelectorAll<HTMLButtonElement>(".vl-code-block__action"))
        .find((button) => button.textContent === "Download code")
        ?.click(),
    );
    expect(onDownload).toHaveBeenCalledWith(code, "snippet.ts");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:code");
    click.mockRestore();
  });

  it("keeps unfinished Mermaid source stable while Markdown is streaming", async () => {
    const view = await render(
      <MarkdownRenderer
        content={"```mermaid\nflowchart LR\nA -->"}
        streaming
        streamingMode="immediate"
      />,
    );

    expect(view.querySelector(".vl-mermaid")).toBeNull();
    expect(view.querySelector(".vl-code-block")?.getAttribute("data-language")).toBe("text");
    expect(view.querySelector("[role='status']")?.textContent).toContain(
      "Response is streaming",
    );
  });

  it("copies Formula source and exposes determinate streaming progress", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onCopy = vi.fn();
    const view = await render(
      <div>
        <Formula formula="E = mc^2" displayMode align="center" showCopy onCopy={onCopy} />
        <StreamingIndicator label="Uploading context" progress={42} visibleLabel />
      </div>,
    );

    await act(async () => view.querySelector<HTMLButtonElement>(".vl-formula__copy")?.click());
    expect(writeText).toHaveBeenCalledWith("E = mc^2");
    expect(onCopy).toHaveBeenCalledWith("E = mc^2", true);
    expect(view.querySelector(".vl-formula")?.getAttribute("data-align")).toBe("center");
    const progress = view.querySelector<HTMLElement>("[role='progressbar']");
    expect(progress?.getAttribute("aria-valuenow")).toBe("42");
    expect(progress?.getAttribute("aria-label")).toBe("Uploading context");
    expect(progress?.textContent).toContain("42%");
  });

  it("removes live status semantics when inactive and ignores non-finite progress", async () => {
    const view = await render(
      <StreamingIndicator label="Paused" progress={Number.NaN} active={false} />,
    );
    const indicator = view.querySelector<HTMLElement>(".vl-streaming-indicator");
    expect(indicator?.hasAttribute("role")).toBe(false);
    expect(indicator?.hasAttribute("aria-live")).toBe(false);
    expect(indicator?.hasAttribute("aria-valuenow")).toBe(false);
  });

  it("stops determinate motion when progress reaches completion", async () => {
    const view = await render(
      <StreamingIndicator label="Complete" progress={100} visibleLabel />,
    );
    const indicator = view.querySelector<HTMLElement>(".vl-streaming-indicator");
    expect(indicator?.getAttribute("data-active")).toBe("false");
    expect(indicator?.getAttribute("role")).toBe("progressbar");
    expect(indicator?.getAttribute("aria-valuenow")).toBe("100");
  });
});
