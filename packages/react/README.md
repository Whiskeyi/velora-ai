# @velora-ai/react

[English](README.md) | [Chinese](README.zh-CN.md)

Provider-neutral React primitives for production AI conversations and agent workflows. Velora owns interaction mechanics—stream following, prompt drafts, async action states, approval controls, accessible announcements—while the application keeps authority over provider data and business state.

## Install

```bash
npm install @velora-ai/react
```

React and React DOM 18.3 or newer are peer dependencies. Import the stylesheet once from the application entry or root layout; the JavaScript entry has no CSS side effect.

```tsx
import "@velora-ai/react/styles.css";
```

Load the optional KaTeX font sheet only in products that render formulas or
math-enabled Markdown:

```tsx
import "@velora-ai/react/rich-content.css";
```

Rich output is available from the root and aggregate `rich-content` exports. For
route-level or feature-level code splitting, use the granular client subpaths so
loading a code block does not also make Markdown, KaTeX, or Mermaid part of the
same entry:

```tsx
import { CodeBlock } from "@velora-ai/react/rich-content/code-block";
import { Formula } from "@velora-ai/react/rich-content/formula";
import { MarkdownRenderer } from "@velora-ai/react/rich-content/markdown";
import { MermaidDiagram } from "@velora-ai/react/rich-content/mermaid";
```

The project site includes a live-editable workbench and a component API reference. The API reference groups components by foundation, workspace, messages, agent state, and generated content, then lists props, defaults, interaction contracts, and integration guidance.

## Component usage index

Velora separates components by responsibility without prescribing a backend, model provider, upload layer, or permission system.

| Component                  | Responsibility                                             | Integration focus                                                             |
| -------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `VeloraProvider`           | Theme, density, motion, and semantic tokens                | Wrap the AI surface once and override tokens at the product boundary          |
| `AgentShell`               | Session sidebar, conversation, composer, and inspector     | Keep state in the application; let the shell own mobile drawers               |
| `ConversationList`         | Session search, grouping, creation, and status             | Control `activeId` and share its value with `MessageList.conversationKey`      |
| `PromptComposer`           | Text, attachments, selectors, preflight, submit, and stop  | Return acceptance from `onSubmit`; upload files in the application layer      |
| `MessageList`              | Stream following, history prepend, activity, and windowing | Keep message IDs stable and enable `windowing` for long conversations          |
| `MessageBubble`            | Message shell, attachments, actions, branches, and footer  | Render rich content through `children` with `MarkdownRenderer`                 |
| `MessageActions`           | Copy, edit, regenerate, feedback, and async rollback       | Let the component own interaction state and the application own data mutation |
| `MessageBranchNavigator`   | Candidate response navigation                              | Control a zero-based `index`; keep branch content in application state         |
| `ReasoningPanel`           | Reasoning summary or trace disclosure and timing           | Prefer `contentMode="summary"` instead of exposing sensitive traces            |
| `AgentSteps`               | Step state, detail, timing, and retry                      | Preserve stable step IDs across backend events                                |
| `ToolCallCard`             | Tool arguments, risk, approval, execution, and retry       | Never treat UI approval as server authorization                               |
| `MarkdownRenderer`         | Progressive GFM, math, code, and Mermaid rendering         | Keep raw HTML disabled and stabilize incomplete streaming blocks               |
| `CodeBlock`                | Highlighting, copy, wrapping, collapse, and download       | Sanitize untrusted HTML returned by a custom highlighter                       |
| `Formula`                  | KaTeX inline/block rendering, copy, and fallback           | Keep bounded `maxSize` and `maxExpand` safety settings                         |
| `MermaidDiagram`           | Lazy rendering, zoom, source copy, and recovery            | Use strict security settings for untrusted diagrams                           |
| `StreamingIndicator`       | Generating, paused, progress, and completion feedback      | Place it near the pending content instead of blocking the whole surface        |

## A complete send lifecycle

`PromptComposer` exchanges a `PromptDraft`, not a string. `chat.send()` synchronously reports whether the run was accepted. An accepted result includes a separate `completion` Promise for terminal workflow side effects.

