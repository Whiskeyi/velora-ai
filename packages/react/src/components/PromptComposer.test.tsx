// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PromptComposer,
  type PromptAttachment,
  type PromptDraft,
  type PromptSubmitResult,
} from "./PromptComposer";

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

async function rerender(node: ReactNode): Promise<void> {
  await act(async () => root?.render(node));
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

function dispatchKey(
  textarea: HTMLTextAreaElement,
  init: KeyboardEventInit,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  textarea.dispatchEvent(event);
  return event;
}

function attachment(
  id: string,
  name = `${id}.txt`,
  status: PromptAttachment["status"] = "ready",
): PromptAttachment {
  return {
    id,
    file: new File([id], name, { type: "text/plain" }),
    status,
    error: status === "error" ? "Upload failed" : undefined,
  };
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("PromptComposer draft and submission contracts", () => {
  it("submits the original text without trimming and clears an accepted snapshot", async () => {
    const onSubmit = vi.fn((_draft: PromptDraft): PromptSubmitResult => ({ accepted: true }));
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "  keep my spacing  ", attachments: [] }}
        onSubmit={onSubmit}
      />,
    );
    const form = view.querySelector("form");
    const textarea = view.querySelector("textarea");
    expect(form).not.toBeNull();
    expect(textarea).not.toBeNull();

    await submit(form as HTMLFormElement);

    expect(onSubmit).toHaveBeenCalledWith(
      { text: "  keep my spacing  ", attachments: [] },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        submissionId: 1,
      }),
    );
    expect(textarea?.value).toBe("");
  });

  it("uses whitespace only for validation and allows an attachment-only draft", async () => {
    const onSubmit = vi.fn((_draft: PromptDraft): PromptSubmitResult => ({ accepted: true }));
    const file = attachment("one");
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: " \n\t ", attachments: [] }}
        onSubmit={onSubmit}
      />,
    );
    const submitButton = view.querySelector<HTMLButtonElement>("[data-action='submit']");
    expect(submitButton?.disabled).toBe(true);

    await rerender(
      <PromptComposer
        draft={{ text: " \n\t ", attachments: [file] }}
        onSubmit={onSubmit}
      />,
    );
    expect(view.querySelector<HTMLButtonElement>("[data-action='submit']")?.disabled).toBe(
      false,
    );
    await submit(view.querySelector("form") as HTMLFormElement);
    expect(onSubmit.mock.calls.at(-1)?.[0].text).toBe(" \n\t ");
  });

  it("supports a controlled canonical draft and reports semantic change context", async () => {
    const first: PromptDraft = { text: "Controlled", attachments: [] };
    const onDraftChange = vi.fn();
    const onSubmit = vi.fn((): PromptSubmitResult => ({ accepted: true }));
    const view = await render(
      <PromptComposer draft={first} onDraftChange={onDraftChange} onSubmit={onSubmit} />,
    );
    const textarea = view.querySelector("textarea") as HTMLTextAreaElement;

    await setTextareaValue(textarea, "Next");

    expect(onDraftChange).toHaveBeenCalledWith(
      { text: "Next", attachments: [] },
      { reason: "input", previousDraft: first },
    );
    expect(textarea.value).toBe("Controlled");

    await rerender(
      <PromptComposer
        draft={{ text: "Next", attachments: [] }}
        onDraftChange={onDraftChange}
        onSubmit={onSubmit}
      />,
    );
    expect(textarea.value).toBe("Next");
  });

  it("preserves a rejected draft and exposes an accessible rejection", async () => {
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "Retry this", attachments: [] }}
        onSubmit={() => ({ accepted: false, error: "Policy needs confirmation" })}
      />,
    );

    await submit(view.querySelector("form") as HTMLFormElement);

    const textarea = view.querySelector("textarea");
    const alert = view.querySelector("[role='alert']");
    expect(textarea?.value).toBe("Retry this");
    expect(textarea?.getAttribute("aria-invalid")).toBe("true");
    expect(textarea?.getAttribute("aria-errormessage")).toBe(alert?.id);
    expect(alert?.textContent).toContain("Policy needs confirmation");
    expect(view.querySelector("form")?.dataset.submissionStatus).toBe("error");
  });

  it("preserves a thrown draft, reports the exception, and clears the error on edit", async () => {
    const transportError = new Error("Transport unavailable");
    const onSubmitError = vi.fn();
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "Keep this", attachments: [] }}
        onSubmit={() => Promise.reject(transportError)}
        onSubmitError={onSubmitError}
      />,
    );

    await submit(view.querySelector("form") as HTMLFormElement);
    await act(async () => Promise.resolve());

    expect(onSubmitError).toHaveBeenCalledWith(transportError);
    expect(view.querySelector("[role='alert']")?.textContent).toContain(
      "Transport unavailable",
    );
    const textarea = view.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Keep this");
    await setTextareaValue(textarea, "Try again");
    expect(view.querySelector("[role='alert']")).toBeNull();
    expect(view.querySelector("form")?.dataset.submissionStatus).toBe("idle");
  });

  it("lets the user edit the next draft during handoff and clears only the accepted snapshot", async () => {
    const handoff = deferred<PromptSubmitResult>();
    const firstAttachment = attachment("first");
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "First request", attachments: [firstAttachment] }}
        onSubmit={() => handoff.promise}
      />,
    );
    const form = view.querySelector("form") as HTMLFormElement;
    const textarea = view.querySelector("textarea") as HTMLTextAreaElement;
    await submit(form);
    expect(form.dataset.submissionStatus).toBe("submitting");
    expect(textarea.disabled).toBe(false);

    await setTextareaValue(textarea, "Second request");
    await setTextareaValue(textarea, "First request");
    const busyEnter = dispatchKey(textarea, { key: "Enter" });
    expect(busyEnter.defaultPrevented).toBe(false);

    await act(async () => handoff.resolve({ accepted: true }));
    expect(textarea.value).toBe("First request");
    expect(view.querySelector("[data-slot='attachment']")).toBeNull();
    expect(form.dataset.submissionStatus).toBe("idle");
  });

  it("honors clear false after an accepted handoff", async () => {
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "Reusable context", attachments: [] }}
        onSubmit={() => ({ accepted: true, clear: false })}
      />,
    );
    await submit(view.querySelector("form") as HTMLFormElement);
    expect(view.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Reusable context",
    );
  });
});

