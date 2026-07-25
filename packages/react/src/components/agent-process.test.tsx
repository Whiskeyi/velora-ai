// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentStep } from "../runtime";
import { AgentSteps } from "./AgentSteps";
import { ReasoningPanel } from "./ReasoningPanel";
import { ToolCallCard } from "./ToolCallCard";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

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
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function extendedStep(
  status: "waiting" | "cancelled",
  overrides: Partial<AgentStep> = {},
): AgentStep {
  return {
    id: status,
    title: status === "waiting" ? "Await approval" : "Stopped by user",
    status,
    ...overrides,
  } as unknown as AgentStep;
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.useRealTimers();
});

describe("ReasoningPanel process interaction", () => {
  it("freezes its internal elapsed duration after the run completes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const panel = (status: "running" | "complete" | "idle") => (
      <ReasoningPanel status={status}>Trace</ReasoningPanel>
    );
    const view = await render(panel("running"));
    expect(view.querySelector("[data-slot='elapsed']")?.textContent).toBe("0s");

    vi.setSystemTime(6_000);
    await rerender(panel("complete"));
    expect(view.querySelector("[data-slot='elapsed']")?.textContent).toBe("5s");

    vi.setSystemTime(16_000);
    await rerender(panel("idle"));
    expect(view.querySelector("[data-slot='elapsed']")?.textContent).toBe("5s");
  });

  it("auto-opens while running but preserves a subsequent manual choice", async () => {
    const onOpenChange = vi.fn();
    const panel = (status: "idle" | "running" | "complete") => (
      <ReasoningPanel status={status} onOpenChange={onOpenChange}>
        Trace
      </ReasoningPanel>
    );
    const view = await render(panel("idle"));
    const getPanel = () => view.querySelector<HTMLElement>(".vl-reasoning-panel");
    const getTrigger = () => view.querySelector<HTMLButtonElement>(".vl-reasoning-panel__trigger");

    expect(getPanel()?.dataset.open).toBe("false");
    await rerender(panel("running"));
    expect(getPanel()?.dataset.open).toBe("true");

    await act(async () => getTrigger()?.click());
    expect(getPanel()?.dataset.open).toBe("false");

    await rerender(panel("complete"));
    await rerender(panel("running"));
    expect(getPanel()?.dataset.open).toBe("false");
    expect(onOpenChange.mock.calls.map(([value]) => value)).toEqual([true, false]);
  });

  it("supports always and never automatic expansion policies", async () => {
    const view = await render(
      <ReasoningPanel status="complete" autoOpen="always">
        Always open
      </ReasoningPanel>,
    );
    expect(view.querySelector<HTMLElement>(".vl-reasoning-panel")?.dataset.open).toBe("true");

    await rerender(
      <ReasoningPanel key="never" status="running" autoOpen="never">
        No automatic override
      </ReasoningPanel>,
    );
    expect(view.querySelector<HTMLElement>(".vl-reasoning-panel")?.dataset.open).toBe("false");
  });

  it("updates elapsed time while running and accepts a formatter", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const formatElapsed = vi.fn((elapsed: number) => `${elapsed} elapsed`);
    const view = await render(
      <ReasoningPanel
        status="running"
        startedAt={8_000}
        elapsedUpdateInterval={250}
        formatElapsed={formatElapsed}
      >
        Trace
      </ReasoningPanel>,
    );
    expect(view.querySelector("[data-slot='elapsed']")?.textContent).toBe("2000 elapsed");

    await act(async () => vi.advanceTimersByTime(750));
    expect(view.querySelector("[data-slot='elapsed']")?.textContent).toBe("2750 elapsed");
    expect(formatElapsed).toHaveBeenLastCalledWith(2_750, "running");
  });

  it("announces running and error transitions accessibly", async () => {
    const view = await render(<ReasoningPanel status="running">Trace</ReasoningPanel>);
    const announcement = () => view.querySelector<HTMLElement>("[data-slot='announcement']");
    expect(announcement()?.getAttribute("role")).toBe("status");
    expect(announcement()?.textContent).toBe("Reasoning is in progress");
    expect(view.querySelector("section")?.getAttribute("aria-busy")).toBe("true");

    await rerender(<ReasoningPanel status="error">Trace</ReasoningPanel>);
    expect(announcement()?.getAttribute("role")).toBe("alert");
    expect(announcement()?.getAttribute("aria-live")).toBe("assertive");
    expect(announcement()?.textContent).toBe("Reasoning failed");
  });

  it("keeps controlled expansion controlled and exposes semantic slots", async () => {
    const onOpenChange = vi.fn();
    const view = await render(
      <ReasoningPanel
        open={false}
        onOpenChange={onOpenChange}
        classNames={{ root: "custom-root", content: "custom-content" }}
        styles={{ content: { color: "red" } }}
      >
        Trace
      </ReasoningPanel>,
    );
    await act(async () => view.querySelector<HTMLButtonElement>("[data-slot='trigger']")?.click());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(view.querySelector<HTMLElement>(".custom-root")?.dataset.open).toBe("false");
    expect(view.querySelector<HTMLElement>(".custom-content")?.style.color).toBe("red");
  });
});