```tsx
"use client";

import { useState } from "react";
import {
  MarkdownRenderer,
  MessageBubble,
  MessageList,
  PromptComposer,
  VeloraProvider,
  createAgentRuntime,
  createSSETransport,
  useAgentChat,
  type AgentAttachment,
  type PromptAttachment,
  type PromptDraft,
  type PromptSubmitResult,
} from "@velora-ai/react";
import "@velora-ai/react/styles.css";
import "@velora-ai/react/rich-content.css";

const transport = createSSETransport({ url: "/api/agent" });

function toAgentAttachment(attachment: PromptAttachment): AgentAttachment {
  return {
    id: attachment.id,
    name: attachment.file.name,
    kind: attachment.file.type.startsWith("image/") ? "image" : "file",
    mimeType: attachment.file.type,
    size: attachment.file.size,
  };
}

export function Chat() {
  const chat = useAgentChat({ transport, conversationId: "product-copilot" });
  const [draft, setDraft] = useState<PromptDraft>({ text: "", attachments: [] });

  const submit = (nextDraft: PromptDraft): PromptSubmitResult => {
    const accepted = chat.send(nextDraft.text, {
      attachments: nextDraft.attachments.map(toAgentAttachment),
    });

    if (!accepted.accepted) {
      return {
        accepted: false,
        error:
          accepted.reason === "busy"
            ? "Wait for the current response to finish."
            : "Enter a message before sending.",
      };
    }

    // The composer can clear immediately. Use completion only for terminal
    // side effects such as analytics, navigation, or a completion toast.
    void accepted.completion.then(({ outcome }) => {
      console.info("Agent run settled", outcome);
    });
    return { accepted: true };
  };

  return (
    <VeloraProvider theme="system" locale="en-US">
      <MessageList
        messages={chat.messages}
        renderMessage={(message) => (
          <MessageBubble message={message}>
            <MarkdownRenderer
              content={message.content}
              streaming={message.status === "streaming"}
            />
          </MessageBubble>
        )}
      />
      <PromptComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={submit}
        runStatus={chat.isStreaming ? "streaming" : chat.status === "error" ? "error" : "idle"}
        onStop={() => {
          chat.stop();
        }}
        accept="image/*,.pdf,.txt"
        maxAttachments={6}
        maxFileSize={10 * 1024 * 1024}
      />
    </VeloraProvider>
  );
}
```

For runs that must survive route changes, create the runtime above the view and
pass it into each subscriber:

```tsx
const runtime = createAgentRuntime({ transport });

function Conversation({ id }: { id: string }) {
  const chat = useAgentChat({ runtime, transport, conversationId: id });
  // Unmounting this view does not stop the runtime. Call chat.stop() when the
  // workflow itself should end.
}
```

`ChatRequest.messages` uses the provider-facing `AgentRequestMessage` shape.
Velora excludes UI status, reasoning, steps, branches, and errors by default.
Each request carries a stable `requestId`, protocol version, and idempotency
header across reconnects.

`VeloraProvider` provides component-level internationalization as well as design
tokens. Set `locale="en-US"` or `locale="zh-CN"` once for built-in labels,
screen-reader announcements, placeholders, and action names. Use the typed
`messages` prop for product-specific partial overrides without copying the full
catalog.

Do not hold the composer submission open for the whole stream. `runStatus` is the source of truth for the stop button and generation state; `messages` is the source of truth for streamed output. `chat.stop()` synchronously aborts the active transport and returns whether a run was stopped. An application with a remote cancellation handshake can temporarily pass `runStatus="stopping"` while that handshake settles.

The attachment conversion above sends JSON-safe file descriptors, not file bytes. Upload binary data through the application's upload layer first, then include its durable URL or provider reference in the `AgentAttachment`. Client-only preview URLs are not server upload URLs. Attachments-only drafts are accepted when at least one durable attachment descriptor is present.

## Prompt drafts and attachments

`PromptDraft` contains `{ text, attachments }`. A `PromptAttachment` holds the browser `File`, a stable ID, optional preview URL, and an optional `ready | uploading | error` status. Uploading or failed attachments block submission. `onAttachmentRetry` receives an abort signal and protected async retry state; resolving without a value marks the current attachment ready, while returning a same-ID `PromptAttachment` replaces it with the consumer's authoritative upload result.