describe("PromptComposer keyboard, run, and cancellation contracts", () => {
  it("supports enter, mod-enter, and button-only shortcuts without breaking IME", async () => {
    const onSubmit = vi.fn((): PromptSubmitResult => ({ accepted: true, clear: false }));
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "Send", attachments: [] }}
        submitShortcut="mod-enter"
        onSubmit={onSubmit}
      />,
    );
    const textarea = view.querySelector("textarea") as HTMLTextAreaElement;

    const plainEnter = dispatchKey(textarea, { key: "Enter" });
    expect(plainEnter.defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();

    const modEnter = dispatchKey(textarea, { key: "Enter", ctrlKey: true });
    await act(async () => Promise.resolve());
    expect(modEnter.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledOnce();

    await rerender(
      <PromptComposer
        draft={{ text: "Send", attachments: [] }}
        submitShortcut="button-only"
        onSubmit={onSubmit}
      />,
    );
    const buttonOnlyEnter = dispatchKey(textarea, { key: "Enter" });
    expect(buttonOnlyEnter.defaultPrevented).toBe(false);
    expect(onSubmit).toHaveBeenCalledOnce();

    await rerender(
      <PromptComposer
        draft={{ text: "输入", attachments: [] }}
        submitShortcut="enter"
        onSubmit={onSubmit}
      />,
    );
    await act(async () => {
      textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      dispatchKey(textarea, { key: "Enter" });
    });
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("keeps run state orthogonal, allows editing while streaming, and does not swallow Enter", async () => {
    const onStop = vi.fn();
    const onSubmit = vi.fn((): PromptSubmitResult => ({ accepted: true }));
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "Next turn", attachments: [] }}
        runStatus="streaming"
        onSubmit={onSubmit}
        onStop={onStop}
      />,
    );
    const form = view.querySelector("form") as HTMLFormElement;
    const textarea = view.querySelector("textarea") as HTMLTextAreaElement;
    expect(form.dataset.submissionStatus).toBe("idle");
    expect(form.dataset.runStatus).toBe("streaming");
    expect(textarea.disabled).toBe(false);

    await setTextareaValue(textarea, "Edited next turn");
    const event = dispatchKey(textarea, { key: "Enter" });
    expect(event.defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.querySelector("[role='status']")?.textContent).toContain("Generating");
  });

  it("aborts a pending handoff, awaits stop, and ignores the stale submit completion", async () => {
    const handoff = deferred<PromptSubmitResult>();
    const stopping = deferred<void>();
    let submitSignal: AbortSignal | undefined;
    const onSubmit = vi.fn((_draft: PromptDraft, context: { signal: AbortSignal }) => {
      submitSignal = context.signal;
      return handoff.promise;
    });
    const onStop = vi.fn(() => stopping.promise);
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "Do not lose", attachments: [] }}
        onSubmit={onSubmit}
        onStop={onStop}
      />,
    );
    await submit(view.querySelector("form") as HTMLFormElement);
    const stopButton = view.querySelector<HTMLButtonElement>("[data-action='stop']");
    await act(async () => stopButton?.click());

    expect(submitSignal?.aborted).toBe(true);
    expect(onStop).toHaveBeenCalledOnce();
    expect(view.querySelector("form")?.dataset.runStatus).toBe("stopping");
    expect(view.querySelector<HTMLButtonElement>("[data-action='stop']")?.disabled).toBe(
      true,
    );

    await act(async () => handoff.resolve({ accepted: true }));
    expect(view.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Do not lose",
    );
    await act(async () => stopping.resolve());
    expect(view.querySelector("form")?.dataset.runStatus).toBe("idle");
  });

  it("invalidates an old stop completion when the external run has already ended", async () => {
    const stopping = deferred<void>();
    let stopSignal: AbortSignal | undefined;
    const onStop = vi.fn((context: { signal: AbortSignal }) => {
      stopSignal = context.signal;
      return stopping.promise;
    });
    const props = {
      draft: { text: "Next", attachments: [] } satisfies PromptDraft,
      onSubmit: () => ({ accepted: true }) as PromptSubmitResult,
      onStop,
    };
    const view = await render(<PromptComposer {...props} runStatus="streaming" />);
    await act(async () =>
      view.querySelector<HTMLButtonElement>("[data-action='stop']")?.click(),
    );
    await rerender(<PromptComposer {...props} runStatus="idle" />);

    expect(stopSignal?.aborted).toBe(true);
    expect(view.querySelector("form")?.dataset.runStatus).toBe("idle");
    await act(async () => stopping.resolve());
    expect(view.querySelector("[role='alert']")).toBeNull();
  });
});

