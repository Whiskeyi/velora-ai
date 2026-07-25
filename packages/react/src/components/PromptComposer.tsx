import {
  forwardRef,
  type ChangeEvent,
  type ClipboardEvent,
  type CompositionEvent,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type FormHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { StreamingIndicator } from "./StreamingIndicator";
import { useComponentClass, useVelora } from "./VeloraProvider";
import {
  composeStyles,
  cx,
  errorMessage,
  type SemanticClassNames,
  type SemanticStyles,
} from "./utils";

export type PromptRunStatus = "idle" | "streaming" | "stopping" | "error";
export type PromptSubmissionStatus = "idle" | "submitting" | "error";
export type PromptSubmitShortcut = "enter" | "mod-enter" | "button-only";
export type PromptAttachmentStatus = "ready" | "uploading" | "error";
export type PromptAttachmentSource = "picker" | "drop" | "paste";
export type PromptAttachmentRejectionReason =
  | "type"
  | "size"
  | "limit"
  | "duplicate"
  | "creation";

export interface PromptAttachment {
  readonly id: string;
  readonly file: File;
  readonly status?: PromptAttachmentStatus;
  readonly error?: string;
  readonly previewUrl?: string;
}

export interface PromptDraft {
  readonly text: string;
  readonly attachments: readonly PromptAttachment[];
}

export type PromptDraftChangeReason =
  | "input"
  | "attachments-add"
  | "attachment-remove"
  | "attachment-retry"
  | "submit-clear";

export interface PromptDraftChangeContext {
  reason: PromptDraftChangeReason;
  previousDraft: PromptDraft;
}

export interface PromptAttachmentRejection {
  file: File;
  reason: PromptAttachmentRejectionReason;
  message: string;
}

export interface PromptAttachmentsAddContext {
  source: PromptAttachmentSource;
  rejections: readonly PromptAttachmentRejection[];
}

export interface PromptAttachmentRetryContext {
  signal: AbortSignal;
}

export type PromptAttachmentRetryResult = PromptAttachment | void;

export interface PromptAttachmentRenderContext {
  remove: () => void;
  retry: (() => void) | undefined;
  retrying: boolean;
}

export type PromptSubmitResult =
  | { accepted: true; clear?: boolean }
  | { accepted: false; error?: string };

export interface PromptSubmitContext {
  event: FormEvent<HTMLFormElement>;
  signal: AbortSignal;
  submissionId: number;
}

export interface PromptStopContext {
  signal: AbortSignal;
}

export type PromptComposerSlot =
  | "root"
  | "label"
  | "description"
  | "attachments"
  | "attachment"
  | "attachmentName"
  | "attachmentMeta"
  | "attachmentRemove"
  | "attachmentRetry"
  | "surface"
  | "leading"
  | "input"
  | "actions"
  | "tools"
  | "fileInput"
  | "attachButton"
  | "submitButton"
  | "footer"
  | "meta"
  | "status"
  | "counter"
  | "error";

export interface PromptComposerProps
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "children" | "onSubmit"> {
  draft?: PromptDraft;
  defaultDraft?: PromptDraft;
  onDraftChange?: (draft: PromptDraft, context: PromptDraftChangeContext) => void;
  onSubmit: (
    draft: PromptDraft,
    context: PromptSubmitContext,
  ) => PromptSubmitResult | Promise<PromptSubmitResult>;
  onSubmitError?: (error: unknown) => void;
  onStop?: (context: PromptStopContext) => void | Promise<void>;
  onStopError?: (error: unknown) => void;
  runStatus?: PromptRunStatus;
  submitShortcut?: PromptSubmitShortcut;
  placeholder?: string;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  minRows?: number;
  maxRows?: number;
  maxLength?: number;
  autoSize?: boolean;
  showCounter?: boolean;
  attachmentsEnabled?: boolean;
  accept?: string;
  maxFileSize?: number;
  maxAttachments?: number;
  createAttachment?: (file: File) => PromptAttachment;
  onAttachmentsAdd?: (
    attachments: readonly PromptAttachment[],
    context: PromptAttachmentsAddContext,
  ) => void;
  onAttachmentsRejected?: (
    rejections: readonly PromptAttachmentRejection[],
    source: PromptAttachmentSource,
  ) => void;
  onAttachmentRemove?: (attachment: PromptAttachment) => void;
  onAttachmentRetry?: (
    attachment: PromptAttachment,
    context: PromptAttachmentRetryContext,
  ) => PromptAttachmentRetryResult | Promise<PromptAttachmentRetryResult>;
  onAttachmentRetryError?: (error: unknown, attachment: PromptAttachment) => void;
  renderAttachment?: (
    attachment: PromptAttachment,
    context: PromptAttachmentRenderContext,
  ) => ReactNode;
  leading?: ReactNode;
  tools?: ReactNode;
  footer?: ReactNode;
  attachmentIcon?: ReactNode;
  submitIcon?: ReactNode;
  stopIcon?: ReactNode;
  attachmentLabel?: string;
  submitLabel?: string;
  stopLabel?: string;
  removeAttachmentLabel?: (attachment: PromptAttachment) => string;
  retryAttachmentLabel?: (attachment: PromptAttachment) => string;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  inputProps?: Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    | "value"
    | "defaultValue"
    | "onChange"
    | "placeholder"
    | "disabled"
    | "maxLength"
    | "rows"
  >;
  classNames?: SemanticClassNames<PromptComposerSlot>;
  styles?: SemanticStyles<PromptComposerSlot>;
}

const EMPTY_DRAFT: PromptDraft = { text: "", attachments: [] };

let attachmentSequence = 0;

function defaultCreateAttachment(file: File): PromptAttachment {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `attachment-${Date.now()}-${++attachmentSequence}`;
  return { id, file, status: "ready" };
}

function copyDraft(draft: PromptDraft): PromptDraft {
  return { text: draft.text, attachments: [...draft.attachments] };
}

function acceptsFile(file: File, accept: string | undefined): boolean {
  if (!accept?.trim()) return true;
  const fileName = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  return accept.split(",").some((rawRule) => {
    const rule = rawRule.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith(".")) return fileName.endsWith(rule);
    if (rule.endsWith("/*")) return mime.startsWith(rule.slice(0, -1));
    return mime === rule;
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeCount(value: number, fallback: number, minimum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.floor(value));
}

function joinsIds(...values: Array<string | undefined>): string | undefined {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? [...new Set(ids)].join(" ") : undefined;
}

function isFileDrag(event: DragEvent<HTMLFormElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

const SendIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9" />
  </svg>
);

const StopIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <rect x="6" y="6" width="8" height="8" rx="1.5" />
  </svg>
);

const AttachmentIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="m7.2 10.9 4.95-4.95a2.5 2.5 0 0 1 3.54 3.54l-6.37 6.37a4 4 0 0 1-5.66-5.66l6.02-6.01" />
  </svg>
);

