import type { SampleKey } from "../component-registry";
import type { ComponentApiGroup, ComponentApiSpec, ComponentDoc, Localized } from "./model";

export const COMPONENT_DOCS: Record<SampleKey, Localized<ComponentDoc>> = {
  "agent-shell": {
    en: {
      eyebrow: "Layout",
      description:
        "A responsive agent workspace with isolated drafts, streaming turns, and interruption.",
      summary:
        "Use AgentShell as the outer interaction container when an AI surface needs a conversation rail, main transcript, composer, and optional inspector that all respond as one product surface.",
      useCases: [
        "AI workspaces with session navigation and a persistent prompt composer.",
        "Copilot panels that need mobile drawers without rewriting desktop layout.",
        "Agent tools that show a transcript beside contextual inspection or trace detail.",
      ],
      props: [
        "sidebar, header, inspector, composer: slot the product-owned regions without coupling data shape.",
        "mobileSidebarOpen/onMobileSidebarOpenChange: control the mobile drawer from routing or command menus.",
        "mobileInspectorOpen/onMobileInspectorOpenChange: keep the right panel predictable on small screens.",
        "sidebarLabel/inspectorLabel/contentRole: expose accessible landmarks without forcing page structure.",
      ],
      interactions: [
        "Mobile drawers use accessible labels, restore focus, and keep background content out of the tab order.",
        "Composer and transcript remain stable while the sidebar changes selection.",
        "Consumers can stop a running turn before switching conversations to avoid cross-session stream residue.",
      ],
      integration:
        "Pair it with ConversationList, MessageList, and PromptComposer; keep conversation state above the shell so routing, persistence, and authorization remain application-owned.",
    },
    zh: {
      eyebrow: "布局",
      description: "响应式智能体工作区，支持独立草稿、流式回合和中断。",
      summary:
        "当 AI 界面需要会话侧栏、主对话区、输入框和可选检查器时，用 AgentShell 作为外层交互容器，让这些区域像一个完整产品面一样协同响应。",
      useCases: [
        "带会话导航和常驻输入框的 AI 工作台。",
        "桌面是多栏、移动端是抽屉的 Copilot 面板。",
        "需要在对话旁展示工具上下文、执行轨迹或检查信息的 Agent 产品。",
      ],
      props: [
        "sidebar、header、inspector、composer：用 slot 接入业务区域，不绑定具体数据结构。",
        "mobileSidebarOpen/onMobileSidebarOpenChange：让路由或命令菜单控制移动端侧栏。",
        "mobileInspectorOpen/onMobileInspectorOpenChange：小屏下稳定控制右侧检查器。",
        "sidebarLabel/inspectorLabel/contentRole：暴露可访问区域，不强制页面结构。",
      ],
      interactions: [
        "移动端抽屉有可访问名称、焦点恢复，并会让背景内容退出 tab 顺序。",
        "侧栏切换时，对话区和输入框保持稳定，不产生布局跳动。",
        "切换会话前可先停止当前 run，避免流式输出残留到其他会话。",
      ],
      integration:
        "通常与 ConversationList、MessageList、PromptComposer 组合；会话状态放在 Shell 上层，路由、持久化和权限仍由业务应用负责。",
    },
  },
  "velora-provider": {
    en: {
      eyebrow: "Foundation",
      description: "A typed token boundary for theme, density, direction, and motion preferences.",
      summary:
        "VeloraProvider is the design-token and behavior boundary for every primitive. It keeps theme, density, motion, radius, colors, and typography consistent without injecting runtime styles.",
      useCases: [
        "Wrap one embedded AI panel or the whole application with the same component theme.",
        "Ship a polished default theme while exposing product-level tokens.",
        "Adapt density, text direction, and reduced-motion behavior consistently.",
      ],
      props: [
        "theme: light, dark, or system rendering.",
        "density: compact or comfortable spacing across primitives.",
        "tokens: override accent, surfaces, text, borders, radius, shadow, blur, and fonts.",
        "reducedMotion: force, disable, or respect system motion preferences.",
      ],
      interactions: [
        "Child components consume semantic tokens through CSS variables.",
        "Token updates re-theme the surface without remounting message state.",
        "Stable vl-* classes remain available for product-specific styling.",
      ],
      integration:
        "Import the stylesheet once, then place VeloraProvider close enough to the AI surface that product pages can have different themes when needed.",
    },
    zh: {
      eyebrow: "基础",
      description: "类型化 token 边界，用于主题、密度、方向和动效偏好。",
      summary:
        "VeloraProvider 是所有组件的设计 token 与行为边界。它统一主题、密度、动效、圆角、颜色和字体，同时不通过 JS 注入样式。",
      useCases: [
        "只包裹一个嵌入式 AI 面板，或包裹整个应用。",
        "默认就有精致主题，同时允许产品级 token 覆盖。",
        "统一处理紧凑密度、文本方向和减少动效偏好。",
      ],
      props: [
        "theme：light、dark 或 system。",
        "density：compact 或 comfortable，影响组件间距。",
        "tokens：覆盖强调色、表面、文本、边框、圆角、阴影、模糊和字体。",
        "reducedMotion：强制开启/关闭，或跟随系统偏好。",
      ],
      interactions: [
        "子组件通过 CSS 变量消费语义 token。",
        "token 更新会重新着色界面，不需要卸载消息状态。",
        "稳定的 vl-* class 仍可用于业务定制样式。",
      ],
      integration:
        "在应用入口导入一次样式，再把 VeloraProvider 放在 AI 界面附近；这样不同产品页可以拥有不同主题。",
    },
  },
  "conversation-list": {
    en: {
      eyebrow: "Navigation",
      description: "Search, create, group, and track live session state without losing selection.",
      summary:
        "ConversationList renders session navigation with controlled search, grouping, creation, metadata, and live status indicators while leaving persistence and routing to the app.",
      useCases: [
        "Chat products with many sessions and fast switching.",
        "Agent workspaces that need unread, streaming, idle, and error status.",
        "Local-first products that keep drafts and conversation metadata separately.",
      ],
      props: [
        "conversations/activeId/onActiveChange: keep selection controlled.",
        "searchable, query, onQueryChange: support internal or externally owned search state.",
        "deferFiltering/getSearchText: keep large lists responsive and define the searchable business text.",
        "onCreate: wire a new-session command into the list header.",
        "getDescription/getMeta/getStatus/groupBy: adapt any business data shape.",
      ],
      interactions: [
        "Search keeps the selected conversation stable when possible.",
        "Filtering can trail keystrokes without blocking input, and empty results remain start-aligned in reading flow.",
        "Create can clear the query and immediately select the new item.",
        "Status indicators separate unread, streaming, idle, and error feedback.",
      ],
      integration:
        "Use application IDs as the source of truth and pass the same active ID into MessageList as conversationKey so transcript state resets correctly.",
    },
    zh: {
      eyebrow: "导航",
      description: "支持搜索、新建、分组和实时会话状态，不丢失当前选择。",
      summary:
        "ConversationList 负责会话导航：受控搜索、分组、新建、元信息和实时状态标识；持久化和路由仍由应用负责。",
      useCases: [
        "会话很多、需要快速切换的聊天产品。",
        "需要 unread、streaming、idle、error 状态的 Agent 工作区。",
        "草稿和会话元数据分离管理的本地优先产品。",
      ],
      props: [
        "conversations/activeId/onActiveChange：让选择保持受控。",
        "searchable、query、onQueryChange：支持内部搜索或业务外部搜索状态。",
        "deferFiltering/getSearchText：让大列表输入保持流畅，并定义参与搜索的业务文本。",
        "onCreate：把新建会话命令接到列表头部。",
        "getDescription/getMeta/getStatus/groupBy：适配任意业务数据结构。",
      ],
      interactions: [
        "搜索时尽量保持当前选中会话稳定。",
        "过滤可以滞后于键入而不阻塞输入，空结果默认保持在阅读流起点。",
        "新建后可清空搜索并立即选中新会话。",
        "状态标识清楚区分未读、生成中、空闲和错误。",
      ],
      integration:
        "使用业务会话 ID 作为唯一真相，并把同一个 activeId 传给 MessageList 的 conversationKey，让对话滚动状态正确重置。",
    },
  },
  "prompt-composer": {
    en: {
      eyebrow: "Input",
      description:
        "A production-grade multimodal draft with models, tools, validation, attachments, and stop semantics.",
      summary:
        "PromptComposer treats input as a full draft, not a textarea string. It coordinates text, attachments, validation, async preflight, send acceptance, run state, and interruption.",
      useCases: [
        "Multimodal AI prompts with files, images, pasted context, and model/tool selectors.",
        "Agent surfaces where sending may be rejected by policy or permission preflight.",
        "Conversations that need per-session drafts while another turn is streaming.",
      ],
      props: [
        "draft/defaultDraft/onDraftChange: controlled or uncontrolled text plus attachments.",
        "onSubmit: return accepted synchronously or after async preflight; do not wait for the whole stream.",
        "runStatus/onStop: drive streaming, stopping, idle, and error controls.",
        "accept/maxFileSize/maxAttachments/createAttachment: own attachment intake and validation.",
      ],
      interactions: [
        "IME-safe Enter, mod-Enter, and button-only submission modes are supported.",
        "Rejected sends preserve the draft; accepted sends clear only the submitted snapshot.",
        "Upload/error attachments block submission until removed or retried.",
      ],
      integration:
        "Map ready PromptAttachment objects to upload URLs or provider file references before calling chat.send; keep binary upload authority in the product layer.",
    },
    zh: {
      eyebrow: "输入",
      description: "生产级多模态草稿，覆盖模型、工具、校验、附件和停止语义。",
      summary:
        "PromptComposer 把输入视为完整草稿，而不是一个 textarea 字符串。它协调文本、附件、校验、异步预检、发送接受态、运行态和中断。",
      useCases: [
        "带文件、图片、粘贴上下文、模型和工具选择的多模态提示词。",
        "发送前可能被策略或权限预检拒绝的 Agent 界面。",
        "生成过程中仍要保留不同会话草稿的对话产品。",
      ],
      props: [
        "draft/defaultDraft/onDraftChange：受控或非受控地管理文本和附件。",
        "onSubmit：同步或异步预检后返回 accepted；不要等完整流结束才返回。",
        "runStatus/onStop：驱动生成中、停止中、空闲和错误控制。",
        "accept/maxFileSize/maxAttachments/createAttachment：接管附件准入和校验。",
      ],
      interactions: [
        "支持 IME 安全的 Enter、mod-Enter 和仅按钮发送模式。",
        "拒绝发送会保留草稿；接受发送只清理当次提交快照。",
        "上传中或错误附件会阻止提交，直到移除或重试成功。",
      ],
      integration:
        "在调用 chat.send 前，把 ready 的 PromptAttachment 映射为上传 URL 或 provider 文件引用；二进制上传权限保留在业务层。",
    },
  },
  "message-bubble": {
    en: {
      eyebrow: "Messages",
      description:
        "Compose message content with attachments, response branches, actions, and terminal state.",
      summary:
        "MessageBubble is the structural unit for one user, assistant, tool, or system message. It provides slots for content, attachments, branch navigation, actions, footer metadata, and terminal state.",
      useCases: [
        "Rendering transcript rows with different roles and statuses.",
        "Adding citations, attachments, feedback, or branch controls around model output.",
        "Keeping rich Markdown output separate from message chrome.",
      ],
      props: [
        "message: the AgentMessage identity, role, status, content, and timestamps.",
        "children: override the body with MarkdownRenderer or custom content.",
        "attachments/actions/branchNavigator/footer: compose adjacent interaction surfaces.",
        "showTimestamp/formatTimestamp/statusLabels: expose terminal context without changing layout.",
      ],
      interactions: [
        "Role and status map to semantic classes and accessible message structure.",
        "Actions and branch controls can be hidden while a message is still streaming.",
        "Slots accept render functions when behavior depends on terminal state.",
      ],
      integration:
        "Keep the message object immutable except for fields that actually changed; MessageList uses object identity to avoid unnecessary row work.",
    },
    zh: {
      eyebrow: "消息",
      description: "组合消息内容、附件、分支、操作和终态展示。",
      summary:
        "MessageBubble 是单条 user、assistant、tool 或 system 消息的结构单元。它提供内容、附件、分支导航、操作、底部元信息和终态的组合位置。",
      useCases: [
        "按不同角色和状态渲染对话行。",
        "在模型输出旁增加引用、附件、反馈或分支控制。",
        "把富文本 Markdown 渲染与消息外壳解耦。",
      ],
      props: [
        "message：AgentMessage 的身份、角色、状态、内容和时间戳。",
        "children：用 MarkdownRenderer 或自定义内容覆盖正文。",
        "attachments/actions/branchNavigator/footer：组合相邻交互面。",
        "showTimestamp/formatTimestamp/statusLabels：展示终态上下文而不破坏布局。",
      ],
      interactions: [
        "角色和状态会映射到语义 class 与可访问消息结构。",
        "消息仍在 streaming 时，可隐藏操作和分支控制。",
        "slot 支持 render function，用于依赖终态的交互。",
      ],
      integration:
        "除真正变化的字段外，保持 message 对象不可变；MessageList 会利用对象身份避免不必要的行渲染。",
    },
  },
  "message-actions": {
    en: {
      eyebrow: "Messages",
      description:
        "Copy, edit, regenerate, and persist feedback with pending, success, and rollback states.",
      summary:
        "MessageActions centralizes the small but important controls around a message: copy, edit, regenerate, like/dislike, async locks, success feedback, and rollback on failure.",
      useCases: [
        "Assistant messages that need copy, retry, feedback, or edit entry points.",
        "Products that persist feedback through an async API.",
        "Branching workflows where regenerate creates a new response candidate.",
      ],
      props: [
        "message: provides content and IDs for default copy behavior.",
        "onCopy/onEdit/onRegenerate/onFeedbackChange: plug in product actions.",
        "feedback/showFeedback: controlled current vote and visibility.",
        "onActionError: surface rejected async handlers without swallowing context.",
      ],
      interactions: [
        "Concurrent duplicate actions are locked until the handler settles.",
        "Feedback changes are optimistic only when the handler succeeds; failures roll back.",
        "Copy reports clipboard success or fallback failure.",
      ],
      integration:
        "Use it as a controlled interaction shell; the component never mutates message history by itself.",
    },
    zh: {
      eyebrow: "消息",
      description: "复制、编辑、重新生成和反馈持久化，包含 pending、成功和回滚状态。",
      summary:
        "MessageActions 统一管理消息旁的小但关键的控制：复制、编辑、重新生成、赞/踩、异步锁、成功反馈和失败回滚。",
      useCases: [
        "需要复制、重试、反馈或编辑入口的 assistant 消息。",
        "通过异步接口持久化用户反馈的产品。",
        "重新生成会创建新候选回复的分支工作流。",
      ],
      props: [
        "message：为默认复制行为提供内容和 ID。",
        "onCopy/onEdit/onRegenerate/onFeedbackChange：接入业务动作。",
        "feedback/showFeedback：受控当前反馈和可见性。",
        "onActionError：暴露 rejected handler，不吞掉错误上下文。",
      ],
      interactions: [
        "同一个操作在 handler 完成前会锁定，避免重复触发。",
        "反馈只有在 handler 成功后才落定；失败会回滚。",
        "复制会报告剪贴板成功或不可用失败。",
      ],
      integration: "把它当作受控交互外壳使用；组件不会自行修改消息历史。",
    },
  },
  "message-branch-navigator": {
    en: {
      eyebrow: "Messages",
      description:
        "Navigate alternative model responses and create a new branch without replacing history.",
      summary:
        "MessageBranchNavigator is a small controlled control for zero-based response variants. It lets users compare alternatives while your app owns the branch graph.",
      useCases: [
        "Regenerate flows that preserve previous assistant candidates.",
        "A/B answer comparison inside one user turn.",
        "Review tools where each branch maps to a different model, temperature, or tool path.",
      ],
      props: [
        "count/index/onIndexChange: controlled branch count and active position.",
        "disabled: lock navigation while a new branch is generating.",
        "previousLabel/nextLabel: provide localized accessible names.",
        "classNames/styles: align with a custom message footer.",
      ],
      interactions: [
        "Buttons and Left/Right/Home/End keyboard controls stay in sync.",
        "Index is clamped to valid bounds when branch count changes.",
        "Disabled state removes accidental navigation during async regeneration.",
      ],
      integration:
        "Store branch content in application state and render the selected branch through MessageBubble or MarkdownRenderer.",
    },
    zh: {
      eyebrow: "消息",
      description: "浏览模型候选回复，创建新分支时不覆盖历史。",
      summary:
        "MessageBranchNavigator 是受控的零基分支选择控件。用户可以比较候选回复，而分支图仍由业务应用管理。",
      useCases: [
        "重新生成时保留历史 assistant 候选。",
        "在同一个用户回合里做 A/B 回复对比。",
        "不同模型、温度或工具路径对应不同分支的评审工具。",
      ],
      props: [
        "count/index/onIndexChange：受控分支数量和当前位置。",
        "disabled：新分支生成时锁定导航。",
        "previousLabel/nextLabel：提供本地化可访问名称。",
        "classNames/styles：适配自定义消息底部区域。",
      ],
      interactions: [
        "按钮和 Left/Right/Home/End 键盘控制保持同步。",
        "分支数量变化时 index 会被限制在有效范围。",
        "disabled 状态避免异步重新生成期间误切换。",
      ],
      integration:
        "把分支内容存在业务状态中，再通过 MessageBubble 或 MarkdownRenderer 渲染当前选中分支。",
    },
  },
  "message-list": {
    en: {
      eyebrow: "Messages",
      description:
        "Stream deltas, preserve reading position, load history, and surface unseen activity.",
      summary:
        "MessageList is the transcript viewport. It auto-follows only when the reader is near the bottom, preserves scroll anchors while loading older history, and exposes new activity when the user is reading above the stream.",
      useCases: [
        "Long AI conversations with continuous token updates.",
        "Chat surfaces that load earlier history on scroll-to-top.",
        "Products that need a reader-respecting jump-to-latest interaction.",
      ],
      props: [
        "messages/conversationKey: render a stable dataset and reset internal state on session switch.",
        "autoScroll/followThreshold/showJumpToLatest: tune follow behavior.",
        "empty/emptyPlacement: provide an empty state that starts in reading flow or explicitly centers.",
        "onReachStart/onReachStartError: load older messages and surface failures.",
        "windowing/onWindowChange: opt into estimated, overscanned rendering for long transcripts.",
        "renderMessage/getLiveAnnouncement: customize rows and concise announcements.",
      ],
      interactions: [
        "Scrolling up transfers control to the reader instead of snapping to new tokens.",
        "Empty content is start-aligned by default; centering is an explicit product decision.",
        "Prepending stable-ID history preserves visual position, including late rich-content height changes.",
        "Jump to latest clears unseen activity only after the list actually reaches the bottom.",
      ],
      integration:
        "Keep message IDs stable and replace only changed message objects; enable built-in windowing for very long histories rather than mutating source state.",
    },
    zh: {
      eyebrow: "消息",
      description: "处理 token delta、阅读位置、历史加载和未读活动。",
      summary:
        "MessageList 是对话视口。它只在读者接近底部时自动跟随；加载更早历史时保持滚动锚点；当用户正在阅读上方内容时，用新活动提示承接流式更新。",
      useCases: [
        "持续 token 更新的长对话。",
        "滚动到顶部加载更早历史的聊天界面。",
        "需要尊重阅读位置并提供 jump-to-latest 的产品。",
      ],
      props: [
        "messages/conversationKey：渲染稳定数据集，并在会话切换时重置内部状态。",
        "autoScroll/followThreshold/showJumpToLatest：调节跟随行为。",
        "empty/emptyPlacement：提供默认位于阅读起点、也可显式居中的空状态。",
        "onReachStart/onReachStartError：加载更早消息并暴露失败。",
        "windowing/onWindowChange：为超长对话启用带 overscan 的估算窗口化。",
        "renderMessage/getLiveAnnouncement：自定义消息行和简洁播报。",
      ],
      interactions: [
        "向上滚动后控制权交给读者，不会被新 token 强行拉到底部。",
        "空内容默认起始对齐；是否居中由产品显式决定。",
        "以稳定 ID prepend 历史时会保持视觉位置，包括富内容后续高度变化。",
        "Jump to latest 只有在列表真正到底后才清空未读活动。",
      ],
      integration:
        "保持消息 ID 稳定，只替换真正变化的 message 对象；超长历史启用内建窗口化，而不是删除源状态。",
    },
  },
  "reasoning-panel": {
    en: {
      eyebrow: "Agent state",
      description:
        "Auto-open active reasoning, time the run, preserve manual intent, and expose recoverable failure.",
      summary:
        "ReasoningPanel renders thinking, trace notes, or plan context with a disclosure model that respects both run state and the user's manual open/close choice.",
      useCases: [
        "Showing progressive reasoning or trace summaries during a run.",
        "Keeping recoverable failure context visible without taking over the transcript.",
        "Letting expert users inspect depth while casual users keep the surface quiet.",
      ],
      props: [
        "status/startedAt/elapsedMs: show live, controlled, or terminal duration.",
        "autoOpen: open while running, on attention states, always, or never.",
        "open/onOpenChange: fully control disclosure when needed.",
        "formatElapsed/statusLabels: localize timing and lifecycle presentation.",
      ],
      interactions: [
        "Manual close is preserved instead of fighting the user on every render.",
        "Elapsed time updates while active and freezes at terminal state.",
        "Error state can stay inspectable while the main response recovers.",
      ],
      integration:
        "Keep raw chain-of-thought policy decisions in your product layer; pass only the reasoning summary or trace content your application is allowed to show.",
    },
    zh: {
      eyebrow: "Agent 状态",
      description: "自动展开活跃思考、计时运行、保留手动意图并展示可恢复失败。",
      summary:
        "ReasoningPanel 用 disclosure 模式展示思考、轨迹笔记或计划上下文，同时尊重运行状态和用户手动展开/收起选择。",
      useCases: [
        "在运行中展示渐进式思考摘要或 trace。",
        "保留可恢复失败上下文，但不抢占主对话。",
        "让专家用户能查看细节，普通用户保持界面安静。",
      ],
      props: [
        "status/startedAt/elapsedMs：展示实时、受控或终态耗时。",
        "autoOpen：按运行中、注意态、始终或从不展开。",
        "open/onOpenChange：需要时完全受控 disclosure。",
        "formatElapsed/statusLabels：本地化耗时和生命周期呈现。",
      ],
      interactions: [
        "用户手动收起会被保留，不会每次渲染都强行展开。",
        "耗时在 active 时更新，并在终态冻结。",
        "错误状态可以继续查看，同时主回复恢复。",
      ],
      integration:
        "原始 chain-of-thought 的策略判断应留在业务层；只传应用允许展示的思考摘要或 trace 内容。",
    },
  },
  "agent-steps": {
    en: {
      eyebrow: "Agent state",
      description:
        "Track live duration, waiting states, failure details, expansion, and asynchronous retry.",
      summary:
        "AgentSteps renders a run as structured steps with status, detail, timing, expansion, and retry hooks so the user can understand where the agent is blocked or progressing.",
      useCases: [
        "Multi-step agents that search, plan, call tools, and compose.",
        "Approval or waiting states that should be visible before output appears.",
        "Debuggable workflows where a failed step can be retried.",
      ],
      props: [
        "steps: immutable step objects with id, title, status, timing, and detail.",
        "expandedStepIds/onExpandedStepIdsChange: controlled disclosure state.",
        "autoExpand: reveal running and/or error steps automatically.",
        "onRetry/onRetryError/renderDetail: plug in recovery and custom details.",
      ],
      interactions: [
        "Running durations update without changing completed step timing.",
        "Error steps can auto-expand and lock retry while the handler is pending.",
        "Waiting and cancelled states make interruption and dependency pauses explicit.",
      ],
      integration:
        "Normalize backend step events in the runtime layer and preserve step IDs across deltas; this keeps UI expansion stable.",
    },
    zh: {
      eyebrow: "Agent 状态",
      description: "追踪实时耗时、等待态、失败详情、展开和异步重试。",
      summary:
        "AgentSteps 把一次运行渲染为结构化步骤，包含状态、详情、耗时、展开和重试钩子，让用户知道 Agent 在哪里推进或卡住。",
      useCases: [
        "搜索、规划、调用工具、组织回复的多步骤 Agent。",
        "输出出现前需要可见的审批或等待状态。",
        "失败步骤可重试的可调试工作流。",
      ],
      props: [
        "steps：不可变步骤对象，包含 id、标题、状态、时间和详情。",
        "expandedStepIds/onExpandedStepIdsChange：受控展开状态。",
        "autoExpand：自动展开 running 或 error 步骤。",
        "onRetry/onRetryError/renderDetail：接入恢复逻辑和自定义详情。",
      ],
      interactions: [
        "running 耗时会更新，但 completed 步骤的时间不会被扰动。",
        "error 步骤可自动展开，并在 retry handler pending 时锁定。",
        "waiting 和 cancelled 状态让中断和依赖等待明确可见。",
      ],
      integration:
        "在运行时层归一化后端 step 事件，并保持 step ID 跨 delta 稳定；这样 UI 展开状态才稳定。",
    },
  },
  "code-block": {
    en: {
      eyebrow: "Content",
      description:
        "Recover async highlighting and let users wrap, collapse, copy, or download generated code.",
      summary:
        "CodeBlock renders generated code with copy, wrap, collapse, download, async highlighting, cancellation, fallback, and retry behavior.",
      useCases: [
        "AI-generated code snippets that may be long or streamed after completion.",
        "Products that run syntax highlighting in a worker or remote highlighter.",
        "Documentation surfaces that need copy and download actions.",
      ],
      props: [
        "code/language/filename: identify the snippet and its display metadata.",
        "highlighter/onHighlightError: plug in cancellable async highlighting.",
        "showWrapToggle/wrap/onWrapChange: control line wrapping.",
        "collapsible/collapseAfterLines/showDownload/onCopy: expose practical code actions.",
      ],
      interactions: [
        "Highlighting can be retried after worker failure.",
        "Collapse preserves access to the full code through expansion and download.",
        "Copy and download report action results without mutating the code.",
      ],
      integration:
        "Return React nodes or sanitized HTML from custom highlighters; never trust provider or user content as raw HTML without sanitization.",
    },
    zh: {
      eyebrow: "内容",
      description: "异步高亮可恢复，并支持换行、折叠、复制和下载代码。",
      summary:
        "CodeBlock 渲染生成代码，包含复制、换行、折叠、下载、异步高亮、取消、fallback 和重试行为。",
      useCases: [
        "AI 生成的较长代码片段，或完成后再渲染的代码。",
        "在 worker 或远端高亮器中执行语法高亮的产品。",
        "需要复制和下载操作的文档界面。",
      ],
      props: [
        "code/language/filename：标识代码片段及展示信息。",
        "highlighter/onHighlightError：接入可取消的异步高亮。",
        "showWrapToggle/wrap/onWrapChange：控制自动换行。",
        "collapsible/collapseAfterLines/showDownload/onCopy：提供实用代码操作。",
      ],
      interactions: [
        "高亮 worker 失败后可以重试。",
        "折叠状态仍可通过展开和下载访问完整代码。",
        "复制和下载会报告动作结果，不修改代码内容。",
      ],
      integration:
        "自定义 highlighter 应返回 React 节点或已净化 HTML；不要直接信任 provider 或用户内容产生的 raw HTML。",
    },
  },
  formula: {
    en: {
      eyebrow: "Content",
      description:
        "Switch inline/display math, copy source, and recover from strict KaTeX parse failures.",
      summary:
        "Formula wraps KaTeX rendering with inline/display modes, copy support, error fallback, and strict parser handling for generated math.",
      useCases: [
        "Model responses that include LaTeX formulas.",
        "Education or research products that need copyable math source.",
        "Strict rendering contexts where parse failures should not break the transcript.",
      ],
      props: [
        "formula/displayMode: choose source and inline or block layout.",
        "align: choose start, center, or end; block math defaults to start.",
        "options: pass safe KaTeX configuration.",
        "showCopy/onCopy: expose source-copy interaction.",
        "renderError: recover from invalid generated LaTeX.",
      ],
      interactions: [
        "Parse failures render a contained fallback instead of corrupting message layout.",
        "Copy preserves the original source string.",
        "Inline mode fits surrounding prose; display alignment changes only when align is explicit.",
      ],
      integration:
        "Keep KaTeX options strict for untrusted model output and use MarkdownRenderer when formulas live inside full Markdown responses.",
    },
    zh: {
      eyebrow: "内容",
      description: "切换行内/展示数学、复制源内容，并从严格 KaTeX 解析失败中恢复。",
      summary:
        "Formula 封装 KaTeX 渲染，为生成公式提供行内/块级模式、复制、错误 fallback 和严格解析处理。",
      useCases: [
        "模型回复中包含 LaTeX 公式。",
        "教育或研究产品需要可复制数学源文本。",
        "严格渲染环境中，解析失败不能破坏整段对话。",
      ],
      props: [
        "formula/displayMode：选择源公式和行内/块级布局。",
        "align：选择 start、center 或 end；块级公式默认从阅读起点开始。",
        "options：传入安全的 KaTeX 配置。",
        "showCopy/onCopy：提供复制源公式交互。",
        "renderError：从无效生成 LaTeX 中恢复。",
      ],
      interactions: [
        "解析失败会渲染受控 fallback，不破坏消息布局。",
        "复制保留原始源字符串。",
        "行内模式适合正文；只有显式设置 align 才改变展示公式对齐。",
      ],
      integration:
        "对不可信模型输出保持严格 KaTeX 配置；完整 Markdown 回复中的公式建议交给 MarkdownRenderer 组合处理。",
    },
  },
  "markdown-renderer": {
    en: {
      eyebrow: "Content",
      description:
        "Progressively render GFM, math, code, and an unfinished Mermaid fence without layout corruption.",
      summary:
        "MarkdownRenderer composes GFM, math, code blocks, and Mermaid while handling streaming text and incomplete fences without visual collapse.",
      useCases: [
        "Assistant responses that stream Markdown progressively.",
        "Technical answers containing tables, math, code, and diagrams.",
        "Products that need safe defaults around raw HTML and incomplete syntax.",
      ],
      props: [
        "content/streaming: render static or in-progress Markdown.",
        "streamingMode/stabilizeIncompleteBlocks: control progressive parsing behavior.",
        "codeBlockProps/mermaidConfig/mermaidProps: customize nested renderers and explicit diagram alignment.",
        "components: override Markdown nodes when product UI requires it.",
      ],
      interactions: [
        "Incomplete code or Mermaid fences stay visually stable during streaming.",
        "Expensive rich rendering is deferred away from prompt typing.",
        "Nested CodeBlock, Formula, and MermaidDiagram keep their own actions.",
      ],
      integration:
        "Skip raw HTML by default for untrusted model content; add sanitization before enabling any HTML path.",
    },
    zh: {
      eyebrow: "内容",
      description: "渐进渲染 GFM、公式、代码和未闭合 Mermaid fence，避免布局损坏。",
      summary:
        "MarkdownRenderer 组合 GFM、数学、代码块和 Mermaid，并在流式文本与未闭合 fence 下保持视觉稳定。",
      useCases: [
        "assistant 回复以 Markdown 形式逐步流式输出。",
        "包含表格、公式、代码和图表的技术答案。",
        "需要对 raw HTML 和不完整语法保持安全默认的产品。",
      ],
      props: [
        "content/streaming：渲染静态或进行中的 Markdown。",
        "streamingMode/stabilizeIncompleteBlocks：控制渐进解析行为。",
        "codeBlockProps/mermaidConfig/mermaidProps：定制内部渲染器和显式图表对齐。",
        "components：在产品 UI 需要时覆盖 Markdown 节点。",
      ],
      interactions: [
        "未闭合代码或 Mermaid fence 在流式过程中保持稳定。",
        "高成本富文本渲染会避开提示词输入路径。",
        "内部 CodeBlock、Formula、MermaidDiagram 保留各自动作。",
      ],
      integration: "对不可信模型内容默认跳过 raw HTML；只有在净化后才开启 HTML 路径。",
    },
  },
  "mermaid-diagram": {
    en: {
      eyebrow: "Content",
      description:
        "Secure lazy rendering with retry, source copy, and controlled zoom for dense agent diagrams.",
      summary:
        "MermaidDiagram lazy-loads Mermaid, renders diagrams with strict defaults, and adds copy, zoom, reset, error, and retry controls.",
      useCases: [
        "Agent plans, execution graphs, or architecture diagrams generated as Mermaid.",
        "Dense diagrams that need zoom controls inside a message.",
        "Secure diagram rendering for untrusted model output.",
      ],
      props: [
        "chart/title/config: provide source and safe Mermaid configuration.",
        "align: keep the canvas at the reading start by default or opt into center/end.",
        "interactive/zoom/onZoomChange: control viewport scaling.",
        "showCopySource/onCopySource: let users inspect or reuse the diagram source.",
        "renderError/onError/onRender: recover from invalid definitions.",
      ],
      interactions: [
        "Mermaid loads only when a diagram is rendered.",
        "Loading, failure, and diagram content keep the same horizontal anchor.",
        "Invalid diagrams stay contained and can be repaired or retried.",
        "Zoom state can be controlled by product UI or local component state.",
      ],
      integration:
        "Prefer strict security config for model output, and keep the raw chart text available for bug reports or edits.",
    },
    zh: {
      eyebrow: "内容",
      description: "安全懒渲染，支持重试、复制源代码和受控缩放。",
      summary:
        "MermaidDiagram 懒加载 Mermaid，以严格默认配置渲染图表，并提供复制、缩放、重置、错误和重试控制。",
      useCases: [
        "以 Mermaid 生成的 Agent 计划、执行图或架构图。",
        "需要在消息内缩放查看的复杂图表。",
        "面向不可信模型输出的安全图表渲染。",
      ],
      props: [
        "chart/title/config：提供源文本和安全 Mermaid 配置。",
        "align：图表默认位于阅读起点，也可显式选择 center/end。",
        "interactive/zoom/onZoomChange：控制视口缩放。",
        "showCopySource/onCopySource：让用户查看或复用图表源代码。",
        "renderError/onError/onRender：从无效定义中恢复。",
      ],
      interactions: [
        "只有真正渲染图表时才加载 Mermaid。",
        "加载、失败与图表正文保持同一水平锚点。",
        "无效图表会被限制在组件内，并可修复或重试。",
        "缩放状态可以由业务 UI 或组件本地状态控制。",
      ],
      integration: "模型输出建议使用 strict 安全配置，并保留原始 chart 文本，方便问题报告或编辑。",
    },
  },
  "streaming-indicator": {
    en: {
      eyebrow: "Feedback",
      description:
        "Represent indeterminate work or measurable progress with pause, completion, tone, and motion variants.",
      summary:
        "StreamingIndicator gives a compact, accessible signal for active model work, paused generation, measurable progress, and completion.",
      useCases: [
        "Showing token generation before enough content is available.",
        "Representing tool execution or reasoning progress in compact UI.",
        "Replacing generic spinners with AI-specific motion states.",
      ],
      props: [
        "label/visibleLabel: provide an accessible status with optional visible text.",
        "variant: choose dots, pulse, or wave motion.",
        "tone: neutral, accent, success, or danger feedback.",
        "active/progress: represent indeterminate or measurable progress.",
      ],
      interactions: [
        "Reduced-motion preferences are respected through the provider and system media query.",
        "Progress values update ARIA state without requiring custom live regions.",
        "Paused and complete states keep the label meaningful.",
      ],
      integration:
        "Use it near the content that is waiting, not as a global blocker, so users retain orientation.",
    },
    zh: {
      eyebrow: "反馈",
      description: "用暂停、完成、色调和动效变体表达不确定工作或可度量进度。",
      summary:
        "StreamingIndicator 为模型运行、暂停生成、可度量进度和完成态提供紧凑且可访问的反馈。",
      useCases: [
        "内容尚不足以显示时，提示 token 生成中。",
        "在紧凑 UI 中表达工具执行或思考进度。",
        "用 AI 语境下的运动状态替代通用 spinner。",
      ],
      props: [
        "label/visibleLabel：提供可访问状态，可选择是否显示文字。",
        "variant：选择 dots、pulse 或 wave 动效。",
        "tone：neutral、accent、success、danger 反馈。",
        "active/progress：表达不确定或可度量进度。",
      ],
      interactions: [
        "通过 provider 与系统媒体查询尊重减少动效偏好。",
        "progress 更新会同步 ARIA 状态，不需要额外 live region。",
        "暂停和完成态仍保持 label 有意义。",
      ],
      integration: "把它放在正在等待的内容附近，而不是做全局遮挡，这样用户不会丢失上下文。",
    },
  },
  "tool-call-card": {
    en: {
      eyebrow: "Agent state",
      description:
        "Review arguments, approve risk, observe execution, reject, and recover a failed tool call.",
      summary:
        "ToolCallCard makes side effects visible: arguments, risk, approval, rejection, running state, result, error, retry, and expansion are all explicit.",
      useCases: [
        "Agent actions that read private sources or mutate workspace state.",
        "Approval flows where the user must inspect exact arguments before execution.",
        "Recoverable tool failures that should not disappear from the transcript.",
      ],
      props: [
        "toolName/description/arguments/result/error: expose the exact action surface.",
        "status/risk: communicate lifecycle and consequence level.",
        "expanded/onExpandedChange/autoOpen: control disclosure around attention states.",
        "confirmApproval/onApprove/onReject/onRetry/onActionError: gate high-risk approval and plug in guarded async decisions.",
      ],
      interactions: [
        "Approve, reject, and retry handlers are locked while pending.",
        "autoOpen can reveal approval or error states until the user manually changes disclosure.",
        "Rejected and cancelled states are terminal unless the app explicitly retries.",
      ],
      integration:
        "The card is UI, not authorization. Always repeat permission and policy checks on the server before executing a tool.",
    },
    zh: {
      eyebrow: "Agent 状态",
      description: "检查参数、确认风险、观察执行、拒绝并恢复失败工具调用。",
      summary:
        "ToolCallCard 让副作用可见：参数、风险、确认、拒绝、运行态、结果、错误、重试和展开都被显式表达。",
      useCases: [
        "读取私有资料或修改工作区状态的 Agent 动作。",
        "用户执行前必须检查精确参数的确认流。",
        "失败后仍应保留在对话中的可恢复工具调用。",
      ],
      props: [
        "toolName/description/arguments/result/error：暴露精确动作面。",
        "status/risk：表达生命周期和后果等级。",
        "expanded/onExpandedChange/autoOpen：控制注意态 disclosure。",
        "confirmApproval/onApprove/onReject/onRetry/onActionError：拦截高风险确认并接入受保护异步决策。",
      ],
      interactions: [
        "确认、拒绝和重试 handler pending 时会锁定。",
        "autoOpen 可在审批或错误态自动展开，直到用户手动调整。",
        "rejected 和 cancelled 是终态，除非业务显式重试。",
      ],
      integration:
        "这个卡片只是 UI，不是授权系统。真正执行工具前，服务端仍必须重复权限和策略检查。",
    },
  },
};

