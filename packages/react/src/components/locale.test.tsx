// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { PromptComposer } from "./PromptComposer";
import { StreamingIndicator } from "./StreamingIndicator";
import { VeloraProvider } from "./VeloraProvider";
import { enUS, mergeVeloraMessages } from "./locale";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("VeloraProvider locale", () => {
  it("deep-merges nested message overrides", () => {
    const messages = mergeVeloraMessages(enUS, {
      messageActions: { pending: { copy: "Copying securely" } },
    });

    expect(messages.messageActions.pending.copy).toBe("Copying securely");
    expect(messages.messageActions.pending.regenerate).toBe("Requesting a new response");
  });

  it("provides Chinese defaults to interactive descendants", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <VeloraProvider locale="zh-CN">
          <PromptComposer onSubmit={vi.fn()} />
          <StreamingIndicator visibleLabel />
        </VeloraProvider>,
      );
    });

    expect(container.querySelector("textarea")?.placeholder).toBe(
      "输入问题、粘贴图片或添加上下文…",
    );
    expect(container.querySelector("button[type='submit']")?.getAttribute("aria-label")).toBe(
      "发送消息",
    );
    expect(container.textContent).toContain("正在生成回复");
    expect(container.firstElementChild?.getAttribute("lang")).toBe("zh-CN");
    expect(container.firstElementChild?.getAttribute("data-vl-locale")).toBe("zh-CN");

    await act(async () => root.unmount());
    container.remove();
  });
});