export const PromptComposer = forwardRef<HTMLFormElement, PromptComposerProps>(
  function PromptComposer(
    {
      draft: controlledDraft,
      defaultDraft = EMPTY_DRAFT,
      onDraftChange,
      onSubmit,
      onSubmitError,
      onStop,
      onStopError,
      runStatus = "idle",
      submitShortcut = "enter",
      placeholder,
      label,
      description,
      error,
      disabled = false,
      minRows = 1,
      maxRows = 8,
      maxLength,
      autoSize = true,
      showCounter = true,
      attachmentsEnabled = true,
      accept,
      maxFileSize,
      maxAttachments = 8,
      createAttachment = defaultCreateAttachment,
      onAttachmentsAdd,
      onAttachmentsRejected,
      onAttachmentRemove,
      onAttachmentRetry,
      onAttachmentRetryError,
      renderAttachment,
      leading,
      tools,
      footer,
      attachmentIcon,
      submitIcon,
      stopIcon,
      attachmentLabel,
      submitLabel,
      stopLabel,
      removeAttachmentLabel,
      retryAttachmentLabel,
      textareaRef,
      inputProps,
      className,
      style,
      classNames,
      styles,
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop,
      ...formProps
    },
    ref,
  ) {
    const componentClass = useComponentClass("prompt-composer");
    const { messages } = useVelora();
    const copy = messages.promptComposer;
    const resolvedPlaceholder = placeholder ?? copy.placeholder;
    const resolvedAttachmentLabel = attachmentLabel ?? copy.attachmentLabel;
    const resolvedSubmitLabel = submitLabel ?? copy.submitLabel;
    const resolvedStopLabel = stopLabel ?? copy.stopLabel;
    const resolvedRemoveAttachmentLabel =
      removeAttachmentLabel ?? ((attachment: PromptAttachment) =>
        copy.removeAttachment(attachment.file.name));
    const resolvedRetryAttachmentLabel =
      retryAttachmentLabel ?? ((attachment: PromptAttachment) =>
        copy.retryAttachment(attachment.file.name));
    const generatedId = useId();
    const inputId = inputProps?.id ?? `${generatedId}-input`;
    const fileInputId = `${generatedId}-files`;
    const descriptionId = description != null ? `${generatedId}-description` : undefined;
    const errorId = `${generatedId}-error`;
    const counterId = showCounter && maxLength != null ? `${generatedId}-counter` : undefined;

    const controlled = controlledDraft !== undefined;
    const [uncontrolledDraft, setUncontrolledDraft] = useState<PromptDraft>(() =>
      copyDraft(defaultDraft),
    );
    const currentDraft = controlled ? controlledDraft : uncontrolledDraft;
    const latestDraftRef = useRef(currentDraft);
    latestDraftRef.current = currentDraft;
    const observedTextRef = useRef(currentDraft.text);
    const textRevisionRef = useRef(0);
    if (observedTextRef.current !== currentDraft.text) {
      observedTextRef.current = currentDraft.text;
      textRevisionRef.current += 1;
    }

    const internalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const composingRef = useRef(false);
    const mountedRef = useRef(true);
    const dragDepthRef = useRef(0);
    const submissionSequenceRef = useRef(0);
    const activeSubmissionRef = useRef<
      { id: number; controller: AbortController } | undefined
    >(undefined);
    const stopSequenceRef = useRef(0);
    const activeStopRef = useRef<
      { id: number; controller: AbortController } | undefined
    >(undefined);
    const retrySequenceRef = useRef(0);
    const retryRequestsRef = useRef(
      new Map<string, { id: number; controller: AbortController }>(),
    );

    const [submissionStatus, setSubmissionStatus] =
      useState<PromptSubmissionStatus>("idle");
    const [stopPending, setStopPending] = useState(false);
    const [retryingIds, setRetryingIds] = useState<ReadonlySet<string>>(
      () => new Set(),
    );
    const [internalError, setInternalError] = useState<string | undefined>();
    const [dragging, setDragging] = useState(false);
    const normalizedMinRows = normalizeCount(minRows, 1, 1);
    const normalizedMaxRows = normalizeCount(maxRows, 8, normalizedMinRows);
    const normalizedMaxLength =
      maxLength == null ? undefined : normalizeCount(maxLength, 0, 0);
    const attachmentLimit = normalizeCount(
      maxAttachments,
      Number.MAX_SAFE_INTEGER,
      0,
    );

    const commitDraft = useCallback(
      (nextDraft: PromptDraft, reason: PromptDraftChangeReason) => {
        const previousDraft = latestDraftRef.current;
        const normalizedDraft = copyDraft(nextDraft);
        if (normalizedDraft.text !== previousDraft.text) {
          observedTextRef.current = normalizedDraft.text;
          textRevisionRef.current += 1;
        }
        latestDraftRef.current = normalizedDraft;
        if (!controlled) setUncontrolledDraft(normalizedDraft);
        onDraftChange?.(normalizedDraft, { reason, previousDraft });
      },
      [controlled, onDraftChange],
    );

    const resetLocalError = useCallback(() => {
      setInternalError(undefined);
      setSubmissionStatus((state) => (state === "error" ? "idle" : state));
    }, []);

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        activeSubmissionRef.current?.controller.abort();
        activeStopRef.current?.controller.abort();
        retryRequestsRef.current.forEach(({ controller }) => controller.abort());
        activeSubmissionRef.current = undefined;
        activeStopRef.current = undefined;
        retryRequestsRef.current.clear();
      };
    }, []);

    useEffect(() => {
      if (runStatus !== "idle" && runStatus !== "error") return;
      const activeStop = activeStopRef.current;
      if (!activeStop) return;
      activeStop.controller.abort();
      activeStopRef.current = undefined;
      stopSequenceRef.current += 1;
      setStopPending(false);
    }, [runStatus]);

    const resizeTextarea = useCallback(() => {
      const textarea = internalTextareaRef.current;
      if (!textarea || !autoSize || typeof window === "undefined") return;
      const computed = window.getComputedStyle(textarea);
      const lineHeight = Number.parseFloat(computed.lineHeight) || 24;
      const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
      const verticalPadding = paddingTop + paddingBottom;
      const minHeight = lineHeight * normalizedMinRows + verticalPadding;
      const maxHeight = lineHeight * normalizedMaxRows + verticalPadding;

      textarea.style.setProperty("--vl-prompt-input-min-height", `${minHeight}px`);
      textarea.style.setProperty("--vl-prompt-input-max-height", `${maxHeight}px`);
      textarea.style.setProperty("--vl-prompt-input-height", "0px");
      const nextHeight = Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight));
      textarea.style.setProperty("--vl-prompt-input-height", `${nextHeight}px`);
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    }, [autoSize, normalizedMaxRows, normalizedMinRows]);

    useEffect(() => {
      const textarea = internalTextareaRef.current;
      if (!autoSize && textarea) {
        textarea.style.removeProperty("--vl-prompt-input-min-height");
        textarea.style.removeProperty("--vl-prompt-input-max-height");
        textarea.style.removeProperty("--vl-prompt-input-height");
        textarea.style.removeProperty("overflow-y");
        return;
      }
      resizeTextarea();
    }, [autoSize, currentDraft.text, resizeTextarea]);

    useEffect(() => {
      if (!autoSize || typeof window === "undefined") return undefined;
      window.addEventListener("resize", resizeTextarea);
      return () => window.removeEventListener("resize", resizeTextarea);
    }, [autoSize, resizeTextarea]);

    const clearSubmittedSnapshot = useCallback(
      (snapshot: PromptDraft, submittedTextRevision: number) => {
        const latest = latestDraftRef.current;
        const submittedAttachmentIds = new Set(
          snapshot.attachments.map((attachment) => attachment.id),
        );
        const nextDraft: PromptDraft = {
          text:
            textRevisionRef.current === submittedTextRevision ? "" : latest.text,
          attachments: latest.attachments.filter(
            (attachment) => !submittedAttachmentIds.has(attachment.id),
          ),
        };
        if (
          nextDraft.text !== latest.text ||
          nextDraft.attachments.length !== latest.attachments.length
        ) {
          commitDraft(nextDraft, "submit-clear");
        }
      },
      [commitDraft],
    );

    const hasBlockingAttachment = currentDraft.attachments.some(
      (attachment) =>
        attachment.status === "uploading" || attachment.status === "error",
    );
    const contentIsValid =
      currentDraft.text.trim().length > 0 || currentDraft.attachments.length > 0;
    const withinLength =
      normalizedMaxLength == null || currentDraft.text.length <= normalizedMaxLength;
    const runBlocksSubmit =
      runStatus === "streaming" || runStatus === "stopping" || stopPending;
    const submissionPending = submissionStatus === "submitting";
    const canSubmit =
      !disabled &&
      !submissionPending &&
      !runBlocksSubmit &&
      contentIsValid &&
      withinLength &&
      !hasBlockingAttachment;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit || activeSubmissionRef.current) return;

      const snapshot = copyDraft(latestDraftRef.current);
      const submittedTextRevision = textRevisionRef.current;
      const id = ++submissionSequenceRef.current;
      const controller = new AbortController();
      activeSubmissionRef.current = { id, controller };
      setSubmissionStatus("submitting");
      setInternalError(undefined);

      try {
        const result = await onSubmit(snapshot, {
          event,
          signal: controller.signal,
          submissionId: id,
        });
        const active = activeSubmissionRef.current;
        if (!mountedRef.current || active?.id !== id || controller.signal.aborted) return;
        activeSubmissionRef.current = undefined;

        if (result.accepted) {
          setSubmissionStatus("idle");
          if (result.clear !== false) {
            clearSubmittedSnapshot(snapshot, submittedTextRevision);
          }
        } else {
          setSubmissionStatus("error");
          setInternalError(result.error ?? copy.notAccepted);
        }
      } catch (submitError) {
        const active = activeSubmissionRef.current;
        if (!mountedRef.current || active?.id !== id || controller.signal.aborted) return;
        activeSubmissionRef.current = undefined;
        setSubmissionStatus("error");
        setInternalError(errorMessage(submitError));
        onSubmitError?.(submitError);
      }
    };

    const handleStop = async () => {
      if (disabled || !onStop || stopPending || runStatus === "stopping") return;

      const activeSubmission = activeSubmissionRef.current;
      if (activeSubmission) {
        activeSubmission.controller.abort();
        activeSubmissionRef.current = undefined;
        submissionSequenceRef.current += 1;
        setSubmissionStatus("idle");
      }

      const id = ++stopSequenceRef.current;
      const controller = new AbortController();
      activeStopRef.current?.controller.abort();
      activeStopRef.current = { id, controller };
      setStopPending(true);
      setInternalError(undefined);

      try {
        await onStop({ signal: controller.signal });
      } catch (stopError) {
        const active = activeStopRef.current;
        if (!mountedRef.current || active?.id !== id || controller.signal.aborted) return;
        setInternalError(errorMessage(stopError));
        onStopError?.(stopError);
      } finally {
        const active = activeStopRef.current;
        if (mountedRef.current && active?.id === id) {
          activeStopRef.current = undefined;
          setStopPending(false);
        }
      }
    };

    const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
      resetLocalError();
      commitDraft(
        { ...latestDraftRef.current, text: event.currentTarget.value },
        "input",
      );
    };

    const shortcutMatches = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (event.key !== "Enter" || event.shiftKey || event.altKey) return false;
      if (submitShortcut === "button-only") return false;
      if (submitShortcut === "mod-enter") return event.metaKey || event.ctrlKey;
      return !event.metaKey && !event.ctrlKey;
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      inputProps?.onKeyDown?.(event);
      if (
        event.defaultPrevented ||
        composingRef.current ||
        event.nativeEvent.isComposing ||
        !shortcutMatches(event) ||
        !canSubmit
      ) {
        return;
      }
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    };

    const handleCompositionStart = (event: CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = true;
      inputProps?.onCompositionStart?.(event);
    };

    const handleCompositionEnd = (event: CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = false;
      inputProps?.onCompositionEnd?.(event);
    };

    const processFiles = useCallback(
      (files: readonly File[], source: PromptAttachmentSource) => {
        if (!attachmentsEnabled || disabled || files.length === 0) return;

        const latest = latestDraftRef.current;
        const acceptedAttachments: PromptAttachment[] = [];
        const rejections: PromptAttachmentRejection[] = [];
        const knownIds = new Set(latest.attachments.map((attachment) => attachment.id));
        const capacity = Math.max(0, attachmentLimit - latest.attachments.length);

        files.forEach((file) => {
          if (!acceptsFile(file, accept)) {
            rejections.push({
              file,
              reason: "type",
              message: copy.fileTypeRejected(file.name),
            });
            return;
          }
          if (maxFileSize != null && file.size > maxFileSize) {
            rejections.push({
              file,
              reason: "size",
              message: copy.fileTooLarge(file.name, formatFileSize(maxFileSize)),
            });
            return;
          }
          if (acceptedAttachments.length >= capacity) {
            rejections.push({
              file,
              reason: "limit",
              message: copy.attachmentLimit(attachmentLimit),
            });
            return;
          }

          try {
            const attachment = createAttachment(file);
            if (!attachment.id || knownIds.has(attachment.id)) {
              rejections.push({
                file,
                reason: "duplicate",
                message: copy.duplicateAttachment(file.name),
              });
              return;
            }
            knownIds.add(attachment.id);
            acceptedAttachments.push(attachment);
          } catch (creationError) {
            rejections.push({
              file,
              reason: "creation",
              message: copy.attachmentCreationFailed(
                file.name,
                errorMessage(creationError),
              ),
            });
          }
        });

        if (acceptedAttachments.length > 0) {
          resetLocalError();
          commitDraft(
            {
              ...latest,
              attachments: [...latest.attachments, ...acceptedAttachments],
            },
            "attachments-add",
          );
        }
        if (rejections.length > 0) {
          setInternalError(rejections.map((rejection) => rejection.message).join(" "));
          onAttachmentsRejected?.(rejections, source);
        }
        onAttachmentsAdd?.(acceptedAttachments, { source, rejections });
      },
      [
        accept,
        attachmentsEnabled,
        copy,
        commitDraft,
        createAttachment,
        disabled,
        attachmentLimit,
        maxFileSize,
        onAttachmentsAdd,
        onAttachmentsRejected,
        resetLocalError,
      ],
    );

    const removeAttachment = (attachment: PromptAttachment) => {
      if (disabled) return;
      const retryRequest = retryRequestsRef.current.get(attachment.id);
      retryRequest?.controller.abort();
      retryRequestsRef.current.delete(attachment.id);
      setRetryingIds((ids) => {
        if (!ids.has(attachment.id)) return ids;
        const next = new Set(ids);
        next.delete(attachment.id);
        return next;
      });
      resetLocalError();
      commitDraft(
        {
          ...latestDraftRef.current,
          attachments: latestDraftRef.current.attachments.filter(
            (candidate) => candidate.id !== attachment.id,
          ),
        },
        "attachment-remove",
      );
      onAttachmentRemove?.(attachment);
    };

    const retryAttachment = async (attachment: PromptAttachment) => {
      if (disabled || !onAttachmentRetry || retryRequestsRef.current.has(attachment.id)) {
        return;
      }
      const id = ++retrySequenceRef.current;
      const controller = new AbortController();
      retryRequestsRef.current.set(attachment.id, { id, controller });
      setRetryingIds((ids) => new Set(ids).add(attachment.id));
      setInternalError(undefined);

      try {
        const replacement = await onAttachmentRetry(attachment, {
          signal: controller.signal,
        });
        const active = retryRequestsRef.current.get(attachment.id);
        if (!mountedRef.current || active?.id !== id || controller.signal.aborted) return;
        const latest = latestDraftRef.current;
        const currentAttachment = latest.attachments.find(
          (candidate) => candidate.id === attachment.id,
        );
        if (!currentAttachment) return;
        const nextAttachment =
          replacement ??
          ({
            ...currentAttachment,
            status: "ready",
            error: undefined,
          } satisfies PromptAttachment);
        if (nextAttachment.id !== attachment.id) {
          throw new Error("A retried attachment must preserve its id.");
        }
        commitDraft(
          {
            ...latest,
            attachments: latest.attachments.map((candidate) =>
              candidate.id === attachment.id ? nextAttachment : candidate,
            ),
          },
          "attachment-retry",
        );
      } catch (retryError) {
        const active = retryRequestsRef.current.get(attachment.id);
        if (!mountedRef.current || active?.id !== id || controller.signal.aborted) return;
        setInternalError(errorMessage(retryError));
        onAttachmentRetryError?.(retryError, attachment);
      } finally {
        const active = retryRequestsRef.current.get(attachment.id);
        if (mountedRef.current && active?.id === id) {
          retryRequestsRef.current.delete(attachment.id);
          setRetryingIds((ids) => {
            const next = new Set(ids);
            next.delete(attachment.id);
            return next;
          });
        }
      }
    };

    const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
      inputProps?.onPaste?.(event);
      if (event.defaultPrevented || !attachmentsEnabled || disabled) return;
      const files = Array.from(event.clipboardData.files);
      if (files.length === 0) return;
      event.preventDefault();
      processFiles(files, "paste");
    };

    const hasProvidedError =
      error !== undefined && error !== null && error !== false && error !== "";
    const displayedError = hasProvidedError ? error : internalError;
    const effectiveRunStatus = stopPending ? "stopping" : runStatus;
    const activityLabel =
      submissionPending
        ? copy.sending
        : effectiveRunStatus === "streaming"
          ? copy.generating
          : effectiveRunStatus === "stopping"
            ? copy.stopping
            : undefined;
    const displayStatus =
      displayedError != null || submissionStatus === "error" || runStatus === "error"
        ? "error"
        : submissionPending
          ? "submitting"
          : effectiveRunStatus;
    const showStop =
      Boolean(onStop) &&
      (submissionPending || runStatus === "streaming" || effectiveRunStatus === "stopping");
    const describedBy = joinsIds(
      inputProps?.["aria-describedby"],
      descriptionId,
      counterId,
      displayedError != null ? errorId : undefined,
    );
    const autoSizeStyle: CSSProperties | undefined = autoSize
      ? {
          minHeight: "var(--vl-prompt-input-min-height)",
          maxHeight: "var(--vl-prompt-input-max-height)",
          height: "var(--vl-prompt-input-height)",
        }
      : undefined;
    const inputStyle = composeStyles(
      composeStyles(styles?.input, inputProps?.style),
      autoSizeStyle,
    );

    return (
      <form
        {...formProps}
        ref={ref}
        className={cx(componentClass, classNames?.root, className)}
        style={composeStyles(styles?.root, style)}
        onSubmit={handleSubmit}
        onDragEnter={(event) => {
          onDragEnter?.(event);
          if (event.defaultPrevented || !attachmentsEnabled || disabled || !isFileDrag(event)) {
            return;
          }
          event.preventDefault();
          dragDepthRef.current += 1;
          setDragging(true);
        }}
        onDragLeave={(event) => {
          onDragLeave?.(event);
          if (!attachmentsEnabled || !isFileDrag(event)) return;
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setDragging(false);
        }}
        onDragOver={(event) => {
          onDragOver?.(event);
          if (event.defaultPrevented || !attachmentsEnabled || disabled || !isFileDrag(event)) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          onDrop?.(event);
          dragDepthRef.current = 0;
          setDragging(false);
          if (event.defaultPrevented || !attachmentsEnabled || disabled || !isFileDrag(event)) {
            return;
          }
          event.preventDefault();
          processFiles(Array.from(event.dataTransfer.files), "drop");
        }}
        aria-busy={submissionPending || stopPending || undefined}
        data-slot="root"
        data-status={displayStatus}
        data-submission-status={submissionStatus}
        data-run-status={effectiveRunStatus}
        data-dragging={dragging ? "true" : "false"}
      >
        {label != null ? (
          <label
            htmlFor={inputId}
            className={cx("vl-prompt-composer__label", classNames?.label)}
            style={styles?.label}
            data-slot="label"
          >
            {label}
          </label>
        ) : null}
        {description != null ? (
          <div
            id={descriptionId}
            className={cx("vl-prompt-composer__description", classNames?.description)}
            style={styles?.description}
            data-slot="description"
          >
            {description}
          </div>
        ) : null}

        {currentDraft.attachments.length > 0 ? (
          <div
            className={cx("vl-prompt-composer__attachments", classNames?.attachments)}
            style={styles?.attachments}
            role="list"
            aria-label="Attachments"
            data-slot="attachments"
          >
            {currentDraft.attachments.map((attachment) => {
              const retrying = retryingIds.has(attachment.id);
              const retry = onAttachmentRetry
                ? () => {
                    void retryAttachment(attachment);
                  }
                : undefined;
              return (
                <div
                  key={attachment.id}
                  className={cx("vl-prompt-composer__attachment", classNames?.attachment)}
                  style={styles?.attachment}
                  role="listitem"
                  data-slot="attachment"
                  data-status={attachment.status ?? "ready"}
                >
                  {renderAttachment?.(attachment, {
                    remove: () => removeAttachment(attachment),
                    retry,
                    retrying,
                  }) ?? (
                    <>
                      <span
                        className={cx(
                          "vl-prompt-composer__attachment-name",
                          classNames?.attachmentName,
                        )}
                        style={styles?.attachmentName}
                        data-slot="attachmentName"
                      >
                        {attachment.file.name}
                      </span>
                      <span
                        className={cx(
                          "vl-prompt-composer__attachment-meta",
                          classNames?.attachmentMeta,
                        )}
                        style={styles?.attachmentMeta}
                        data-slot="attachmentMeta"
                      >
                        {attachment.status === "uploading"
                          ? copy.uploading
                          : attachment.status === "error"
                            ? attachment.error ?? copy.uploadFailed
                            : formatFileSize(attachment.file.size)}
                      </span>
                      {attachment.status === "error" && retry ? (
                        <button
                          type="button"
                          className={cx(
                            "vl-prompt-composer__attachment-retry",
                            classNames?.attachmentRetry,
                          )}
                          style={styles?.attachmentRetry}
                          onClick={retry}
                          disabled={disabled || retrying}
                          aria-label={resolvedRetryAttachmentLabel(attachment)}
                          data-slot="attachmentRetry"
                        >
                          {retrying ? "Retrying" : "Retry"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={cx(
                          "vl-prompt-composer__attachment-remove",
                          classNames?.attachmentRemove,
                        )}
                        style={styles?.attachmentRemove}
                        onClick={() => removeAttachment(attachment)}
                        disabled={disabled}
                        aria-label={resolvedRemoveAttachmentLabel(attachment)}
                        data-slot="attachmentRemove"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        <div
          className={cx("vl-prompt-composer__surface", classNames?.surface)}
          style={styles?.surface}
          data-slot="surface"
        >
          {leading != null ? (
            <div
              className={cx("vl-prompt-composer__leading", classNames?.leading)}
              style={styles?.leading}
              data-slot="leading"
            >
              {leading}
            </div>
          ) : null}
          <textarea
            {...inputProps}
            id={inputId}
            ref={(node) => {
              internalTextareaRef.current = node;
              if (typeof textareaRef === "function") textareaRef(node);
              else if (textareaRef) textareaRef.current = node;
            }}
            className={cx(
              "vl-prompt-composer__input",
              classNames?.input,
              inputProps?.className,
            )}
            style={inputStyle}
            value={currentDraft.text}
            placeholder={resolvedPlaceholder}
            disabled={disabled}
            maxLength={normalizedMaxLength}
            rows={normalizedMinRows}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            aria-label={
              inputProps?.["aria-label"] ?? (label == null ? resolvedPlaceholder : undefined)
            }
            aria-describedby={describedBy}
            aria-errormessage={displayedError != null ? errorId : undefined}
            aria-invalid={displayedError != null || inputProps?.["aria-invalid"] || undefined}
            data-slot="input"
          />
          <div
            className={cx("vl-prompt-composer__actions", classNames?.actions)}
            style={styles?.actions}
            data-slot="actions"
          >
            {tools != null ? (
              <div
                className={cx("vl-prompt-composer__tools", classNames?.tools)}
                style={styles?.tools}
                data-slot="tools"
              >
                {tools}
              </div>
            ) : null}
            {attachmentsEnabled ? (
              <>
                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  className={cx("vl-prompt-composer__file-input", classNames?.fileInput)}
                  style={styles?.fileInput}
                  type="file"
                  accept={accept}
                  multiple={attachmentLimit > 1}
                  disabled={disabled}
                  hidden
                  tabIndex={-1}
                  onChange={(event) => {
                    processFiles(Array.from(event.currentTarget.files ?? []), "picker");
                    event.currentTarget.value = "";
                  }}
                  data-slot="fileInput"
                />
                <button
                  type="button"
                  className={cx(
                    "vl-prompt-composer__attach",
                    classNames?.attachButton,
                  )}
                  style={styles?.attachButton}
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                      fileInputRef.current.click();
                    }
                  }}
                  disabled={disabled || currentDraft.attachments.length >= attachmentLimit}
                  aria-label={resolvedAttachmentLabel}
                  data-action="attach"
                  data-slot="attachButton"
                >
                  {attachmentIcon ?? <AttachmentIcon />}
                </button>
              </>
            ) : null}
            {showStop ? (
              <button
                className={cx(
                  "vl-prompt-composer__submit",
                  classNames?.submitButton,
                )}
                style={styles?.submitButton}
                type="button"
                onClick={() => void handleStop()}
                disabled={disabled || stopPending || runStatus === "stopping"}
                aria-label={resolvedStopLabel}
                data-action="stop"
                data-slot="submitButton"
              >
                {stopIcon ?? <StopIcon />}
              </button>
            ) : (
              <button
                className={cx(
                  "vl-prompt-composer__submit",
                  classNames?.submitButton,
                )}
                style={styles?.submitButton}
                type="submit"
                disabled={!canSubmit}
                aria-label={resolvedSubmitLabel}
                data-action="submit"
                data-slot="submitButton"
              >
                {submitIcon ?? <SendIcon />}
              </button>
            )}
          </div>
        </div>

        {footer != null || activityLabel != null || counterId != null ? (
          <div
            className={cx("vl-prompt-composer__footer", classNames?.footer)}
            style={styles?.footer}
            data-slot="footer"
          >
            <div>{footer}</div>
            <div
              className={cx("vl-prompt-composer__meta", classNames?.meta)}
              style={styles?.meta}
              data-slot="meta"
            >
              {activityLabel != null ? (
                <span
                  className={cx("vl-prompt-composer__status", classNames?.status)}
                  style={styles?.status}
                  data-slot="status"
                >
                  <StreamingIndicator size="small" label={activityLabel} />
                </span>
              ) : null}
              {counterId != null ? (
                <span
                  id={counterId}
                  className={cx("vl-prompt-composer__counter", classNames?.counter)}
                  style={styles?.counter}
                  data-slot="counter"
                >
                  {currentDraft.text.length}/{normalizedMaxLength}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {displayedError != null ? (
          <div
            id={errorId}
            className={cx("vl-prompt-composer__error", classNames?.error)}
            style={styles?.error}
            role="alert"
            aria-live="assertive"
            data-slot="error"
          >
            {displayedError}
          </div>
        ) : null}
      </form>
    );
  },
);