`PromptComposer` supports controlled state with `draft` + `onDraftChange`, or local state initialized through `defaultDraft`. Its interaction contract also includes:

- picker, drag/drop, and clipboard file intake with type, size, count, duplicate, and construction rejection reasons;
- IME-safe `enter`, `mod-enter`, or `button-only` submission shortcuts;
- autosizing rows, character limits, attachment rendering and retry hooks;
- synchronous acceptance or async preflight through `onSubmit`;
- snapshot clearing: an accepted submission removes only submitted attachments and does not erase newer text typed during an async preflight;
- separate `submitting`, `streaming`, `stopping`, and `error` UI states.

### Isolate drafts by conversation

`usePromptDrafts` keeps both text and attachments when the user changes sessions. Draft keys are application-defined, so the same hook also works for tabs, agents, or workspaces.

```tsx
import {
  PromptComposer,
  useAgentChat,
  usePromptDrafts,
  type PromptDraft,
  type PromptSubmitResult,
} from "@velora-ai/react";

function ConversationComposer({ activeId }: { activeId: string }) {
  const chat = useAgentChat({ transport, conversationId: activeId });
  const { getDraft, setDraft, clearDraft, clearAllDrafts } = usePromptDrafts();

  const submit = (draft: PromptDraft): PromptSubmitResult => {
    const result = chat.send(draft.text, {
      attachments: draft.attachments.map(toAgentAttachment),
    });
    return result.accepted
      ? { accepted: true }
      : { accepted: false, error: `Message rejected: ${result.reason}` };
  };

  return (
    <>
      <PromptComposer
        draft={getDraft(activeId)}
        onDraftChange={(next) => setDraft(activeId, next)}
        onSubmit={submit}
        runStatus={chat.isStreaming ? "streaming" : chat.status === "error" ? "error" : "idle"}
        onStop={() => {
          chat.stop();
        }}
      />
      <button type="button" onClick={() => clearDraft(activeId)}>
        Discard this draft
      </button>
      <button type="button" onClick={clearAllDrafts}>
        Discard every draft
      </button>
    </>
  );
}
```

When controlled, `PromptComposer` reports the accepted clear through `onDraftChange`, so the correct conversation draft is cleared without coupling it to message state.

## Messages as an interaction surface

`MessageBubble` exposes `attachments`, `branchNavigator`, `actions`, and `footer` slots as nodes or render functions. `MessageActions` manages duplicate-action locks, copy feedback, optimistic like/dislike rollback, success announcements, and error presentation. It does not regenerate or edit data by itself. `MessageBranchNavigator` controls a zero-based branch index; the application selects the matching response content.

```tsx
import {
  MarkdownRenderer,
  MessageActions,
  MessageBranchNavigator,
  MessageBubble,
} from "@velora-ai/react";

<MessageBubble
  message={message}
  branchNavigator={
    branches.length > 1 ? (
      <MessageBranchNavigator
        count={branches.length}
        index={branchIndex}
        onIndexChange={setBranchIndex}
      />
    ) : null
  }
  actions={(current, { terminal }) =>
    terminal ? (
      <MessageActions
        message={current}
        onRegenerate={async () => regenerate(current.id)}
        onEdit={async () => openEditor(current.id)}
        onFeedbackChange={async (feedback) => saveFeedback(current.id, feedback)}
        onActionError={reportActionError}
      />
    ) : null
  }
>
  <MarkdownRenderer content={branches[branchIndex]?.content ?? message.content} />
</MessageBubble>;
```

The branch navigator supports previous/next buttons plus Left, Right, Home, and End keys. Both primitives can be controlled when feedback or branch selection must follow routing or server state.

### Stream following and history prepend

`MessageList` follows token growth only while the reader remains within `followThreshold` of the bottom. Scrolling upward transfers control to the reader, counts changed messages, and reveals a “jump to latest” action. The scroll log is keyboard focusable, and activating the jump action moves focus to that stable region until the scroll reaches the bottom. `onReachStart` supports history loading; when older items are prepended before an otherwise unchanged ID sequence, the list preserves the visual scroll anchor, including later rich-content height changes.