describe("PromptComposer attachment contracts", () => {
  it("validates picker files by type, size, count, and reports accepted/rejected sets", async () => {
    const onAttachmentsAdd = vi.fn();
    const onAttachmentsRejected = vi.fn();
    const createAttachment = vi.fn((file: File) => ({
      id: `id-${file.name}`,
      file,
      status: "ready" as const,
    }));
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "", attachments: [] }}
        onSubmit={() => ({ accepted: true })}
        accept="image/*,.md"
        maxFileSize={5}
        maxAttachments={1}
        createAttachment={createAttachment}
        onAttachmentsAdd={onAttachmentsAdd}
        onAttachmentsRejected={onAttachmentsRejected}
      />,
    );
    const files = [
      new File(["ok"], "ok.png", { type: "image/png" }),
      new File(["too-large"], "large.md", { type: "text/markdown" }),
      new File(["bad"], "bad.txt", { type: "text/plain" }),
      new File(["next"], "next.md", { type: "text/markdown" }),
    ];
    const input = view.querySelector<HTMLInputElement>("input[type='file']");
    Object.defineProperty(input, "files", { configurable: true, value: files });
    await act(async () => input?.dispatchEvent(new Event("change", { bubbles: true })));

    expect(view.querySelector("[data-slot='attachmentName']")?.textContent).toBe("ok.png");
    expect(onAttachmentsAdd).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "id-ok.png", file: files[0] })],
      expect.objectContaining({ source: "picker", rejections: expect.any(Array) }),
    );
    const rejections = onAttachmentsRejected.mock.calls[0]?.[0];
    expect(rejections.map((item: { reason: string }) => item.reason).sort()).toEqual([
      "limit",
      "size",
      "type",
    ]);
    expect(view.querySelector("[role='alert']")?.textContent).toContain(
      "not an accepted file type",
    );
  });

  it("adds dropped and pasted files with their source and preserves normal text paste", async () => {
    const onAttachmentsAdd = vi.fn();
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "", attachments: [] }}
        onSubmit={() => ({ accepted: true })}
        onAttachmentsAdd={onAttachmentsAdd}
      />,
    );
    const form = view.querySelector("form") as HTMLFormElement;
    const textarea = view.querySelector("textarea") as HTMLTextAreaElement;
    const dropped = new File(["drop"], "drop.txt", { type: "text/plain" });
    const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, "dataTransfer", {
      value: { files: [dropped], types: ["Files"], dropEffect: "none" },
    });
    await act(async () => form.dispatchEvent(dropEvent));
    expect(dropEvent.defaultPrevented).toBe(true);
    expect(onAttachmentsAdd.mock.calls[0]?.[1].source).toBe("drop");

    const pasted = new File(["paste"], "paste.txt", { type: "text/plain" });
    const filePaste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(filePaste, "clipboardData", { value: { files: [pasted] } });
    await act(async () => textarea.dispatchEvent(filePaste));
    expect(filePaste.defaultPrevented).toBe(true);
    expect(onAttachmentsAdd.mock.calls[1]?.[1].source).toBe("paste");

    const textPaste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(textPaste, "clipboardData", { value: { files: [] } });
    await act(async () => textarea.dispatchEvent(textPaste));
    expect(textPaste.defaultPrevented).toBe(false);
  });

  it("removes attachments and aborts a pending retry without leaking stale errors", async () => {
    const retry = deferred<void>();
    let retrySignal: AbortSignal | undefined;
    const failed = attachment("failed", "failed.txt", "error");
    const onAttachmentRemove = vi.fn();
    const onAttachmentRetry = vi.fn(
      (_attachment: PromptAttachment, context: { signal: AbortSignal }) => {
        retrySignal = context.signal;
        return retry.promise;
      },
    );
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "", attachments: [failed] }}
        onSubmit={() => ({ accepted: true })}
        onAttachmentRetry={onAttachmentRetry}
        onAttachmentRemove={onAttachmentRemove}
      />,
    );
    await act(async () =>
      view.querySelector<HTMLButtonElement>("[data-slot='attachmentRetry']")?.click(),
    );
    expect(
      view.querySelector<HTMLButtonElement>("[data-slot='attachmentRetry']")?.textContent,
    ).toBe("Retrying");

    await act(async () =>
      view.querySelector<HTMLButtonElement>("[data-slot='attachmentRemove']")?.click(),
    );
    expect(retrySignal?.aborted).toBe(true);
    expect(onAttachmentRemove).toHaveBeenCalledWith(failed);
    expect(view.querySelector("[data-slot='attachment']")).toBeNull();
    await act(async () => retry.reject(new Error("Stale failure")));
    expect(view.querySelector("[role='alert']")).toBeNull();
  });

  it("surfaces a current retry failure and reports it to the consumer", async () => {
    const retryError = new Error("Upload service offline");
    const failed = attachment("failed", "failed.txt", "error");
    const onAttachmentRetryError = vi.fn();
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "", attachments: [failed] }}
        onSubmit={() => ({ accepted: true })}
        onAttachmentRetry={() => Promise.reject(retryError)}
        onAttachmentRetryError={onAttachmentRetryError}
      />,
    );
    await act(async () => {
      view.querySelector<HTMLButtonElement>("[data-slot='attachmentRetry']")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onAttachmentRetryError).toHaveBeenCalledWith(retryError, failed);
    expect(view.querySelector("[role='alert']")?.textContent).toContain(
      "Upload service offline",
    );
  });

  it("returns an uncontrolled failed attachment to ready after a successful retry", async () => {
    const failed = attachment("failed", "failed.txt", "error");
    const onDraftChange = vi.fn();
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "Send with context", attachments: [failed] }}
        onDraftChange={onDraftChange}
        onSubmit={() => ({ accepted: true })}
        onAttachmentRetry={() => Promise.resolve()}
      />,
    );

    expect(view.querySelector<HTMLButtonElement>("[data-action='submit']")?.disabled).toBe(true);
    await act(async () => {
      view.querySelector<HTMLButtonElement>("[data-slot='attachmentRetry']")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(view.querySelector<HTMLElement>("[data-slot='attachment']")?.dataset.status).toBe(
      "ready",
    );
    expect(view.querySelector("[data-slot='attachmentRetry']")).toBeNull();
    expect(view.querySelector<HTMLButtonElement>("[data-action='submit']")?.disabled).toBe(false);
    expect(onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        attachments: [expect.objectContaining({ id: "failed", status: "ready" })],
      }),
      expect.objectContaining({ reason: "attachment-retry" }),
    );
  });
});

