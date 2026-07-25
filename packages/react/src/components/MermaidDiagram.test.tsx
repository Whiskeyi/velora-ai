// @vitest-environment jsdom

import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mermaidMocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}));

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidMocks.initialize,
    render: mermaidMocks.render,
  },
}));

import { MermaidDiagram } from "./MermaidDiagram";

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

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    if (predicate()) return;
  }
  throw new Error("Timed out waiting for Mermaid state");
}

beforeEach(() => {
  mermaidMocks.initialize.mockReset();
  mermaidMocks.render.mockReset();
});

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("MermaidDiagram safety and recovery", () => {
  it("locks security-sensitive Mermaid options", async () => {
    mermaidMocks.render.mockResolvedValue({ svg: "<svg><text>Safe</text></svg>" });
    const attemptedOverride = {
      theme: "dark",
      securityLevel: "loose",
      startOnLoad: true,
      suppressErrorRendering: false,
    } as unknown as ComponentProps<typeof MermaidDiagram>["config"];
    const view = await render(
      <MermaidDiagram chart="flowchart LR\nA --> B" config={attemptedOverride} />,
    );

    await waitFor(() => view.querySelector(".vl-mermaid__canvas") != null);
    expect(mermaidMocks.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: "dark",
        securityLevel: "strict",
        startOnLoad: false,
        suppressErrorRendering: true,
      }),
    );
    expect(view.querySelector(".vl-mermaid")?.getAttribute("data-state")).toBe(
      "ready",
    );
  });

  it("retries a rejected render and replaces the error with a diagram", async () => {
    mermaidMocks.render
      .mockRejectedValueOnce(new Error("Parser unavailable"))
      .mockResolvedValueOnce({ svg: "<svg><text>Recovered</text></svg>" });
    const view = await render(
      <MermaidDiagram
        chart="flowchart LR\nRetry --> Ready"
        renderError={(error, retry) => (
          <button type="button" onClick={retry}>
            Retry: {error.message}
          </button>
        )}
      />,
    );

    await waitFor(() => view.querySelector(".vl-mermaid__error button") != null);
    await act(async () =>
      view.querySelector<HTMLButtonElement>(".vl-mermaid__error button")?.click(),
    );
    await waitFor(() => view.querySelector(".vl-mermaid__canvas") != null);

    expect(mermaidMocks.render).toHaveBeenCalledTimes(2);
    expect(view.textContent).toContain("Recovered");
    expect(view.querySelector(".vl-mermaid")?.getAttribute("data-state")).toBe(
      "ready",
    );
  });

  it("offers bounded zoom controls and source-copy feedback", async () => {
    mermaidMocks.render.mockResolvedValue({ svg: "<svg><text>Interactive</text></svg>" });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onZoomChange = vi.fn();
    const onCopySource = vi.fn();
    const view = await render(
      <MermaidDiagram
        chart={"flowchart LR\nA --> B"}
        defaultZoom={1}
        minZoom={0.8}
        maxZoom={1.2}
        zoomStep={0.2}
        showCopySource
        onZoomChange={onZoomChange}
        onCopySource={onCopySource}
      />,
    );

    await waitFor(() => view.querySelector(".vl-mermaid__controls") != null);
    const zoomIn = view.querySelector<HTMLButtonElement>("[aria-label='Zoom in']");
    await act(async () => zoomIn?.click());
    expect(onZoomChange).toHaveBeenLastCalledWith(1.2);
    expect(zoomIn?.disabled).toBe(true);

    await act(async () =>
      view.querySelector<HTMLButtonElement>("[aria-label='Copy diagram source']")?.click(),
    );
    expect(writeText).toHaveBeenCalledWith("flowchart LR\nA --> B");
    expect(onCopySource).toHaveBeenCalledWith("flowchart LR\nA --> B", true);
    expect(view.textContent).toContain("Copied");
  });
});