describe("AgentSteps process interaction", () => {
  it("renders waiting and cancelled as first-class statuses", async () => {
    const view = await render(
      <AgentSteps steps={[extendedStep("waiting"), extendedStep("cancelled")]} />,
    );
    const items = view.querySelectorAll<HTMLElement>("[data-slot='item']");
    expect(items[0]?.dataset.status).toBe("waiting");
    expect(items[0]?.textContent).toContain("Waiting");
    expect(items[1]?.dataset.status).toBe("cancelled");
    expect(items[1]?.textContent).toContain("Cancelled");
  });

  it("auto-expands running and error details without fighting a manual collapse", async () => {
    const makeStep = (status: AgentStep["status"]): AgentStep => ({
      id: "search",
      title: "Search",
      status,
      detail: "Inspect sources",
    });
    const view = await render(<AgentSteps steps={[makeStep("running")]} />);
    const item = () => view.querySelector<HTMLElement>("[data-slot='item']");
    const trigger = () => view.querySelector<HTMLButtonElement>("[data-slot='trigger']");
    expect(item()?.dataset.expanded).toBe("true");

    await act(async () => trigger()?.click());
    expect(item()?.dataset.expanded).toBe("false");
    await rerender(<AgentSteps steps={[makeStep("running")]} />);
    expect(item()?.dataset.expanded).toBe("false");

    await rerender(<AgentSteps steps={[makeStep("error")]} />);
    expect(item()?.dataset.expanded).toBe("true");
  });

  it("calculates duration and supplies the complete render context", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000);
    const formatDuration = vi.fn((duration: number) => `${duration}ms custom`);
    const renderDetail = vi.fn((_step: AgentStep, context) => (
      <span>
        {context.index}:{context.status}:{context.duration}:{String(context.retrying)}
      </span>
    ));
    const step: AgentStep = {
      id: "execute",
      title: "Execute",
      status: "running",
      startedAt: 2_000,
    };
    const view = await render(
      <AgentSteps steps={[step]} renderDetail={renderDetail} formatDuration={formatDuration} />,
    );
    expect(view.querySelector("[data-slot='duration']")?.textContent).toBe("3000ms custom");
    expect(view.textContent).toContain("0:running:3000:false");
    expect(formatDuration).toHaveBeenCalledWith(3_000, step, 0);
    expect(typeof renderDetail.mock.calls.at(-1)?.[1].retry).toBe("function");
  });

  it("locks duplicate async retries and reports retry failures", async () => {
    const retry = deferred();
    const onRetry = vi.fn(() => retry.promise);
    const onRetryError = vi.fn();
    const step: AgentStep = {
      id: "execute",
      title: "Execute command",
      status: "error",
      error: { message: "Exited 1", retryable: true },
    };
    const view = await render(
      <AgentSteps steps={[step]} onRetry={onRetry} onRetryError={onRetryError} />,
    );
    const retryButton = view.querySelector<HTMLButtonElement>("[data-slot='retry']");

    await act(async () => {
      retryButton?.click();
      retryButton?.click();
      await Promise.resolve();
    });
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledWith(step, {
      index: 0,
      status: "error",
      duration: undefined,
    });
    expect(retryButton?.disabled).toBe(true);
    expect(view.querySelector("ol")?.getAttribute("aria-busy")).toBe("true");

    await act(async () => retry.reject(new Error("Still unavailable")));
    expect(view.querySelector("[data-slot='retryError']")?.textContent).toBe("Still unavailable");
    expect(view.querySelector("[data-slot='retryError']")?.getAttribute("role")).toBe("alert");
    expect(onRetryError).toHaveBeenCalledWith(expect.any(Error), step);
    expect(retryButton?.disabled).toBe(false);
  });

  it("keeps expanded ids controlled and applies semantic slots", async () => {
    const onExpandedStepIdsChange = vi.fn();
    const view = await render(
      <AgentSteps
        steps={[{ id: "one", title: "One", status: "complete", detail: "Detail" }]}
        expandedStepIds={[]}
        autoExpand="never"
        onExpandedStepIdsChange={onExpandedStepIdsChange}
        classNames={{ root: "steps-root", item: "step-row" }}
        styles={{ item: { color: "blue" } }}
      />,
    );
    await act(async () => view.querySelector<HTMLButtonElement>("[data-slot='trigger']")?.click());
    expect(onExpandedStepIdsChange).toHaveBeenCalledWith(["one"]);
    expect(view.querySelector<HTMLElement>(".step-row")?.dataset.expanded).toBe("false");
    expect(view.querySelector<HTMLElement>(".step-row")?.style.color).toBe("blue");
  });
});

