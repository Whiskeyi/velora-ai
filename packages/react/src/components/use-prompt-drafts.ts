"use client";

import { useCallback, useState } from "react";
import type { PromptDraft } from "./PromptComposer";

const EMPTY_PROMPT_DRAFT: PromptDraft = Object.freeze({
  text: "",
  attachments: Object.freeze([]),
});

export type PromptDraftUpdater =
  | PromptDraft
  | ((current: PromptDraft) => PromptDraft);

export interface UsePromptDraftsOptions {
  initialDrafts?: ReadonlyMap<string, PromptDraft>;
  createDraft?: (key: string) => PromptDraft;
}

export interface UsePromptDraftsResult {
  drafts: ReadonlyMap<string, PromptDraft>;
  getDraft(key: string): PromptDraft;
  setDraft(key: string, updater: PromptDraftUpdater): void;
  clearDraft(key: string): void;
  clearAllDrafts(): void;
}

function cloneDraft(draft: PromptDraft): PromptDraft {
  return { text: draft.text, attachments: [...draft.attachments] };
}

/** Keeps text and attachments isolated while users move between conversations. */
export function usePromptDrafts(
  options: UsePromptDraftsOptions = {},
): UsePromptDraftsResult {
  const [drafts, setDrafts] = useState<ReadonlyMap<string, PromptDraft>>(() => {
    const initial = new Map<string, PromptDraft>();
    options.initialDrafts?.forEach((draft, key) => initial.set(key, cloneDraft(draft)));
    return initial;
  });

  const getDraft = useCallback(
    (key: string): PromptDraft =>
      drafts.get(key) ?? options.createDraft?.(key) ?? EMPTY_PROMPT_DRAFT,
    [drafts, options.createDraft],
  );

  const setDraft = useCallback(
    (key: string, updater: PromptDraftUpdater) => {
      setDrafts((current) => {
        const previous =
          current.get(key) ?? options.createDraft?.(key) ?? EMPTY_PROMPT_DRAFT;
        const nextDraft =
          typeof updater === "function" ? updater(previous) : updater;
        if (nextDraft === previous) return current;
        const next = new Map(current);
        next.set(key, cloneDraft(nextDraft));
        return next;
      });
    },
    [options.createDraft],
  );

  const clearDraft = useCallback((key: string) => {
    setDrafts((current) => {
      if (!current.has(key)) return current;
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }, []);

  const clearAllDrafts = useCallback(() => {
    setDrafts((current) => (current.size === 0 ? current : new Map()));
  }, []);

  return { drafts, getDraft, setDraft, clearDraft, clearAllDrafts };
}