describe("PromptComposer accessibility and semantic styling", () => {
  it("connects label, description, error, and counter to the textarea", async () => {
    const view = await render(
      <PromptComposer
        draft={{ text: "1234", attachments: [] }}
        onSubmit={() => ({ accepted: true })}
        label="Prompt"
        description="Describe the desired outcome"
        error="A server-side validation error"
        maxLength={20}
      />,
    );
    const textarea = view.querySelector("textarea") as HTMLTextAreaElement;
    const label = view.querySelector("label");
    const description = view.querySelector("[data-slot='description']");
    const counter = view.querySelector("[data-slot='counter']");
    const alert = view.querySelector("[role='alert']");

    expect(label?.htmlFor).toBe(textarea.id);
    const describedBy = textarea.getAttribute("aria-describedby")?.split(" ");
    expect(describedBy).toEqual(
      expect.arrayContaining([description?.id, counter?.id, alert?.id]),
    );
    expect(textarea.getAttribute("aria-errormessage")).toBe(alert?.id);
    expect(counter?.textContent).toBe("4/20");
  });

  it("applies typed semantic class names and styles to stable slots", async () => {
    const view = await render(
      <PromptComposer
        draft={{ text: "Styled", attachments: [] }}
        onSubmit={() => ({ accepted: true })}
        label="Label"
        classNames={{ root: "custom-root", input: "custom-input", submitButton: "custom-send" }}
        styles={{ input: { color: "rgb(1, 2, 3)" }, submitButton: { opacity: 0.8 } }}
      />,
    );
    expect(view.querySelector("form")?.classList.contains("custom-root")).toBe(true);
    expect(view.querySelector("textarea")?.classList.contains("custom-input")).toBe(true);
    expect(
      view.querySelector("[data-action='submit']")?.classList.contains("custom-send"),
    ).toBe(true);
    expect(view.querySelector<HTMLTextAreaElement>("textarea")?.style.color).toBe(
      "rgb(1, 2, 3)",
    );
  });

  it("drives autosize through CSS variables so stylesheet caps cannot conflict", async () => {
    const view = await render(
      <PromptComposer
        defaultDraft={{ text: "one", attachments: [] }}
        onSubmit={() => ({ accepted: true })}
        minRows={1}
        maxRows={3}
        styles={{ input: { lineHeight: "20px", paddingTop: "2px", paddingBottom: "2px" } }}
      />,
    );
    const textarea = view.querySelector("textarea") as HTMLTextAreaElement;
    Object.defineProperty(textarea, "scrollHeight", { configurable: true, value: 80 });
    await setTextareaValue(textarea, "one\ntwo\nthree\nfour");

    expect(textarea.style.getPropertyValue("--vl-prompt-input-min-height")).toBe("24px");
    expect(textarea.style.getPropertyValue("--vl-prompt-input-max-height")).toBe("64px");
    expect(textarea.style.getPropertyValue("--vl-prompt-input-height")).toBe("64px");
    expect(textarea.style.maxHeight).toBe("var(--vl-prompt-input-max-height)");
    expect(textarea.style.overflowY).toBe("auto");
  });
});