export const COMPONENT_API_GROUPS: readonly ComponentApiGroup[] = [
  {
    id: "foundation",
    title: { en: "Foundation", zh: "基础能力" },
    description: {
      en: "Provider, tokens, density, and behavior boundaries.",
      zh: "Provider、设计 token、密度和行为边界。",
    },
    keys: ["velora-provider"],
  },
  {
    id: "workspace",
    title: { en: "Workspace", zh: "工作区" },
    description: {
      en: "Layout, session navigation, and multimodal input.",
      zh: "布局、会话导航和多模态输入。",
    },
    keys: ["agent-shell", "conversation-list", "prompt-composer"],
  },
  {
    id: "messages",
    title: { en: "Messages", zh: "消息" },
    description: {
      en: "Transcript rendering, message chrome, actions, and branches.",
      zh: "对话渲染、消息外壳、操作和分支。",
    },
    keys: ["message-list", "message-bubble", "message-actions", "message-branch-navigator"],
  },
  {
    id: "agent-state",
    title: { en: "Agent state", zh: "Agent 状态" },
    description: {
      en: "Reasoning, steps, tool calls, and progress feedback.",
      zh: "思考、步骤、工具调用和进度反馈。",
    },
    keys: ["reasoning-panel", "agent-steps", "tool-call-card", "streaming-indicator"],
  },
  {
    id: "content",
    title: { en: "Generated content", zh: "生成内容" },
    description: {
      en: "Markdown, code, formulas, and diagrams generated by models.",
      zh: "模型生成的 Markdown、代码、公式和图表。",
    },
    keys: ["markdown-renderer", "code-block", "formula", "mermaid-diagram"],
  },
] as const;

