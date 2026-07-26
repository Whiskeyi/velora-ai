// @ts-check
// Pure data module: consumed by both the browser showcase and Node verification.
/** @type {readonly import("./model").Sample[]} */
export const SHOWCASE_SAMPLES = [
  {
    key: "agent-shell",
    name: "AgentShell",
    eyebrow: "Layout",
    description:
      "A responsive agent workspace with isolated drafts, streaming turns, and interruption.",
    code: `const conversations = [
  { id: "plan", title: "Launch plan", messageIds: [], createdAt: 1, updatedAt: 2, metadata: { status: "idle" } },
  { id: "review", title: "Design review", messageIds: [], createdAt: 1, updatedAt: 2, metadata: { status: "unread" } },
];

const initialMessages = {
  plan: [{
    id: "plan-1", conversationId: "plan", role: "assistant",
    content: "I mapped the launch into three reversible phases.",
    status: "complete", createdAt: 1, updatedAt: 1,
  }],
  review: [{
    id: "review-1", conversationId: "review", role: "assistant",
    content: "The interaction review is ready for annotation.",
    status: "complete", createdAt: 1, updatedAt: 1,
  }],
};

function Demo() {
  const [activeId, setActiveId] = useState("plan");
  const [messageSets, setMessageSets] = useState(initialMessages);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const drafts = usePromptDrafts();
  const runRef = useRef(0);
  const active = conversations.find((item) => item.id === activeId);
  const messages = messageSets[activeId];

  useEffect(() => () => { runRef.current += 1; }, []);

  const stop = () => {
    runRef.current += 1;
    setRunning(false);
    setMessageSets((current) => ({
      ...current,
      [activeId]: current[activeId].map((message) =>
        message.status === "streaming"
          ? { ...message, status: "aborted", updatedAt: Date.now() }
          : message
      ),
    }));
  };

  const submit = (draft) => {
    if (running) return { accepted: false, error: "Wait for or stop the active response." };
    const now = Date.now();
    const sessionId = activeId;
    const responseId = "assistant-" + now;
    const content = draft.text.trim() || "Review the attached context.";
    setMessageSets((current) => ({
      ...current,
      [sessionId]: [...current[sessionId],
        { id: "user-" + now, conversationId: sessionId, role: "user", content, status: "complete", createdAt: now, updatedAt: now },
        { id: responseId, conversationId: sessionId, role: "assistant", content: "", status: "streaming", createdAt: now + 1, updatedAt: now + 1 },
      ],
    }));
    setRunning(true);
    const run = ++runRef.current;
    const chunks = ["I’m mapping the request", " into a reversible plan", " with clear approval boundaries."];
    chunks.forEach((chunk, index) => window.setTimeout(() => {
      if (runRef.current !== run) return;
      setMessageSets((current) => ({
        ...current,
        [sessionId]: current[sessionId].map((message) =>
          message.id === responseId
            ? { ...message, content: message.content + chunk, status: index === chunks.length - 1 ? "complete" : "streaming", updatedAt: Date.now() }
            : message
        ),
      }));
      if (index === chunks.length - 1) setRunning(false);
    }, 420 * (index + 1)));
    return { accepted: true };
  };

  return (
    <div className="live-demo">
      <div className="live-demo-toolbar">
        <output>Container-responsive · {active.title} · {messages.length} messages</output>
      </div>
      <div className="live-shell-frame">
        <AgentShell
          sidebar={
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onActiveChange={(id) => {
                if (running) stop();
                setActiveId(id);
                setSidebarOpen(false);
              }}
              searchable
              getStatus={(item) => item.id === activeId && running ? "streaming" : item.metadata.status === "unread" ? "unread" : "idle"}
            />
          }
          header={<strong>{active.title}</strong>}
          inspector={
            <div className="live-shell-inspector">
              <span>Selected session</span>
              <strong>{active.title}</strong>
              <small>{messages.length} messages in context</small>
            </div>
          }
          composer={
            <PromptComposer
              draft={drafts.getDraft(activeId)}
              onDraftChange={(next) => drafts.setDraft(activeId, next)}
              placeholder="Add a message or drop context…"
              runStatus={running ? "streaming" : "idle"}
              onSubmit={submit}
              onStop={() => { stop(); }}
            />
          }
          mobileSidebarOpen={sidebarOpen}
          onMobileSidebarOpenChange={setSidebarOpen}
          mobileInspectorOpen={inspectorOpen}
          onMobileInspectorOpenChange={setInspectorOpen}
        >
          <MessageList conversationKey={activeId} messages={messages} />
        </AgentShell>
      </div>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "velora-provider",
    name: "VeloraProvider",
    eyebrow: "Foundation",
    description: "A typed token boundary for theme, density, direction, and motion preferences.",
    code: `function Demo() {
  const [theme, setTheme] = useState("dark");
  const [density, setDensity] = useState("comfortable");
  const message = {
    id: "provider-message", conversationId: "provider", role: "assistant",
    content: "Tokens cascade through every Velora primitive.",
    status: "complete", createdAt: 1, updatedAt: 1,
  };

  return (
    <div className="live-demo">
      <div className="live-demo-toolbar">
        <button type="button" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>
          Theme: {theme}
        </button>
        <button type="button" onClick={() => setDensity((value) => value === "compact" ? "comfortable" : "compact")}>
          Density: {density}
        </button>
      </div>
      <VeloraProvider
        className="live-provider-card"
        theme={theme}
        density={density}
        tokens={{ accent: theme === "dark" ? "#8ea2ff" : "#365edc", radius: "20px" }}
      >
        <MessageBubble message={message} />
        <ReasoningPanel title="Token boundary" defaultOpen>
          Switch theme and density to see the same public components adapt.
        </ReasoningPanel>
      </VeloraProvider>
      <output className="live-demo-status">{theme} · {density}</output>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "conversation-list",
    name: "ConversationList",
    eyebrow: "Navigation",
    description: "Search, create, group, and track live session state without losing selection.",
    code: `const conversations = [
  { id: "launch", title: "Launch narrative", messageIds: [], createdAt: 1, updatedAt: 3, metadata: { preview: "Refining the story", meta: "Now", group: "Today" } },
  { id: "research", title: "Research synthesis", messageIds: [], createdAt: 1, updatedAt: 2, metadata: { preview: "12 sources connected", meta: "2 unread", group: "Today" } },
  { id: "runtime", title: "Runtime architecture", messageIds: [], createdAt: 1, updatedAt: 1, metadata: { preview: "Stream mapped", meta: "1h", group: "Earlier" } },
];

function Demo() {
  const [items, setItems] = useState(conversations);
  const [activeId, setActiveId] = useState("launch");
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState({ launch: "idle", research: "unread", runtime: "error" });
  const active = items.find((item) => item.id === activeId);

  const createConversation = () => {
    const id = "session-" + Date.now();
    setItems((current) => [{
      id, title: "Untitled session", messageIds: [], createdAt: Date.now(), updatedAt: Date.now(),
      metadata: { preview: "Ready for a first prompt", meta: "Now", group: "Today" },
    }, ...current]);
    setStatuses((current) => ({ ...current, [id]: "idle" }));
    setQuery("");
    setActiveId(id);
  };

  const simulateRun = () => {
    const sessionId = activeId;
    setStatuses((current) => ({ ...current, [sessionId]: "streaming" }));
    window.setTimeout(() => setStatuses((current) => ({ ...current, [sessionId]: "idle" })), 1600);
  };

  return (
    <div className="live-demo live-narrow">
      <div className="live-demo-toolbar">
        <button type="button" onClick={simulateRun}>Simulate response</button>
        <output>{statuses[activeId] || "idle"}</output>
      </div>
      <ConversationList
        conversations={items}
        activeId={activeId}
        onActiveChange={(id) => {
          setActiveId(id);
          setStatuses((current) => ({ ...current, [id]: "idle" }));
        }}
        searchable
        query={query}
        onQueryChange={setQuery}
        onCreate={createConversation}
        getDescription={(item) => item.metadata.preview}
        getMeta={(item) => item.metadata.meta}
        getStatus={(item) => statuses[item.id] || "idle"}
        groupBy={(item) => item.metadata.group}
      />
      <output className="live-demo-status">Active: {active ? active.title : "Filtered session"} · query “{query || "all"}”</output>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "prompt-composer",
    name: "PromptComposer",
    eyebrow: "Input",
    description:
      "A production-grade multimodal draft with models, tools, validation, attachments, and stop semantics.",
    code: `function Demo() {
  const [draft, setDraft] = useState({ text: "Explain the stream lifecycle", attachments: [] });
  const [runStatus, setRunStatus] = useState("idle");
  const [result, setResult] = useState("Ready · drop, paste, or pick a file");
  const [model, setModel] = useState("velora-pro");
  const [tool, setTool] = useState("search");
  const [rejectNext, setRejectNext] = useState(false);
  const finishTimer = useRef(null);

  useEffect(() => () => {
    if (finishTimer.current) clearTimeout(finishTimer.current);
  }, []);

  const tools = (
    <>
      <select aria-label="Model" value={model} onChange={(event) => setModel(event.currentTarget.value)}>
        <option value="velora-pro">Velora Pro</option>
        <option value="velora-fast">Velora Fast</option>
        <option value="local">Local model</option>
      </select>
      <select aria-label="Tool" value={tool} onChange={(event) => setTool(event.currentTarget.value)}>
        <option value="search">Web search</option>
        <option value="code">Code runner</option>
        <option value="none">No tools</option>
      </select>
    </>
  );

  return (
    <div className="live-demo live-composer-demo">
      <div className="live-demo-toolbar">
        <button type="button" aria-pressed={rejectNext} onClick={() => setRejectNext((value) => !value)}>
          {rejectNext ? "Next send will be rejected" : "Test rejected send"}
        </button>
        <output>{model} · {tool}</output>
      </div>
      <PromptComposer
        draft={draft}
        onDraftChange={setDraft}
        runStatus={runStatus}
        placeholder="Ask Velora anything…"
        maxLength={240}
        minRows={2}
        maxRows={6}
        accept="image/*,.pdf,.md,.txt"
        maxFileSize={5 * 1024 * 1024}
        maxAttachments={4}
        tools={tools}
        footer={<span>{runStatus === "streaming" ? "Receiving SSE events" : "Enter · Shift+Enter for newline"}</span>}
        createAttachment={(file) => ({
          id: file.name + "-" + file.lastModified,
          file,
          status: file.name.toLowerCase().includes("broken") ? "error" : "ready",
          error: file.name.toLowerCase().includes("broken") ? "Upload interrupted" : undefined,
        })}
        onAttachmentsAdd={(_attachments, context) => setResult("Added from " + context.source)}
        onAttachmentsRejected={(items, source) => setResult(items.length + " file rejected from " + source)}
        onAttachmentRetry={async (attachment) => {
          setResult("Retrying " + attachment.file.name);
          await new Promise((resolve) => setTimeout(resolve, 700));
          setDraft((current) => ({
            ...current,
            attachments: current.attachments.map((item) => item.id === attachment.id ? { ...item, status: "ready", error: undefined } : item),
          }));
          setResult(attachment.file.name + " is ready");
        }}
        onSubmit={async (next) => {
          setResult("Validating draft and permissions…");
          await new Promise((resolve) => setTimeout(resolve, 650));
          if (rejectNext) {
            setRejectNext(false);
            setResult("Draft preserved after rejection");
            return { accepted: false, error: "Workspace policy rejected this test request." };
          }
          setRunStatus("streaming");
          setResult("Accepted by " + model + " with " + tool + " · " + next.attachments.length + " files");
          finishTimer.current = setTimeout(() => {
            setRunStatus("idle");
            setResult("Response completed");
          }, 2400);
          return { accepted: true };
        }}
        onStop={() => {
          if (finishTimer.current) clearTimeout(finishTimer.current);
          setRunStatus("idle");
          setResult("Generation stopped by you");
        }}
      />
      <output className="live-demo-status" aria-live="polite">{result}</output>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "message-bubble",
    name: "MessageBubble",
    eyebrow: "Messages",
    description:
      "Compose message content with attachments, response branches, actions, and terminal state.",
    code: `const roles = ["assistant", "user", "tool"];
const statuses = ["complete", "streaming", "queued", "error"];
const responses = [
  "I’d make the approval boundary visible before the tool begins.",
  "I’d keep the primary task stable and reveal tool details on demand.",
  "I’d stage the change as a reversible preview before applying it.",
];

function Demo() {
  const [roleIndex, setRoleIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [branch, setBranch] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [event, setEvent] = useState("Actions are ready");
  const role = roles[roleIndex];
  const status = statuses[statusIndex];
  const message = {
    id: "role-demo", conversationId: "roles", role, status,
    content: role === "user" ? "Make the response more concise." : role === "tool" ? "Search returned 12 sources." : responses[branch],
    createdAt: 1_752_790_760_000, updatedAt: Date.now(),
    error: status === "error" ? { message: "The model connection was interrupted.", retryable: true } : undefined,
  };

  return (
    <div className="live-demo live-message">
      <div className="live-demo-toolbar">
        <button type="button" onClick={() => setRoleIndex((value) => (value + 1) % roles.length)}>
          Role: {role}
        </button>
        <button type="button" onClick={() => setStatusIndex((value) => (value + 1) % statuses.length)}>
          Status: {status}
        </button>
      </div>
      <MessageBubble
        message={message}
        showTimestamp
        attachments={role === "user" ? <span>brief.pdf · 1.4 MB</span> : undefined}
        branchNavigator={role === "assistant" ? (
          <MessageBranchNavigator count={responses.length} index={branch} onIndexChange={setBranch} />
        ) : undefined}
        actions={(
          <MessageActions
            message={message}
            feedback={feedback}
            showFeedback={role === "assistant"}
            onRegenerate={role === "assistant" ? async () => {
              setEvent("Regenerating this branch…");
              await new Promise((resolve) => setTimeout(resolve, 650));
              setBranch((value) => (value + 1) % responses.length);
              setEvent("A new response branch is selected");
            } : undefined}
            onFeedbackChange={async (next) => {
              await new Promise((resolve) => setTimeout(resolve, 450));
              setFeedback(next);
              setEvent(next ? "Feedback saved: " + next : "Feedback cleared");
            }}
          />
        )}
        footer={<span>Grounded in 12 workspace sources</span>}
      />
      <output className="live-demo-status">{role} · {status} · {event}</output>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "message-actions",
    name: "MessageActions",
    eyebrow: "Messages",
    description:
      "Copy, edit, regenerate, and persist feedback with pending, success, and rollback states.",
    code: `function Demo() {
  const [content, setContent] = useState("The safest default is a reversible preview before execution.");
  const [feedback, setFeedback] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [revision, setRevision] = useState(1);
  const [failDislike, setFailDislike] = useState(true);
  const [event, setEvent] = useState("Choose an action");
  const message = {
    id: "action-message", conversationId: "actions", role: "assistant",
    content, status: "complete", createdAt: 1, updatedAt: revision,
  };

  return (
    <div className="live-demo live-message">
      <MessageBubble
        message={message}
        actions={(
          <MessageActions
            message={message}
            feedback={feedback}
            onCopy={(_message, success) => setEvent(success ? "Copied response" : "Clipboard unavailable")}
            onEdit={async () => {
              await new Promise((resolve) => setTimeout(resolve, 450));
              setDraft(content);
              setEditing(true);
              setEvent("Editor opened");
            }}
            onRegenerate={async () => {
              setEvent("Requesting a new response…");
              await new Promise((resolve) => setTimeout(resolve, 900));
              setRevision((value) => value + 1);
              setContent("Revision " + (revision + 1) + " makes the approval boundary explicit and reversible.");
              setEvent("New response received");
            }}
            onFeedbackChange={async (next) => {
              await new Promise((resolve) => setTimeout(resolve, 700));
              if (next === "dislike" && failDislike) {
                setFailDislike(false);
                throw new Error("Feedback service is offline; your selection was rolled back.");
              }
              setFeedback(next);
              setEvent(next ? "Feedback persisted: " + next : "Feedback cleared");
            }}
            onActionError={(error) => setEvent(error.message)}
          />
        )}
      />
      {editing ? (
        <div className="live-demo-toolbar">
          <input aria-label="Edit response" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />
          <button type="button" onClick={() => { setContent(draft); setEditing(false); setEvent("Edit applied"); }}>Save</button>
          <button type="button" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : null}
      <output className="live-demo-status" aria-live="polite">{event} · revision {revision}</output>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "message-branch-navigator",
    name: "MessageBranchNavigator",
    eyebrow: "Messages",
    description:
      "Navigate alternative model responses and create a new branch without replacing history.",
    code: `const initialBranches = [
  "Option A · keep the action inline and ask for approval at the last responsible moment.",
  "Option B · open a review sheet with the exact diff before execution.",
  "Option C · create a sandbox preview and let the user promote it when ready.",
];

function Demo() {
  const [branches, setBranches] = useState(initialBranches);
  const [index, setIndex] = useState(0);
  const [event, setEvent] = useState("Use arrows, Home, End, or the controls");
  const message = {
    id: "branch-" + index, conversationId: "branches", role: "assistant",
    content: branches[index], status: "complete", createdAt: 1, updatedAt: index + 1,
  };

  const regenerate = async () => {
    setEvent("Generating another branch…");
    await new Promise((resolve) => setTimeout(resolve, 900));
    setBranches((current) => {
      const next = [...current, "Option " + String.fromCharCode(65 + current.length) + " · stage the change as a checkpointed workflow."];
      setIndex(next.length - 1);
      return next;
    });
    setEvent("New branch added without replacing earlier responses");
  };

  return (
    <div className="live-demo live-message">
      <MessageBubble
        key={message.id}
        message={message}
        branchNavigator={(
          <MessageBranchNavigator
            count={branches.length}
            index={index}
            onIndexChange={(next) => { setIndex(next); setEvent("Viewing branch " + (next + 1)); }}
          />
        )}
        actions={<MessageActions message={message} showFeedback={false} onRegenerate={regenerate} />}
        footer={<span>Every branch preserves the same user parent message</span>}
      />
      <output className="live-demo-status" aria-live="polite">{event} · {index + 1}/{branches.length}</output>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "message-list",
    name: "MessageList",
    eyebrow: "Messages",
    description:
      "Stream deltas, preserve reading position, load history, and surface unseen activity.",
    code: `const initialMessages = Array.from({ length: 10 }, (_, index) => ({
  id: \`message-\${index}\`,
  conversationId: "follow-demo",
  role: index % 2 ? "assistant" : "user",
  content: index % 2 ? \`Response \${index}: Each delta is batched before React commits the update.\` : \`Question \${index}: How does auto-follow preserve my reading position?\`,
  status: "complete",
  createdAt: index + 1,
  updatedAt: index + 1,
}));

function Demo() {
  const [messages, setMessages] = useState(initialMessages);
  const [following, setFollowing] = useState(true);
  const [newActivity, setNewActivity] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [running, setRunning] = useState(false);
  const listRef = useRef(null);
  const streamRef = useRef({ id: 0, timer: null });

  useEffect(() => () => {
    if (streamRef.current.timer) clearInterval(streamRef.current.timer);
  }, []);

  const startStream = () => {
    if (running) return;
    const now = Date.now();
    const responseId = "stream-" + now;
    setMessages((current) => [...current, {
      id: responseId, conversationId: "follow-demo", role: "assistant",
      content: "", status: "streaming", createdAt: now, updatedAt: now,
    }]);
    setRunning(true);
    const runId = streamRef.current.id + 1;
    streamRef.current.id = runId;
    const chunks = ["New activity", " stays out of your way", " while you read history", "—then waits behind Jump to latest."];
    let cursor = 0;
    streamRef.current.timer = setInterval(() => {
      if (streamRef.current.id !== runId) return;
      const chunk = chunks[cursor];
      cursor += 1;
      setMessages((current) => current.map((message) => message.id === responseId ? {
        ...message,
        content: message.content + chunk,
        status: cursor === chunks.length ? "complete" : "streaming",
        updatedAt: Date.now(),
      } : message));
      if (cursor === chunks.length) {
        clearInterval(streamRef.current.timer);
        streamRef.current.timer = null;
        setRunning(false);
      }
    }, 520);
  };

  const stopStream = () => {
    streamRef.current.id += 1;
    if (streamRef.current.timer) clearInterval(streamRef.current.timer);
    streamRef.current.timer = null;
    setRunning(false);
    setMessages((current) => current.map((message) => message.status === "streaming" ? {
      ...message, status: "aborted", updatedAt: Date.now(),
    } : message));
  };

  const loadHistory = async () => {
    if (loadingHistory) return;
    setLoadingHistory(true);
    setHistoryError("");
    try {
      await new Promise((resolve) => setTimeout(resolve, 650));
      setMessages((current) => [0, 1, 2].map((index) => ({
        id: "history-" + Date.now() + "-" + index,
        conversationId: "follow-demo",
        role: index % 2 ? "assistant" : "user",
        content: "Earlier context " + (index + 1) + " loaded without moving the reading anchor.",
        status: "complete", createdAt: -index - 3, updatedAt: -index - 3,
      })).concat(current));
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="live-demo live-message-list-demo">
      <div className="live-demo-toolbar">
        <button type="button" onClick={() => listRef.current?.scrollTo({ top: 0, behavior: "smooth" })}>
          Read earlier
        </button>
        <button type="button" onClick={running ? stopStream : startStream}>{running ? "Stop stream" : "Stream answer"}</button>
        <output>
          {historyError ||
            (loadingHistory
              ? "Loading history…"
              : following
                ? "Following latest"
                : newActivity + " unseen updates")}
        </output>
      </div>
      <MessageList
        ref={listRef}
        className="live-follow-list"
        conversationKey="follow-demo"
        messages={messages}
        autoScroll
        followThreshold={24}
        onFollowChange={setFollowing}
        onNewActivityCountChange={setNewActivity}
        onReachStart={loadHistory}
        windowing={{ threshold: 200, estimateRowHeight: 112, overscan: 8 }}
        onReachStartError={(error) =>
          setHistoryError(error instanceof Error ? error.message : "History could not be loaded")
        }
        formatNewActivityLabel={(count) => "Return to answer · " + count + " updates"}
      />
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "reasoning-panel",
    name: "ReasoningPanel",
    eyebrow: "Agent state",
    description:
      "Auto-open active reasoning, time the run, preserve manual intent, and expose recoverable failure.",
    code: `function Demo() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [startedAt, setStartedAt] = useState(undefined);
  const [attempt, setAttempt] = useState(0);

  const start = () => {
    setAttempt((value) => value + 1);
    setStartedAt(Date.now());
    setStatus("running");
  };

  return (
    <div className="live-demo live-narrow">
      <div className="live-demo-toolbar">
        <button type="button" onClick={start}>{status === "error" ? "Retry reasoning" : "Start reasoning"}</button>
        <button type="button" disabled={status !== "running"} onClick={() => setStatus("complete")}>Complete</button>
        <button type="button" disabled={status !== "running"} onClick={() => setStatus("error")}>Fail</button>
        <output>{status} · {open ? "expanded" : "collapsed"}</output>
      </div>
      <ReasoningPanel
        title="Working notes"
        description={status === "error" ? "Source inspection was interrupted" : "Accessibility and interaction checks"}
        status={status}
        startedAt={startedAt}
        elapsedUpdateInterval={200}
        formatElapsed={(elapsed) => (elapsed / 1000).toFixed(1) + "s"}
        autoOpen="while-running"
        open={open}
        onOpenChange={setOpen}
      >
        {status === "error"
          ? "The trace is preserved. Retry without losing the evidence gathered so far."
          : "Attempt " + attempt + ": map intent, inspect evidence, compare interaction patterns, then verify keyboard and interruption paths."}
      </ReasoningPanel>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "agent-steps",
    name: "AgentSteps",
    eyebrow: "Agent state",
    description:
      "Track live duration, waiting states, failure details, expansion, and asynchronous retry.",
    code: `function createSteps() {
  const now = Date.now();
  return [
    { id: "intent", title: "Understand intent", description: "Extract constraints", detail: "Mapped seven interface and runtime requirements.", status: "complete", startedAt: now - 1900, completedAt: now - 900 },
    { id: "patterns", title: "Compare patterns", description: "Review precedents", detail: "Approval is required before searching private sources.", status: "error", startedAt: now - 850, completedAt: now - 120, error: { message: "Private source access was denied." } },
    { id: "compose", title: "Compose response", description: "Build the surface", detail: "Waiting for the evidence step.", status: "pending" },
  ];
}

function Demo() {
  const [steps, setSteps] = useState(createSteps);
  const [expanded, setExpanded] = useState([]);
  const [failRetry, setFailRetry] = useState(true);
  const [event, setEvent] = useState("The failed step auto-expands");

  const retry = async (step) => {
    setEvent("Retrying " + step.title + "…");
    await new Promise((resolve) => setTimeout(resolve, 850));
    if (failRetry) {
      setFailRetry(false);
      throw new Error("Approval token expired. Retry once more.");
    }
    const completedAt = Date.now();
    setSteps((current) => current.map((item) => item.id === step.id
      ? { ...item, status: "complete", error: undefined, completedAt }
      : item.id === "compose"
        ? { ...item, status: "running", startedAt: completedAt }
        : item));
    setEvent("Recovery succeeded; composition is running");
  };

  const finish = () => {
    const completedAt = Date.now();
    setSteps((current) => current.map((step) => step.status === "running" ? { ...step, status: "complete", completedAt } : step));
    setEvent("Run complete");
  };

  return (
    <div className="live-demo live-narrow">
      <div className="live-demo-toolbar">
        <button type="button" onClick={() => { setSteps(createSteps()); setFailRetry(true); setEvent("Run reset"); }}>Reset run</button>
        <button type="button" onClick={finish}>Complete active step</button>
      </div>
      <AgentSteps
        steps={steps}
        expandedStepIds={expanded}
        onExpandedStepIdsChange={setExpanded}
        autoExpand="running-and-error"
        durationUpdateInterval={200}
        onRetry={retry}
        onRetryError={(error) => setEvent(error.message)}
        renderDetail={(step, context) => (
          <span>{step.detail} · {context.duration === undefined ? "not started" : Math.round(context.duration) + "ms"}</span>
        )}
      />
      <output className="live-demo-status" aria-live="polite">{event} · {expanded.length} expanded</output>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "code-block",
    name: "CodeBlock",
    eyebrow: "Content",
    description:
      "Recover async highlighting and let users wrap, collapse, copy, or download generated code.",
    code: `const source = Array.from({ length: 22 }, (_, index) =>
  index === 0
    ? "export async function runAgent(prompt: string) {"
    : index === 21
      ? "}"
      : '  const checkpoint' + index + ' = await agent.step("phase-' + index + '", prompt);'
).join("\\n");

function Demo() {
  const [event, setEvent] = useState("The first highlight intentionally fails");
  const [wrapped, setWrapped] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const firstAttempt = useRef(true);
  const highlighter = useCallback(async (value, _language, { signal }) => {
    setEvent("Highlighting asynchronously…");
    await new Promise((resolve) => setTimeout(resolve, 420));
    if (signal.aborted) return value;
    if (firstAttempt.current) {
      firstAttempt.current = false;
      throw new Error("Highlighter worker failed to initialize.");
    }
    setEvent("Highlighting complete");
    const keywords = ["const", "await", "return"];
    return <>{value.split(/(const|await|return)/g).map((part, index) =>
      keywords.includes(part)
        ? <span key={index} style={{ color: "#b8a1ff" }}>{part}</span>
        : part
    )}</>;
  }, []);

  return (
    <div className="live-demo live-message">
      <CodeBlock
        code={source}
        language="tsx"
        filename="AgentSurface.tsx"
        highlighter={highlighter}
        showWrapToggle
        wrap={wrapped}
        onWrapChange={setWrapped}
        collapsible
        collapseAfterLines={8}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        showDownload
        downloadFilename="AgentSurface.tsx"
        onDownload={(_value, filename) => setEvent("Downloaded " + filename)}
        onCopy={(_value, success) => setEvent(success ? "Copied to clipboard" : "Clipboard unavailable")}
        onHighlightError={(error) => setEvent(error.message + " Use Retry highlighting.")}
      />
      <output className="live-demo-status" aria-live="polite">{event} · {wrapped ? "wrapped" : "scrolling"} · {collapsed ? "collapsed" : "expanded"}</output>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "formula",
    name: "Formula",
    eyebrow: "Content",
    description:
      "Switch inline/display math, copy source, and recover from strict KaTeX parse failures.",
    code: `function Demo() {
  const [invalid, setInvalid] = useState(false);
  const [displayMode, setDisplayMode] = useState(true);
  const [align, setAlign] = useState("start");
  const [event, setEvent] = useState("HTML + MathML ready");
  const formula = invalid
    ? String.raw\`\\definitelyUnknown{1\`
    : String.raw\`\\int_0^1 x^2 \\, dx = \\frac{1}{3}\`;

  return (
    <div className="live-demo live-formula-demo">
      <div className="live-demo-toolbar">
        <button type="button" onClick={() => setInvalid((value) => !value)}>
          {invalid ? "Render valid formula" : "Trigger parse error"}
        </button>
        <button type="button" onClick={() => setDisplayMode((value) => !value)}>
          {displayMode ? "Use inline mode" : "Use display mode"}
        </button>
        <button type="button" onClick={() => setAlign((value) => value === "start" ? "center" : value === "center" ? "end" : "start")}>
          Align: {align}
        </button>
        <output>{invalid ? "Error fallback" : displayMode ? "Display math · " + align : "Inline math"}</output>
      </div>
      <div className="live-formula-stage">
        <Formula
          formula={formula}
          displayMode={displayMode}
          align={align}
          options={{ throwOnError: true }}
          showCopy
          onCopy={(_source, success) => setEvent(success ? "LaTeX copied" : "Clipboard unavailable")}
          renderError={(error, source) => <span className="live-demo-error">Could not render {source}: {error.message}</span>}
        />
      </div>
      <output className="live-demo-status" aria-live="polite">{event}</output>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "mermaid-diagram",
    name: "MermaidDiagram",
    eyebrow: "Content",
    description:
      "Secure lazy rendering with retry, source copy, and controlled zoom for dense agent diagrams.",
    code: `const charts = {
  stream: ["flowchart LR", "SSE[SSE] --> Runtime[Agent runtime]", "Runtime --> UI[React UI]"].join("\\n"),
  loop: ["sequenceDiagram", "User->>Agent: Prompt", "Agent-->>User: Stream deltas"].join("\\n"),
  error: "",
};

function Demo() {
  const [mode, setMode] = useState("stream");
  const [status, setStatus] = useState("Rendering stream diagram…");
  const [zoom, setZoom] = useState(1);
  const [align, setAlign] = useState("start");
  const choose = (next) => {
    setMode(next);
    setZoom(1);
    setStatus(next === "error" ? "Checking invalid definition…" : "Rendering diagram…");
  };

  return (
    <div className="live-demo live-message live-mermaid-demo">
      <div className="live-demo-toolbar">
        <button type="button" onClick={() => choose("stream")}>Event path</button>
        <button type="button" onClick={() => choose("loop")}>Sequence</button>
        <button type="button" onClick={() => choose("error")}>Show error</button>
        <button type="button" onClick={() => setAlign((value) => value === "start" ? "center" : "start")}>
          Align: {align}
        </button>
      </div>
      <MermaidDiagram
        title={mode === "loop" ? "Prompt sequence" : "Streaming event path"}
        chart={charts[mode]}
        align={align}
        config={{ theme: "dark" }}
        interactive
        zoom={zoom}
        minZoom={0.65}
        maxZoom={1.75}
        zoomStep={0.2}
        onZoomChange={(next) => { setZoom(next); setStatus("Zoom " + Math.round(next * 100) + "%"); }}
        showCopySource
        onCopySource={(_source, success) => setStatus(success ? "Diagram source copied" : "Clipboard unavailable")}
        onRender={() => setStatus("Diagram ready")}
        onError={() => setStatus("Render blocked safely")}
        renderError={(error, retry) => (
          <div className="live-demo-error">
            <span>{error.message}</span>
            <button type="button" onClick={() => { setMode("stream"); retry(); }}>Repair & retry</button>
          </div>
        )}
      />
      <output className="live-demo-status" aria-live="polite">{status} · {Math.round(zoom * 100)}%</output>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "markdown-renderer",
    name: "MarkdownRenderer",
    eyebrow: "Content",
    description:
      "Progressively render GFM, math, code, and an unfinished Mermaid fence without layout corruption.",
    code: `const chunks = [
  "### Streaming release check",
  "",
  "| Capability | State |",
  "| --- | --- |",
  "| GFM table | Ready |",
  "| Formula | $E = mc^2$ |",
  "",
  "- [x] Parse deltas",
  "- [x] Preserve reading position",
  "",
  "\`\`\`mermaid",
  "flowchart LR",
  "Prompt --> Stream --> Interface",
  "\`\`\`",
].join("\\n");

function Demo() {
  const lines = chunks.split("\\n");
  const [cursor, setCursor] = useState(2);
  const [streaming, setStreaming] = useState(true);

  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => setCursor((current) => {
      if (current >= lines.length) {
        setStreaming(false);
        return current;
      }
      return current + 1;
    }), 320);
    return () => clearInterval(timer);
  }, [streaming, lines.length]);

  const restart = () => {
    if (cursor >= lines.length) setCursor(2);
    setStreaming(true);
  };

  return (
    <div className="live-demo live-markdown-demo">
      <div className="live-demo-toolbar">
        <button type="button" onClick={streaming ? () => setStreaming(false) : restart}>
          {streaming ? "Pause deltas" : cursor >= lines.length ? "Replay stream" : "Resume deltas"}
        </button>
        <button type="button" onClick={() => { setCursor(lines.length); setStreaming(false); }}>Finish now</button>
        <output>{streaming ? "Receiving line " + cursor + "/" + lines.length : cursor >= lines.length ? "Response complete" : "Paused"}</output>
      </div>
      <MarkdownRenderer
        content={lines.slice(0, cursor).join("\\n")}
        streaming={streaming}
        streamingMode="immediate"
        stabilizeIncompleteBlocks
        codeBlockProps={{ showWrapToggle: true, collapsible: true, collapseAfterLines: 6, showDownload: true }}
        mermaidConfig={{ theme: "dark" }}
        mermaidProps={{ align: "start" }}
      />
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "streaming-indicator",
    name: "StreamingIndicator",
    eyebrow: "Feedback",
    description:
      "Represent indeterminate work or measurable progress with pause, completion, tone, and motion variants.",
    code: `function Demo() {
  const [active, setActive] = useState(true);
  const [visibleLabel, setVisibleLabel] = useState(true);
  const [variant, setVariant] = useState("wave");
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    if (!active || progress >= 100) return;
    const timer = setInterval(() => setProgress((current) => {
      const next = Math.min(100, current + 4);
      if (next === 100) setActive(false);
      return next;
    }), 320);
    return () => clearInterval(timer);
  }, [active, progress >= 100]);

  return (
    <div className="live-demo live-streaming-demo">
      <div className="live-demo-toolbar">
        <button type="button" onClick={() => setActive((value) => !value)}>
          {active ? "Pause" : "Start"}
        </button>
        <button type="button" onClick={() => setVisibleLabel((value) => !value)}>
          {visibleLabel ? "Hide label" : "Show label"}
        </button>
        <button type="button" onClick={() => setVariant((value) => value === "dots" ? "pulse" : value === "pulse" ? "wave" : "dots")}>
          Motion: {variant}
        </button>
        <button type="button" onClick={() => { setProgress(0); setActive(true); }}>Reset</button>
      </div>
      <div className="live-stream-state">
        <StreamingIndicator
          label={progress >= 100 ? "Generation complete" : active ? "Velora is composing" : "Generation paused"}
          visibleLabel={visibleLabel}
          variant={variant}
          tone={progress >= 100 ? "success" : active ? "accent" : "neutral"}
          active={active}
          progress={progress}
        />
      </div>
      <output className="live-demo-status">{progress}% · {progress >= 100 ? "Complete" : active ? "Active" : "Paused"} · label {visibleLabel ? "visible" : "screen reader only"}</output>
    </div>
  );
}

render(<Demo />);`,
  },
  {
    key: "tool-call-card",
    name: "ToolCallCard",
    eyebrow: "Agent state",
    description:
      "Review arguments, approve risk, observe execution, reject, and recover a failed tool call.",
    code: `function Demo() {
  const [status, setStatus] = useState("approval-required");
  const [risk, setRisk] = useState("high");
  const [expanded, setExpanded] = useState(true);
  const [failFirst, setFailFirst] = useState(true);
  const [event, setEvent] = useState("Review the exact mutation before approval");

  const approve = async () => {
    setEvent("Checking workspace permission…");
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (failFirst) {
      setFailFirst(false);
      throw new Error("Approval service timed out. Nothing was executed.");
    }
    setStatus("running");
    setEvent("Applying the reversible patch…");
    await new Promise((resolve) => setTimeout(resolve, 1100));
    setStatus("complete");
    setEvent("Patch applied with checkpoint checkpoint-42");
  };

  const reject = async () => {
    setEvent("Rejecting request…");
    await new Promise((resolve) => setTimeout(resolve, 550));
    setStatus("cancelled");
    setEvent("Tool call rejected; no side effect occurred");
  };

  const retry = async () => {
    setEvent("Recreating a safe approval request…");
    await new Promise((resolve) => setTimeout(resolve, 650));
    setStatus("approval-required");
    setEvent("Approval is ready again");
  };

  return (
    <div className="live-demo live-message">
      <div className="live-demo-toolbar">
        <button type="button" onClick={() => { setStatus("approval-required"); setFailFirst(true); setExpanded(true); setEvent("Approval reset"); }}>Reset approval</button>
        <button type="button" onClick={() => { setStatus("error"); setEvent("Tool process failed after launch"); }}>Simulate runtime error</button>
        <select aria-label="Risk level" value={risk} onChange={(event) => setRisk(event.currentTarget.value)}>
          <option value="low">Low risk</option>
          <option value="medium">Medium risk</option>
          <option value="high">High risk</option>
          <option value="critical">Critical risk</option>
        </select>
      </div>
      <ToolCallCard
        toolName="workspace.apply_patch"
        description="Updates two interaction contracts"
        arguments={{ files: ["PromptComposer.tsx", "MessageBubble.tsx"], reversible: true }}
        result={status === "complete" ? { checkpoint: "checkpoint-42", changedFiles: 2 } : undefined}
        error={status === "error" ? "Worker exited before committing the checkpoint." : undefined}
        status={status}
        risk={risk}
        expanded={expanded}
        onExpandedChange={setExpanded}
        confirmApproval={({ risk: currentRisk }) =>
          currentRisk === "low" ||
          window.confirm("Approve this " + currentRisk + "-risk tool call?")
        }
        onApprove={approve}
        onReject={reject}
        onRetry={retry}
        onActionError={(error) => setEvent(error.message)}
      />
      <output className="live-demo-status" aria-live="polite">{event} · {status}</output>
    </div>
  );
}

render(<Demo />);`,
  },
];