```tsx
import { MessageList } from "@velora-ai/react";

<MessageList
  conversationKey={activeConversationId}
  messages={messages}
  followThreshold={96}
  reachStartThreshold={40}
  onFollowChange={setFollowing}
  windowing={{
    threshold: 200,
    estimateRowHeight: (message) => (message.toolCalls?.length ? 260 : 112),
    overscan: 8,
  }}
  onNewActivityCountChange={setUnreadUpdates}
  onReachStart={async () => {
    if (loadingHistory || !hasMore) return;
    const older = await loadOlderMessages();
    setMessages((current) => [...older, ...current]);
  }}
  onReachStartError={(error) => {
    setHistoryError(error instanceof Error ? error.message : "History could not be loaded");
  }}
  renderMessage={renderMessage}
/>;
```

Change `conversationKey` whenever `messages` switches to a different session or dataset. That atomically clears unseen activity, invalidates internal history-load bookkeeping, restores follow mode, and moves the new dataset to its latest message without announcing the replacement as new activity. Consumers should still cancel or scope their own network request by conversation. Rejected `onReachStart` promises call `onReachStartError` and rearm the top threshold for a later retry.

Use stable, unique message IDs. Keep the existing sequence and object references intact when prepending. Rows are shallowly memoized, so replace only changed message objects and keep `renderMessage` referentially stable. For very long histories, window through the render boundary rather than deleting source state.

## Agent process and approval

`ToolCallCard` renders draft, approval, running, terminal, and retry states. It serializes arguments/results by default, locks concurrent actions, catches rejected handlers, and announces status changes. Its default `autoOpen="attention"` policy reveals newly entered approval/error states until the user manually toggles the card; controlled expansion remains application-owned. The application remains responsible for changing `status` and persisting the decision.

```tsx
import { ToolCallCard } from "@velora-ai/react";

<ToolCallCard
  toolName="deploy_preview"
  description="Publish the current build to a preview URL"
  arguments={{ branch: "feature/agent-ui" }}
  status={toolStatus}
  risk="high"
  onReject={() => setToolStatus("cancelled")}
  onApprove={async () => {
    setToolStatus("running");
    try {
      setToolResult(await deployPreview());
      setToolStatus("complete");
    } catch (error) {
      setToolError(error);
      setToolStatus("error");
      throw error;
    }
  }}
  result={toolResult}
  error={toolError}
  onRetry={retryTool}
/>;
```

An approval button is not an authorization boundary. Revalidate identity, scope, arguments, and policy on the server immediately before executing a tool, especially for high and critical risk actions.

`ReasoningPanel` models disclosure separately from reasoning status. `autoOpen="while-running"` follows the run until the user's first manual toggle; `startedAt` or `elapsedMs` drives duration without coupling content to a timer. `AgentSteps` accepts immutable `AgentStep[]`, auto-expands running/error detail, tracks live duration, and gives error/cancelled steps protected async retry actions.

```tsx
import { AgentSteps, ReasoningPanel } from "@velora-ai/react";

<ReasoningPanel status={reasoningStatus} startedAt={runStartedAt}>
  {reasoningText}
</ReasoningPanel>

<AgentSteps
  steps={steps}
  autoExpand="running-and-error"
  onRetry={async (step) => retryStep(step.id)}
  onRetryError={(error, step) => reportStepError(step.id, error)}
/>
```

## Rich output interaction

- `MarkdownRenderer` supports GFM, math, code, and Mermaid fences. During streaming, deferred mode keeps typing responsive and incomplete Mermaid fences stay as source until closed. Raw HTML is skipped by default.
- `CodeBlock` supports copy, wrap, collapse, download, custom actions, async highlighting, abort, error fallback, and retry. A highlighter can return a React node or `{ html }`.
- `Formula` renders HTML + MathML through KaTeX and can expose copy and parse-error UI.
- `MermaidDiagram` loads Mermaid on demand, serializes renders, caches up to 32 render tasks, and supports zoom, reset, source copy, render callbacks, and retry.

```tsx
import { CodeBlock, MermaidDiagram } from "@velora-ai/react";

<CodeBlock
  code={source}
  language="tsx"
  filename="AgentPanel.tsx"
  showWrapToggle
  collapsible
  collapseAfterLines={24}
  showDownload
/>

<MermaidDiagram
  chart={chart}
  title="Agent execution graph"
  interactive
  showCopySource
  renderError={(error, retry) => (
    <button type="button" onClick={retry}>Retry: {error.message}</button>
  )}
/>
```