export const COMPONENT_API_SPECS: Record<SampleKey, ComponentApiSpec> = {
  "agent-shell": {
    importName: "AgentShell",
    props: [
      { name: "children", type: "ReactNode", defaultValue: "—", required: true },
      { name: "contentMode", type: '"summary" | "trace"', defaultValue: '"summary"' },
      {
        name: "sidebar, header, inspector, composer",
        type: "ReactNode",
        defaultValue: "undefined",
      },
      {
        name: "mobileSidebarOpen/onMobileSidebarOpenChange",
        type: "boolean / (open: boolean) => void",
        defaultValue: "uncontrolled",
      },
      {
        name: "mobileInspectorOpen/onMobileInspectorOpenChange",
        type: "boolean / (open: boolean) => void",
        defaultValue: "uncontrolled",
      },
      {
        name: "sidebarLabel/inspectorLabel/contentRole",
        type: "string / AriaRole",
        defaultValue: '"Conversations" / "Inspector"',
      },
    ],
  },
  "velora-provider": {
    importName: "VeloraProvider",
    props: [
      { name: "children", type: "ReactNode", defaultValue: "—", required: true },
      { name: "theme", type: '"light" | "dark" | "system"', defaultValue: '"system"' },
      { name: "density", type: '"compact" | "comfortable"', defaultValue: '"comfortable"' },
      { name: "tokens", type: "Partial<VeloraTokens>", defaultValue: "undefined" },
      {
        name: "locale",
        type: '"en-US" | "zh-CN" | "en" | "zh"',
        defaultValue: '"en-US"',
        description: {
          en: "Sets the built-in visible labels, announcements, and accessible names for every descendant component.",
          zh: "统一设置所有子组件的可见文案、状态播报和无障碍名称。",
        },
      },
      {
        name: "messages",
        type: "VeloraMessagesOverride",
        defaultValue: "undefined",
        description: {
          en: "Partially overrides locale messages without replacing the full message catalog.",
          zh: "按需覆盖局部国际化文案，无需提供完整消息表。",
        },
      },
      { name: "reducedMotion", type: 'boolean | "system"', defaultValue: '"system"' },
      { name: "prefixCls", type: "string", defaultValue: '"vl"' },
    ],
  },
  "conversation-list": {
    importName: "ConversationList",
    props: [
      { name: "conversations", type: "readonly Conversation[]", defaultValue: "—", required: true },
      {
        name: "activeId/defaultActiveId/onActiveChange",
        type: "string | null / (id, conversation) => void",
        defaultValue: "null",
      },
      {
        name: "searchable, query, onQueryChange",
        type: "boolean / string / (query: string) => void",
        defaultValue: "false / uncontrolled",
      },
      {
        name: "deferFiltering/getSearchText",
        type: "boolean / (conversation) => string",
        defaultValue: "true / conversation.title",
      },
      {
        name: "getDescription/getMeta/getStatus/groupBy",
        type: "(conversation) => ReactNode | string",
        defaultValue: "built-in defaults",
      },
      {
        name: "renderItem/renderItemActions",
        type: "(conversation, context) => ReactNode",
        defaultValue: "undefined",
      },
      { name: "onCreate", type: "() => void", defaultValue: "undefined" },
    ],
  },
  "prompt-composer": {
    importName: "PromptComposer",
    props: [
      {
        name: "onSubmit",
        type: "(draft, context) => PromptSubmitResult | Promise<PromptSubmitResult>",
        defaultValue: "—",
        required: true,
      },
      {
        name: "draft/defaultDraft/onDraftChange",
        type: "PromptDraft / (draft, context) => void",
        defaultValue: "uncontrolled empty draft",
      },
      {
        name: "runStatus/onStop",
        type: "PromptRunStatus / (context) => void | Promise<void>",
        defaultValue: '"idle"',
      },
      {
        name: "submitShortcut",
        type: '"enter" | "mod-enter" | "button-only"',
        defaultValue: '"enter"',
      },
      {
        name: "accept/maxFileSize/maxAttachments/createAttachment",
        type: "string / number / (file: File) => PromptAttachment",
        defaultValue: "undefined / 8 / built-in",
      },
      {
        name: "renderAttachment/leading/tools/footer",
        type: "ReactNode | render function",
        defaultValue: "undefined",
      },
    ],
  },
  "message-bubble": {
    importName: "MessageBubble",
    props: [
      { name: "message", type: "AgentMessage", defaultValue: "—", required: true },
      { name: "children", type: "ReactNode", defaultValue: "message.content" },
      {
        name: "attachments/actions/branchNavigator/footer",
        type: "ReactNode | (message, context) => ReactNode",
        defaultValue: "undefined",
      },
      {
        name: "showTimestamp/formatTimestamp/statusLabels",
        type: "boolean / formatter / label map",
        defaultValue: "false / built-in",
      },
      { name: "classNames/styles", type: "Semantic maps by slot", defaultValue: "undefined" },
    ],
  },
  "message-actions": {
    importName: "MessageActions",
    props: [
      { name: "message", type: "AgentMessage", defaultValue: "—", required: true },
      {
        name: "copyText/showCopy",
        type: "string | (message) => string / boolean",
        defaultValue: "message.content / true",
      },
      {
        name: "feedback/showFeedback",
        type: "MessageFeedback / boolean",
        defaultValue: "uncontrolled null / true",
      },
      {
        name: "onCopy/onEdit/onRegenerate/onFeedbackChange",
        type: "async or sync action handlers",
        defaultValue: "undefined",
      },
      { name: "onActionError", type: "(error, context) => void", defaultValue: "undefined" },
    ],
  },
  "message-branch-navigator": {
    importName: "MessageBranchNavigator",
    props: [
      { name: "count", type: "number", defaultValue: "—", required: true },
      {
        name: "index/defaultIndex/onIndexChange",
        type: "number / (index: number) => void",
        defaultValue: "0",
      },
      { name: "disabled", type: "boolean", defaultValue: "false" },
      { name: "previousLabel/nextLabel", type: "string", defaultValue: "built-in English labels" },
      {
        name: "formatCount",
        type: "(index: number, count: number) => ReactNode",
        defaultValue: "1 / n",
      },
    ],
  },
  "message-list": {
    importName: "MessageList",
    props: [
      { name: "messages", type: "readonly AgentMessage[]", defaultValue: "—", required: true },
      { name: "conversationKey", type: "string | number", defaultValue: "undefined" },
      {
        name: "renderMessage",
        type: "(message, context) => ReactNode",
        defaultValue: "<MessageBubble />",
      },
      {
        name: "autoScroll/followThreshold/showJumpToLatest",
        type: "boolean / number / boolean",
        defaultValue: "true / 72 / true",
      },
      {
        name: "empty/emptyPlacement",
        type: 'ReactNode / "start" | "center"',
        defaultValue: 'built-in / "start"',
      },
      {
        name: "onReachStart/onReachStartError",
        type: "(element) => void | Promise<void>",
        defaultValue: "undefined",
      },
      {
        name: "getLiveAnnouncement",
        type: "(message, context) => string | null",
        defaultValue: "built-in concise labels",
      },
      {
        name: "windowing/onWindowChange",
        type: "boolean | MessageListWindowingOptions / (range) => void",
        defaultValue: "false / undefined",
      },
    ],
  },
  "reasoning-panel": {
    importName: "ReasoningPanel",
    props: [
      { name: "children", type: "ReactNode", defaultValue: "—", required: true },
      {
        name: "status",
        type: '"idle" | "running" | "complete" | "error"',
        defaultValue: '"complete"',
      },
      {
        name: "open/defaultOpen/onOpenChange",
        type: "boolean / (open: boolean) => void",
        defaultValue: "uncontrolled false",
      },
      {
        name: "autoOpen",
        type: '"while-running" | "always" | "never"',
        defaultValue: '"while-running"',
      },
      {
        name: "startedAt/elapsedMs/duration/showElapsed/formatElapsed",
        type: "timer inputs and formatter",
        defaultValue: "internal timer / true",
      },
    ],
  },
  "agent-steps": {
    importName: "AgentSteps",
    props: [
      { name: "steps", type: "readonly AgentStep[]", defaultValue: "—", required: true },
      {
        name: "expandedStepIds/onExpandedStepIdsChange",
        type: "readonly string[] / (ids) => void",
        defaultValue: "uncontrolled",
      },
      {
        name: "autoExpand",
        type: '"never" | "running" | "error" | "running-and-error"',
        defaultValue: '"running-and-error"',
      },
      { name: "renderDetail", type: "(step, context) => ReactNode", defaultValue: "step.detail" },
      { name: "onRetry/onRetryError", type: "async retry handlers", defaultValue: "undefined" },
      {
        name: "showDuration/formatDuration",
        type: "boolean / formatter",
        defaultValue: "true / built-in",
      },
    ],
  },
  "code-block": {
    importName: "CodeBlock",
    props: [
      { name: "code", type: "string", defaultValue: "—", required: true },
      { name: "language/filename", type: "string / ReactNode", defaultValue: "undefined" },
      {
        name: "highlighter/onHighlightError",
        type: "CodeHighlighter / (error) => void",
        defaultValue: "undefined",
      },
      {
        name: "showWrapToggle/wrap/onWrapChange",
        type: "boolean / boolean / (wrap) => void",
        defaultValue: "false / uncontrolled",
      },
      {
        name: "collapsible/collapseAfterLines/showDownload/onCopy",
        type: "boolean / number / boolean / callback",
        defaultValue: "false / 18 / false",
      },
      { name: "classNames/styles", type: "Semantic maps by slot", defaultValue: "undefined" },
    ],
  },
  formula: {
    importName: "Formula",
    props: [
      { name: "formula", type: "string", defaultValue: "—", required: true },
      { name: "displayMode", type: "boolean", defaultValue: "false" },
      { name: "align", type: '"start" | "center" | "end"', defaultValue: '"start"' },
      { name: "options", type: "SafeKatexOptions", defaultValue: "safe finite limits" },
      {
        name: "renderError",
        type: "(error: Error, formula: string) => ReactNode",
        defaultValue: "undefined",
      },
      {
        name: "showCopy/onCopy",
        type: "boolean / (formula, success) => void",
        defaultValue: "false",
      },
      { name: "classNames/styles", type: "Semantic maps by slot", defaultValue: "undefined" },
    ],
  },
  "markdown-renderer": {
    importName: "MarkdownRenderer",
    props: [
      { name: "content", type: "string", defaultValue: "—", required: true },
      {
        name: "streaming/streamingMode/stabilizeIncompleteBlocks",
        type: "boolean / 'deferred' | 'immediate' / boolean",
        defaultValue: "false / deferred / true",
      },
      {
        name: "codeHighlighter/codeBlockProps",
        type: "CodeHighlighter / Partial<CodeBlockProps>",
        defaultValue: "undefined",
      },
      {
        name: "mermaidConfig/mermaidProps",
        type: "SafeMermaidConfig / Partial<MermaidDiagramProps>",
        defaultValue: "undefined",
      },
      {
        name: "components",
        type: "react-markdown Components",
        defaultValue: "built-in components",
      },
      { name: "classNames/styles", type: "Semantic maps by slot", defaultValue: "undefined" },
    ],
  },
  "mermaid-diagram": {
    importName: "MermaidDiagram",
    props: [
      { name: "chart", type: "string", defaultValue: "—", required: true },
      { name: "config", type: "SafeMermaidConfig", defaultValue: "{}" },
      { name: "align", type: '"start" | "center" | "end"', defaultValue: '"start"' },
      {
        name: "interactive/zoom/onZoomChange",
        type: "boolean / number / (zoom: number) => void",
        defaultValue: "true / uncontrolled 1",
      },
      {
        name: "showCopySource/onCopySource",
        type: "boolean / (chart, success) => void",
        defaultValue: "false",
      },
      {
        name: "renderError/onError/onRender",
        type: "render and lifecycle callbacks",
        defaultValue: "undefined",
      },
      { name: "classNames/styles", type: "Semantic maps by slot", defaultValue: "undefined" },
    ],
  },
  "streaming-indicator": {
    importName: "StreamingIndicator",
    props: [
      {
        name: "label/visibleLabel",
        type: "string / boolean",
        defaultValue: '"Generating response" / false',
      },
      { name: "variant", type: '"dots" | "pulse" | "wave"', defaultValue: '"dots"' },
      {
        name: "tone",
        type: '"neutral" | "accent" | "success" | "danger"',
        defaultValue: '"neutral"',
      },
      { name: "active/progress", type: "boolean / number", defaultValue: "true / undefined" },
      { name: "announce", type: "boolean", defaultValue: "true" },
      { name: "classNames/styles", type: "Semantic maps by slot", defaultValue: "undefined" },
    ],
  },
  "tool-call-card": {
    importName: "ToolCallCard",
    props: [
      { name: "toolName", type: "string", defaultValue: "—", required: true },
      {
        name: "description/arguments/result/error",
        type: "ReactNode / unknown payloads",
        defaultValue: "undefined",
      },
      {
        name: "status/risk",
        type: "ToolCallStatus / ToolCallRisk",
        defaultValue: '"draft" / "low"',
      },
      {
        name: "expanded/onExpandedChange/autoOpen",
        type: "boolean / (expanded) => void / ToolCallAutoOpen",
        defaultValue: 'uncontrolled / "attention"',
      },
      {
        name: "confirmApproval/onApprove/onReject/onRetry/onActionError",
        type: "approval policy gate and async guarded action handlers",
        defaultValue: "undefined",
      },
      {
        name: "renderValue/statusLabels/riskLabels",
        type: "render callback / label maps",
        defaultValue: "built-in",
      },
    ],
  },
};