describe("ToolCallCard approval interaction", () => {
  it("shows tool identity, risk, arguments, result, and errors", async () => {
    const view = await render(
      <ToolCallCard
        toolName="deploy_preview"
        description="Deploys a temporary preview"
        status="error"
        risk="high"
        arguments={{ branch: "feature" }}
        result={{ deploymentId: "dep_123" }}
        error={new Error("Provider rejected the build")}
      />,
    );
    const card = view.querySelector<HTMLElement>("article");
    expect(card?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(card?.dataset.risk).toBe("high");
    expect(view.textContent).toContain("deploy_preview");
    expect(view.textContent).toContain("High risk");
    expect(view.textContent).toContain('"branch": "feature"');
    expect(view.textContent).toContain('"deploymentId": "dep_123"');
    expect(view.textContent).toContain("Provider rejected the build");
  });

  it("keeps expansion controlled and uses a native keyboard-operable button", async () => {
    const onExpandedChange = vi.fn();
    const view = await render(
      <ToolCallCard
        toolName="read_file"
        arguments={{ path: "/tmp/a" }}
        expanded={false}
        onExpandedChange={onExpandedChange}
      />,
    );
    const header = view.querySelector<HTMLButtonElement>("[data-slot='header']");
    expect(header?.tagName).toBe("BUTTON");
    expect(header?.getAttribute("aria-expanded")).toBe("false");
    expect(header?.getAttribute("aria-controls")).toBeTruthy();
    await act(async () => header?.click());
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(view.querySelector<HTMLElement>("article")?.dataset.expanded).toBe("false");
  });

  it("opens new attention states until the user manually chooses otherwise", async () => {
    const card = (status: "draft" | "approval-required" | "error") => (
      <ToolCallCard
        toolName="publish_preview"
        status={status}
        arguments={{ branch: "feature" }}
        onApprove={() => undefined}
      />
    );
    const view = await render(card("draft"));
    expect(view.querySelector<HTMLElement>("article")?.dataset.expanded).toBe("false");

    await rerender(card("approval-required"));
    expect(view.querySelector<HTMLElement>("article")?.dataset.expanded).toBe("true");

    await act(async () =>
      view.querySelector<HTMLButtonElement>("[data-slot='header']")?.click(),
    );
    expect(view.querySelector<HTMLElement>("article")?.dataset.expanded).toBe("false");

    await rerender(card("error"));
    expect(view.querySelector<HTMLElement>("article")?.dataset.expanded).toBe("false");
  });

  it("locks approval while pending and prevents duplicate actions", async () => {
    const approval = deferred();
    const onApprove = vi.fn(() => approval.promise);
    const onReject = vi.fn();
    const view = await render(
      <ToolCallCard
        toolName="run_command"
        status="approval-required"
        risk="critical"
        arguments={{ command: "publish" }}
        onApprove={onApprove}
        onReject={onReject}
      />,
    );
    const approve = view.querySelector<HTMLButtonElement>("[data-slot='approve']");
    const reject = view.querySelector<HTMLButtonElement>("[data-slot='reject']");

    await act(async () => {
      approve?.click();
      approve?.click();
      reject?.click();
      await Promise.resolve();
    });
    expect(onApprove).toHaveBeenCalledOnce();
    expect(onApprove).toHaveBeenCalledWith({
      action: "approve",
      status: "approval-required",
      risk: "critical",
    });
    expect(onReject).not.toHaveBeenCalled();
    expect(approve?.disabled).toBe(true);
    expect(reject?.disabled).toBe(true);
    expect(view.querySelector("article")?.dataset.pendingAction).toBe("approve");
    expect(view.textContent).toContain("Approving…");

    await act(async () => approval.resolve());
    expect(approve?.disabled).toBe(false);
    expect(view.querySelector("article")?.dataset.pendingAction).toBeUndefined();
  });

  it("runs an asynchronous rejection with the same pending guarantees", async () => {
    const rejection = deferred();
    const onReject = vi.fn(() => rejection.promise);
    const view = await render(
      <ToolCallCard
        toolName="delete_branch"
        status="approval-required"
        risk="high"
        onReject={onReject}
      />,
    );
    const reject = view.querySelector<HTMLButtonElement>("[data-slot='reject']");

    await act(async () => {
      reject?.click();
      reject?.click();
      await Promise.resolve();
    });
    expect(onReject).toHaveBeenCalledOnce();
    expect(onReject).toHaveBeenCalledWith({
      action: "reject",
      status: "approval-required",
      risk: "high",
    });
    expect(view.querySelector("article")?.dataset.pendingAction).toBe("reject");
    expect(reject?.textContent).toBe("Rejecting…");

    await act(async () => rejection.resolve());
    expect(reject?.disabled).toBe(false);
  });

  it("surfaces action failures and allows a subsequent retry", async () => {
    const onActionError = vi.fn();
    const onRetry = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce();
    const view = await render(
      <ToolCallCard
        toolName="web_search"
        status="error"
        error="Timed out"
        onRetry={onRetry}
        onActionError={onActionError}
      />,
    );
    const retry = view.querySelector<HTMLButtonElement>("[data-slot='retry']");

    await act(async () => {
      retry?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(view.querySelector("[data-slot='actionError']")?.textContent).toBe(
      "Network unavailable",
    );
    expect(view.querySelector("[data-slot='actionError']")?.getAttribute("role")).toBe("alert");
    expect(view.querySelectorAll("[role='alert']")).toHaveLength(1);
    expect(onActionError).toHaveBeenCalledWith(expect.any(Error), {
      action: "retry",
      status: "error",
      risk: "low",
    });

    await act(async () => {
      retry?.click();
      await Promise.resolve();
    });
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(view.querySelector("[data-slot='actionError']")).toBeNull();
  });

  it("supports non-collapsible details and semantic slot overrides", async () => {
    const view = await render(
      <ToolCallCard
        toolName="read_file"
        arguments={{ path: "README.md" }}
        collapsible={false}
        classNames={{ root: "tool-root", value: "tool-value" }}
        styles={{ value: { color: "green" } }}
      />,
    );
    expect(view.querySelector<HTMLElement>(".tool-root")?.dataset.expanded).toBe("true");
    expect(view.querySelector("[data-slot='header']")?.tagName).toBe("DIV");
    expect(view.querySelector<HTMLElement>(".tool-value")?.style.color).toBe("green");
    expect(view.querySelector("[data-slot='body']")?.hasAttribute("inert")).toBe(false);
  });
});
