// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { PromptDraft } from "./PromptComposer";
import { usePromptDrafts, type UsePromptDraftsResult } from "./use-prompt-drafts";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("usePromptDrafts", () => {
  it("isolates drafts by conversation and clears them independently", async () => {
    let drafts: UsePromptDraftsResult | undefined;
    const initial = new Map<string, PromptDraft>([
      ["one", { text: "First", attachments: [] }],
    ]);

    function Harness() {
      drafts = usePromptDrafts({ initialDrafts: initial });
      return null;
    }

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root?.render(<Harness />));

    expect(drafts?.getDraft("one").text).toBe("First");
    expect(drafts?.getDraft("two").text).toBe("");
    await act(async () => drafts?.setDraft("two", { text: "Second", attachments: [] }));
    expect(drafts?.getDraft("one").text).toBe("First");
    expect(drafts?.getDraft("two").text).toBe("Second");
    await act(async () => drafts?.clearDraft("one"));
    expect(drafts?.getDraft("one").text).toBe("");
    expect(drafts?.getDraft("two").text).toBe("Second");
  });
});