`CodeBlock` treats `{ html }` from a consumer highlighter as trusted and does not sanitize it. Prefer React nodes, or sanitize provider/model/user-derived HTML before returning it. Honor the highlighter's `AbortSignal`. `MermaidDiagram` always overrides `securityLevel`, `startOnLoad`, and `suppressErrorRendering` with Velora's strict invariants; those keys are excluded from `SafeMermaidConfig`.

## Component map

| Area                | Primitives                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Layout and theme    | `AgentShell`, `VeloraProvider`                                                                        |
| Sessions and drafts | `ConversationList`, `usePromptDrafts`                                                                 |
| Conversation        | `MessageList`, `MessageBubble`, `MessageActions`, `MessageBranchNavigator`, `PromptComposer`          |
| Agent process       | `ReasoningPanel`, `AgentSteps`, `ToolCallCard`, `StreamingIndicator`                                  |
| Rich output         | `MarkdownRenderer`, `CodeBlock`, `Formula`, `MermaidDiagram`                                          |
| Runtime             | `createAgentRuntime`, `useAgentChat`, `createAgentStore`, `createSSETransport`, `createMockTransport` |

### Controlled state map

Provide the controlled prop when product state is authoritative; otherwise use the initial prop and observe the same change callback.

| Primitive / state               | Controlled                                 | Initial                                                  | Change callback                         |
| ------------------------------- | ------------------------------------------ | -------------------------------------------------------- | --------------------------------------- |
| `PromptComposer` draft          | `draft`                                    | `defaultDraft`                                           | `onDraftChange`                         |
| `ConversationList` session      | `activeId`                                 | `defaultActiveId`                                        | `onActiveChange`                        |
| `MessageActions` feedback       | `feedback`                                 | `defaultFeedback`                                        | `onFeedbackChange`                      |
| `MessageBranchNavigator` branch | `index`                                    | `defaultIndex`                                           | `onIndexChange`                         |
| `ReasoningPanel` disclosure     | `open`                                     | `defaultOpen`                                            | `onOpenChange`                          |
| `AgentSteps` disclosures        | `expandedStepIds`                          | `defaultExpandedStepIds`                                 | `onExpandedStepIdsChange`               |
| `ToolCallCard` disclosure       | `expanded`                                 | `defaultExpanded`                                        | `onExpandedChange`                      |
| `CodeBlock` wrapping            | `wrap`                                     | `defaultWrap`                                            | `onWrapChange`                          |
| `CodeBlock` collapse            | `collapsed`                                | `defaultCollapsed`                                       | `onCollapsedChange`                     |
| `MermaidDiagram` zoom           | `zoom`                                     | `defaultZoom`                                            | `onZoomChange`                          |
| `AgentShell` mobile panels      | `mobileSidebarOpen`, `mobileInspectorOpen` | `defaultMobileSidebarOpen`, `defaultMobileInspectorOpen` | matching `onMobile*OpenChange` callback |

## State, performance, and accessibility boundaries

- Runtime state belongs to an isolated headless runtime per surface/workspace; there is no package-global agent store. Use narrow selectors when reading its Zustand vanilla store directly.
- Treat conversations, messages, steps, and attachments as immutable. Stable identities allow memoized completed rows to stay out of the streaming render path.
- Text and reasoning deltas are batched at 16 ms by default. Use `streamBatchMs: 0` only for deterministic tests or an explicit immediate-update requirement.
- Mermaid is dynamically imported. Keep rich renderers outside the prompt keystroke path and test production traces with realistic token cadence and long output.
- Built-in interactive controls have keyboard paths, visible focus, status/error announcements, and reduced-motion behavior. Supply meaningful localized labels when replacing defaults or icons.
- `AgentShell` mobile drawers trap focus, make the background inert, close on Escape/backdrop, and restore trigger focus. Its breakpoints are container-based, so embedded surfaces respond to their own width.
- Stable `vl-*` classes and typed `classNames` / `styles` slots are public styling surfaces. Theme tokens are CSS custom properties supplied by `VeloraProvider`.

The package is MIT licensed and currently version `0.1.0`.
