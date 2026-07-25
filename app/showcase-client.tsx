"use client";

import {
  AgentShell,
  AgentSteps,
  CodeBlock,
  ConversationList,
  Formula,
  MarkdownRenderer,
  MermaidDiagram,
  MessageActions,
  MessageBranchNavigator,
  MessageBubble,
  MessageList,
  PromptComposer,
  ReasoningPanel,
  StreamingIndicator,
  ToolCallCard,
  VeloraProvider,
  createAgentStore,
  createSSETransport,
  useAgentChat,
  usePromptDrafts,
  type AgentMessage,
  type PromptDraft,
  type ToolCallStatus,
} from "@velora-ai/react";
import {
  ArrowRight,
  BookOpen,
  Braces,
  Check,
  ChevronRight,
  Code2,
  Command,
  Copy,
  Globe2,
  Layers3,
  Menu,
  Monitor,
  PanelLeft,
  Play,
  Radio,
  Smartphone,
  Sparkles,
  Tablet,
  TerminalSquare,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import {
  Fragment,
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const LiveProvider = lazy(() =>
  import("react-live").then((module) => ({ default: module.LiveProvider })),
);
const LiveEditor = lazy(() =>
  import("react-live").then((module) => ({ default: module.LiveEditor })),
);
const LiveError = lazy(() =>
  import("react-live").then((module) => ({ default: module.LiveError })),
);
const LivePreview = lazy(() =>
  import("react-live").then((module) => ({ default: module.LivePreview })),
);

type SampleKey =
  | "agent-shell"
  | "velora-provider"
  | "conversation-list"
  | "prompt-composer"
  | "message-bubble"
  | "message-actions"
  | "message-branch-navigator"
  | "message-list"
  | "reasoning-panel"
  | "agent-steps"
  | "code-block"
  | "formula"
  | "markdown-renderer"
  | "mermaid-diagram"
  | "streaming-indicator"
  | "tool-call-card";

type Sample = {
  key: SampleKey;
  name: string;
  eyebrow: string;
  description: string;
  code: string;
};

type Locale = "en" | "zh";
type Localized<T> = Record<Locale, T>;
type ViewportKey = "desktop" | "tablet" | "mobile";

type ComponentDoc = {
  eyebrow: string;
  description: string;
  summary: string;
  useCases: readonly string[];
  props: readonly string[];
  interactions: readonly string[];
  integration: string;
};

type ComponentApiProp = {
  name: string;
  type: string;
  defaultValue: string;
  required?: boolean;
};

type ComponentApiSpec = {
  importName: string;
  props: readonly ComponentApiProp[];
};

type ComponentApiGroup = {
  id: string;
  title: Localized<string>;
  description: Localized<string>;
  keys: readonly SampleKey[];
};

const localeNames: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

const siteCopy = {
  en: {
    nav: {
      components: "Components",
      api: "API",
      runtime: "Runtime",
      principles: "Principles",
      openSource: "Open source",
      explore: "Explore",
      languageLabel: "Switch language",
      languageValue: "EN",
      menuOpen: "Open navigation",
      menuClose: "Close navigation",
    },
    hero: {
      kicker: "Open-source · streaming first",
      title: "Interfaces for intelligence",
      titleAccent: "in motion.",
      lede:
        "A precise React system for building AI products that feel immediate, legible, and distinctly human, from the first token to the final tool call.",
      explore: "Explore components",
      copyCommand: "Copy local preview command",
      metrics: [
        ["16", "UI primitives"],
        ["9", "Typed stream events"],
        ["0", "Provider lock-in"],
      ] as const,
    },
    agent: {
      aria: "Interactive Velora agent demo",
      conversations: "Demo conversations",
      newConversation: "New conversation",
      workspace: "Workspace",
      previewPlan: "Pro preview",
      kicker: "Design copilot",
      placeholder: "Ask a question, paste an image, or drop project context...",
      footnoteSend: "Enter to send",
      ready: "ready",
      streaming: "streaming",
      noTool: "No tool",
      applyPatch: "Apply patch",
      searchSources: "Search sources",
      local: "Local",
      modelOnly: "Model-only response",
      reviewBeforeExecution: "Review before execution",
      noToolSelected: "No tool selected",
      approvalNotice: "Tool approved · prompt can be sent",
      approvalRestored: "Approval request restored",
      stopped: "Generation stopped · draft context is preserved",
      initialNotice: "Drop, paste, or pick context files",
      streamError: "Stream interrupted.",
      retry: "Retry",
      approveWorkspace: "Approve workspace changes before sending.",
      approveSources: "Approve source access before sending.",
      busy: "This conversation is already generating. Stop it before sending again.",
      empty: "Add a message or attachment before sending.",
      acceptedBy: "Accepted by",
      responseComplete: "Response complete",
      generationStopped: "Generation stopped",
      streamNeedsAttention: "Stream needs attention",
      verifyingApproval: "Verifying approval...",
      runningTool: "Running the approved tool...",
      rejectedTool: "Tool rejected · choose another tool or retry",
      addedFrom: "added from",
      attachmentRejected: "attachment rejected",
      simulated: "Simulated SSE",
      composing: "Composing interface plan",
      untitled: "Untitled session",
      startDirection: "Start a new direction",
    },
    trust: ["React 19", "TypeScript first", "SSE + streams", "VoidZero toolchain", "Composable by design"],
    workbench: {
      kicker: "Component workbench",
      title: "Shape the interface. See it breathe.",
      lede:
        "Edit typed, composable primitives in place. Each component now includes a usage contract, key props, and interaction notes so this reads like a library guide, not only a gallery.",
      catalog: "Primitives",
      catalogNote: "Headless where it matters. Beautiful before you touch a token.",
      preview: "Preview",
      appFile: "App.tsx",
      copy: "Copy",
      copied: "Copied",
      stable: "Usage guide",
      loadingEditor: "Loading interactive editor",
      loadsInView: "Interactive editor loads as this section enters view.",
      liveCompilation: "Live compilation",
      keyboardAware: "Keyboard-aware",
      viewportLabel: "Preview viewport",
      viewports: {
        desktop: "Desktop preview",
        tablet: "Tablet preview",
        mobile: "Mobile preview",
      } satisfies Record<ViewportKey, string>,
      docs: {
        guide: "Usage contract",
        useFor: "Use for",
        props: "Key props",
        behavior: "Interaction details",
        integration: "Integration note",
      },
    },
    api: {
      kicker: "Component API",
      title: "Documentation that behaves like a real component library.",
      lede:
        "Browse components by category, inspect their typed props, and jump back into the live editor when you want to change the implementation.",
      navLabel: "Component documentation navigation",
      overview: "Overview",
      useCases: "When to use",
      api: "API",
      prop: "Prop",
      type: "Type",
      defaultValue: "Default",
      description: "Description",
      required: "required",
      interaction: "Interaction contract",
      integration: "Integration",
      importLabel: "Import",
      editDemo: "Edit live demo",
      quickUse: "Usage",
      emptyDefault: "—",
    },
    runtime: {
      kicker: "One event path",
      title: "A runtime designed around the stream.",
      lede:
        "Bring any backend. Velora turns server events into a small, typed state graph and coalesces high-frequency deltas before React commits them.",
      codeComment: "// Selectors keep token updates local.",
    },
    pipeline: [
      {
        number: "01",
        icon: Radio,
        title: "SSE transport",
        code: "text/event-stream",
        copy: "Normalizes text, reasoning, steps, metadata, and terminal events.",
      },
      {
        number: "02",
        icon: Workflow,
        title: "Agent runtime",
        code: "useAgentChat()",
        copy: "Owns cancellation, retries, and conversation lifecycles.",
      },
      {
        number: "03",
        icon: Layers3,
        title: "External store",
        code: "zustand + selectors",
        copy: "Keeps conversations, messages, and runs in a normalized state graph.",
      },
      {
        number: "04",
        icon: PanelLeft,
        title: "UI primitives",
        code: "<MessageList />",
        copy: "Batches high-frequency deltas and memoizes unchanged message rows.",
      },
    ],
    principles: {
      kicker: "Built with restraint",
      title: "Quiet by default. Expressive on demand.",
      lede:
        "The system handles the hard edges of AI interaction while leaving your product's voice intact.",
      cards: [
        {
          index: "01",
          title: "Perceived latency is the product.",
          copy: "Optimistic turns, stable layout, and progressive content make waiting feel like momentum.",
        },
        {
          index: "02",
          title: "Render only what moved.",
          copy: "Selector-first state and batched tokens keep interaction smooth.",
        },
        {
          index: "03",
          title: "Accessible at the primitive.",
          copy: "Keyboard paths, announcements, and focus behavior are built in.",
        },
      ] as const,
    },
    footer: {
      kicker: "MIT licensed · built in the open",
      title: "Give your AI a better surface.",
      lede: "Start with the primitives. Keep every detail yours.",
      architecture: "Explore the architecture",
      top: "Back to top",
      tagline: "Interfaces for intelligence in motion.",
      copyright: "© 2026 Velora AI Contributors",
    },
  },
  zh: {
    nav: {
      components: "组件",
      api: "API",
      runtime: "运行时",
      principles: "原则",
      openSource: "开源",
      explore: "查看组件",
      languageLabel: "切换语言",
      languageValue: "中",
      menuOpen: "打开导航",
      menuClose: "关闭导航",
    },
    hero: {
      kicker: "开源 · 流式优先",
      title: "为智能体打造",
      titleAccent: "流动的界面。",
      lede:
        "一套面向真实 AI 产品的 React 组件系统：从第一个 token 到最后一次工具调用，都保持即时、清晰、可控。",
      explore: "查看组件",
      copyCommand: "复制本地预览命令",
      metrics: [
        ["16", "交互组件"],
        ["9", "流式事件类型"],
        ["0", "模型厂商绑定"],
      ] as const,
    },
    agent: {
      aria: "Velora 交互式智能体演示",
      conversations: "演示会话",
      newConversation: "新建会话",
      workspace: "工作区",
      previewPlan: "Pro 预览",
      kicker: "设计 Copilot",
      placeholder: "输入问题、粘贴图片，或拖入项目上下文...",
      footnoteSend: "Enter 发送",
      ready: "就绪",
      streaming: "流式输出中",
      noTool: "不使用工具",
      applyPatch: "应用补丁",
      searchSources: "搜索资料",
      local: "本地模型",
      modelOnly: "仅模型回复",
      reviewBeforeExecution: "执行前需要确认",
      noToolSelected: "未选择工具",
      approvalNotice: "工具已确认，可以发送提示词",
      approvalRestored: "确认请求已恢复",
      stopped: "生成已停止 · 草稿上下文仍保留",
      initialNotice: "拖入、粘贴或选择上下文文件",
      streamError: "流式连接中断。",
      retry: "重试",
      approveWorkspace: "发送前请先确认工作区变更。",
      approveSources: "发送前请先确认资料访问。",
      busy: "当前会话正在生成，请先停止再发送。",
      empty: "请输入消息或添加附件。",
      acceptedBy: "已由",
      responseComplete: "回复完成",
      generationStopped: "生成已停止",
      streamNeedsAttention: "流式状态需要处理",
      verifyingApproval: "正在校验确认...",
      runningTool: "正在执行已确认的工具...",
      rejectedTool: "工具已拒绝 · 可更换工具或重试",
      addedFrom: "个文件来自",
      attachmentRejected: "个附件被拒绝",
      simulated: "模拟 SSE",
      composing: "正在组织界面方案",
      untitled: "未命名会话",
      startDirection: "开始新的方向",
    },
    trust: ["React 19", "TypeScript 优先", "SSE + 流式", "VoidZero 工具链", "组合式设计"],
    workbench: {
      kicker: "组件工作台",
      title: "调组件，看它真实运转。",
      lede:
        "每个组件都可编辑、可预览，并补上适用场景、关键 props 和交互约定。这里不再只是展厅，而是组件库使用入口。",
      catalog: "组件",
      catalogNote: "需要时可无头组合，默认也具备精致交互。",
      preview: "预览",
      appFile: "App.tsx",
      copy: "复制",
      copied: "已复制",
      stable: "用法指南",
      loadingEditor: "正在加载交互编辑器",
      loadsInView: "进入该区域后加载交互编辑器。",
      liveCompilation: "实时编译",
      keyboardAware: "键盘友好",
      viewportLabel: "预览视口",
      viewports: {
        desktop: "桌面预览",
        tablet: "平板预览",
        mobile: "手机预览",
      } satisfies Record<ViewportKey, string>,
      docs: {
        guide: "使用约定",
        useFor: "适用场景",
        props: "关键 props",
        behavior: "交互细节",
        integration: "接入建议",
      },
    },
    api: {
      kicker: "组件 API",
      title: "像真正组件库一样组织文档。",
      lede:
        "按分类浏览组件，查看类型化 Props，并在需要验证交互时跳回实时编辑器修改代码。",
      navLabel: "组件文档导航",
      overview: "概览",
      useCases: "何时使用",
      api: "API",
      prop: "属性",
      type: "类型",
      defaultValue: "默认值",
      description: "说明",
      required: "必填",
      interaction: "交互契约",
      integration: "接入建议",
      importLabel: "导入",
      editDemo: "编辑实时示例",
      quickUse: "用法",
      emptyDefault: "—",
    },
    runtime: {
      kicker: "一条事件链路",
      title: "围绕流式输出设计的运行时。",
      lede:
        "后端可以自由替换。Velora 将服务端事件归一到小型类型化状态图，并在 React 提交前合并高频 token 更新。",
      codeComment: "// selectors 让 token 更新只影响订阅到的区域。",
    },
    pipeline: [
      {
        number: "01",
        icon: Radio,
        title: "SSE 接入层",
        code: "text/event-stream",
        copy: "归一化文本、思考、步骤、元数据、错误和终止事件。",
      },
      {
        number: "02",
        icon: Workflow,
        title: "Agent 运行时",
        code: "useAgentChat()",
        copy: "负责取消、重试、会话生命周期和完成态。",
      },
      {
        number: "03",
        icon: Layers3,
        title: "外部状态图",
        code: "zustand + selectors",
        copy: "以标准化结构管理会话、消息和运行状态。",
      },
      {
        number: "04",
        icon: PanelLeft,
        title: "UI 组件",
        code: "<MessageList />",
        copy: "批处理高频 delta，并让未变化的消息行避免重渲染。",
      },
    ],
    principles: {
      kicker: "克制地构建",
      title: "默认安静，需要时展开。",
      lede: "组件处理 AI 交互里棘手的边界，同时保留产品自己的表达。",
      cards: [
        {
          index: "01",
          title: "等待体验就是产品体验。",
          copy: "乐观消息、稳定布局和渐进内容，让等待更像推进而不是卡顿。",
        },
        {
          index: "02",
          title: "只渲染真正变化的部分。",
          copy: "selector 优先的状态和 token 批处理，让长对话仍然顺滑。",
        },
        {
          index: "03",
          title: "可访问性内建在组件里。",
          copy: "键盘路径、状态播报、焦点行为和动效降级都作为默认契约。",
        },
      ] as const,
    },
    footer: {
      kicker: "MIT 许可 · 面向开源构建",
      title: "给你的 AI 一个更好的界面。",
      lede: "从组件开始，保留每个产品细节的主导权。",
      architecture: "查看架构",
      top: "返回顶部",
      tagline: "为流动的智能打造界面。",
      copyright: "© 2026 Velora AI Contributors",
    },
  },
} satisfies Record<Locale, Record<string, unknown>>;

const componentDocs: Record<SampleKey, Localized<ComponentDoc>> = {
  "agent-shell": {
    en: {
      eyebrow: "Layout",
      description: "A responsive agent workspace with isolated drafts, streaming turns, and interruption.",
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
        "onCreate: wire a new-session command into the list header.",
        "getDescription/getMeta/getStatus/groupBy: adapt any business data shape.",
      ],
      interactions: [
        "Search keeps the selected conversation stable when possible.",
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
        "onCreate：把新建会话命令接到列表头部。",
        "getDescription/getMeta/getStatus/groupBy：适配任意业务数据结构。",
      ],
      interactions: [
        "搜索时尽量保持当前选中会话稳定。",
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
      description: "Compose message content with attachments, response branches, actions, and terminal state.",
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
      description: "Copy, edit, regenerate, and persist feedback with pending, success, and rollback states.",
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
      integration:
        "把它当作受控交互外壳使用；组件不会自行修改消息历史。",
    },
  },
  "message-branch-navigator": {
    en: {
      eyebrow: "Messages",
      description: "Navigate alternative model responses and create a new branch without replacing history.",
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
      description: "Stream deltas, preserve reading position, load history, and surface unseen activity.",
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
        "onReachStart/onReachStartError: load older messages and surface failures.",
        "renderMessage/getLiveAnnouncement: customize rows and concise announcements.",
      ],
      interactions: [
        "Scrolling up transfers control to the reader instead of snapping to new tokens.",
        "Prepending stable-ID history preserves visual position, including late rich-content height changes.",
        "Jump to latest clears unseen activity only after the list actually reaches the bottom.",
      ],
      integration:
        "Keep message IDs stable and replace only changed message objects; for very long histories, window at the render boundary rather than mutating source state.",
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
        "onReachStart/onReachStartError：加载更早消息并暴露失败。",
        "renderMessage/getLiveAnnouncement：自定义消息行和简洁播报。",
      ],
      interactions: [
        "向上滚动后控制权交给读者，不会被新 token 强行拉到底部。",
        "以稳定 ID prepend 历史时会保持视觉位置，包括富内容后续高度变化。",
        "Jump to latest 只有在列表真正到底后才清空未读活动。",
      ],
      integration:
        "保持消息 ID 稳定，只替换真正变化的 message 对象；超长历史应在渲染边界做窗口化，而不是删源状态。",
    },
  },
  "reasoning-panel": {
    en: {
      eyebrow: "Agent state",
      description: "Auto-open active reasoning, time the run, preserve manual intent, and expose recoverable failure.",
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
      description: "Track live duration, waiting states, failure details, expansion, and asynchronous retry.",
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
      description: "Recover async highlighting and let users wrap, collapse, copy, or download generated code.",
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
      description: "Switch inline/display math, copy source, and recover from strict KaTeX parse failures.",
      summary:
        "Formula wraps KaTeX rendering with inline/display modes, copy support, error fallback, and strict parser handling for generated math.",
      useCases: [
        "Model responses that include LaTeX formulas.",
        "Education or research products that need copyable math source.",
        "Strict rendering contexts where parse failures should not break the transcript.",
      ],
      props: [
        "formula/displayMode: choose source and inline or block layout.",
        "options: pass safe KaTeX configuration.",
        "showCopy/onCopy: expose source-copy interaction.",
        "renderError: recover from invalid generated LaTeX.",
      ],
      interactions: [
        "Parse failures render a contained fallback instead of corrupting message layout.",
        "Copy preserves the original source string.",
        "Inline mode fits inside surrounding prose; display mode centers larger equations.",
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
        "options：传入安全的 KaTeX 配置。",
        "showCopy/onCopy：提供复制源公式交互。",
        "renderError：从无效生成 LaTeX 中恢复。",
      ],
      interactions: [
        "解析失败会渲染受控 fallback，不破坏消息布局。",
        "复制保留原始源字符串。",
        "行内模式适合正文，展示模式适合较大公式居中显示。",
      ],
      integration:
        "对不可信模型输出保持严格 KaTeX 配置；完整 Markdown 回复中的公式建议交给 MarkdownRenderer 组合处理。",
    },
  },
  "markdown-renderer": {
    en: {
      eyebrow: "Content",
      description: "Progressively render GFM, math, code, and an unfinished Mermaid fence without layout corruption.",
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
        "codeBlockProps/mermaidConfig: customize nested renderers.",
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
        "codeBlockProps/mermaidConfig：定制内部渲染器。",
        "components：在产品 UI 需要时覆盖 Markdown 节点。",
      ],
      interactions: [
        "未闭合代码或 Mermaid fence 在流式过程中保持稳定。",
        "高成本富文本渲染会避开提示词输入路径。",
        "内部 CodeBlock、Formula、MermaidDiagram 保留各自动作。",
      ],
      integration:
        "对不可信模型内容默认跳过 raw HTML；只有在净化后才开启 HTML 路径。",
    },
  },
  "mermaid-diagram": {
    en: {
      eyebrow: "Content",
      description: "Secure lazy rendering with retry, source copy, and controlled zoom for dense agent diagrams.",
      summary:
        "MermaidDiagram lazy-loads Mermaid, renders diagrams with strict defaults, and adds copy, zoom, reset, error, and retry controls.",
      useCases: [
        "Agent plans, execution graphs, or architecture diagrams generated as Mermaid.",
        "Dense diagrams that need zoom controls inside a message.",
        "Secure diagram rendering for untrusted model output.",
      ],
      props: [
        "chart/title/config: provide source and safe Mermaid configuration.",
        "interactive/zoom/onZoomChange: control viewport scaling.",
        "showCopySource/onCopySource: let users inspect or reuse the diagram source.",
        "renderError/onError/onRender: recover from invalid definitions.",
      ],
      interactions: [
        "Mermaid loads only when a diagram is rendered.",
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
        "interactive/zoom/onZoomChange：控制视口缩放。",
        "showCopySource/onCopySource：让用户查看或复用图表源代码。",
        "renderError/onError/onRender：从无效定义中恢复。",
      ],
      interactions: [
        "只有真正渲染图表时才加载 Mermaid。",
        "无效图表会被限制在组件内，并可修复或重试。",
        "缩放状态可以由业务 UI 或组件本地状态控制。",
      ],
      integration:
        "模型输出建议使用 strict 安全配置，并保留原始 chart 文本，方便问题报告或编辑。",
    },
  },
  "streaming-indicator": {
    en: {
      eyebrow: "Feedback",
      description: "Represent indeterminate work or measurable progress with pause, completion, tone, and motion variants.",
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
      integration:
        "把它放在正在等待的内容附近，而不是做全局遮挡，这样用户不会丢失上下文。",
    },
  },
  "tool-call-card": {
    en: {
      eyebrow: "Agent state",
      description: "Review arguments, approve risk, observe execution, reject, and recover a failed tool call.",
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
        "onApprove/onReject/onRetry/onActionError: plug in guarded async decisions.",
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
        "onApprove/onReject/onRetry/onActionError：接入受保护异步决策。",
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

const componentApiGroups: readonly ComponentApiGroup[] = [
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

const componentApiSpecs: Record<SampleKey, ComponentApiSpec> = {
  "agent-shell": {
    importName: "AgentShell",
    props: [
      { name: "children", type: "ReactNode", defaultValue: "—", required: true },
      { name: "sidebar, header, inspector, composer", type: "ReactNode", defaultValue: "undefined" },
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
      { name: "onSubmit", type: "(draft, context) => PromptSubmitResult | Promise<PromptSubmitResult>", defaultValue: "—", required: true },
      {
        name: "draft/defaultDraft/onDraftChange",
        type: "PromptDraft / (draft, context) => void",
        defaultValue: "uncontrolled empty draft",
      },
      { name: "runStatus/onStop", type: "PromptRunStatus / (context) => void | Promise<void>", defaultValue: '"idle"' },
      { name: "submitShortcut", type: '"enter" | "mod-enter" | "button-only"', defaultValue: '"enter"' },
      {
        name: "accept/maxFileSize/maxAttachments/createAttachment",
        type: "string / number / (file: File) => PromptAttachment",
        defaultValue: "undefined / 8 / built-in",
      },
      { name: "renderAttachment/leading/tools/footer", type: "ReactNode | render function", defaultValue: "undefined" },
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
      { name: "showTimestamp/formatTimestamp/statusLabels", type: "boolean / formatter / label map", defaultValue: "false / built-in" },
      { name: "classNames/styles", type: "Semantic maps by slot", defaultValue: "undefined" },
    ],
  },
  "message-actions": {
    importName: "MessageActions",
    props: [
      { name: "message", type: "AgentMessage", defaultValue: "—", required: true },
      { name: "copyText/showCopy", type: "string | (message) => string / boolean", defaultValue: "message.content / true" },
      {
        name: "feedback/showFeedback",
        type: 'MessageFeedback / boolean',
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
      { name: "index/defaultIndex/onIndexChange", type: "number / (index: number) => void", defaultValue: "0" },
      { name: "disabled", type: "boolean", defaultValue: "false" },
      { name: "previousLabel/nextLabel", type: "string", defaultValue: "built-in English labels" },
      { name: "formatCount", type: "(index: number, count: number) => ReactNode", defaultValue: "1 / n" },
    ],
  },
  "message-list": {
    importName: "MessageList",
    props: [
      { name: "messages", type: "readonly AgentMessage[]", defaultValue: "—", required: true },
      { name: "conversationKey", type: "string | number", defaultValue: "undefined" },
      { name: "renderMessage", type: "(message, context) => ReactNode", defaultValue: "<MessageBubble />" },
      {
        name: "autoScroll/followThreshold/showJumpToLatest",
        type: "boolean / number / boolean",
        defaultValue: "true / 72 / true",
      },
      { name: "onReachStart/onReachStartError", type: "(element) => void | Promise<void>", defaultValue: "undefined" },
      { name: "getLiveAnnouncement", type: "(message, context) => string | null", defaultValue: "built-in concise labels" },
    ],
  },
  "reasoning-panel": {
    importName: "ReasoningPanel",
    props: [
      { name: "children", type: "ReactNode", defaultValue: "—", required: true },
      { name: "status", type: '"idle" | "running" | "complete" | "error"', defaultValue: '"complete"' },
      { name: "open/defaultOpen/onOpenChange", type: "boolean / (open: boolean) => void", defaultValue: "uncontrolled false" },
      { name: "autoOpen", type: '"while-running" | "always" | "never"', defaultValue: '"while-running"' },
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
      { name: "autoExpand", type: '"never" | "running" | "error" | "running-and-error"', defaultValue: '"running-and-error"' },
      { name: "renderDetail", type: "(step, context) => ReactNode", defaultValue: "step.detail" },
      { name: "onRetry/onRetryError", type: "async retry handlers", defaultValue: "undefined" },
      { name: "showDuration/formatDuration", type: "boolean / formatter", defaultValue: "true / built-in" },
    ],
  },
  "code-block": {
    importName: "CodeBlock",
    props: [
      { name: "code", type: "string", defaultValue: "—", required: true },
      { name: "language/filename", type: "string / ReactNode", defaultValue: "undefined" },
      { name: "highlighter/onHighlightError", type: "CodeHighlighter / (error) => void", defaultValue: "undefined" },
      { name: "showWrapToggle/wrap/onWrapChange", type: "boolean / boolean / (wrap) => void", defaultValue: "false / uncontrolled" },
      {
        name: "collapsible/collapseAfterLines/showDownload/onCopy",
        type: "boolean / number / boolean / callback",
        defaultValue: "false / 18 / false",
      },
    ],
  },
  formula: {
    importName: "Formula",
    props: [
      { name: "formula", type: "string", defaultValue: "—", required: true },
      { name: "displayMode", type: "boolean", defaultValue: "false" },
      { name: "options", type: "Omit<KatexOptions, 'displayMode'>", defaultValue: "undefined" },
      { name: "renderError", type: "(error: Error, formula: string) => ReactNode", defaultValue: "undefined" },
      { name: "showCopy/onCopy", type: "boolean / (formula, success) => void", defaultValue: "false" },
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
      { name: "codeHighlighter/codeBlockProps", type: "CodeHighlighter / Partial<CodeBlockProps>", defaultValue: "undefined" },
      { name: "mermaidConfig", type: "SafeMermaidConfig", defaultValue: "undefined" },
      { name: "components", type: "react-markdown Components", defaultValue: "built-in components" },
    ],
  },
  "mermaid-diagram": {
    importName: "MermaidDiagram",
    props: [
      { name: "chart", type: "string", defaultValue: "—", required: true },
      { name: "config", type: "SafeMermaidConfig", defaultValue: "{}" },
      {
        name: "interactive/zoom/onZoomChange",
        type: "boolean / number / (zoom: number) => void",
        defaultValue: "true / uncontrolled 1",
      },
      { name: "showCopySource/onCopySource", type: "boolean / (chart, success) => void", defaultValue: "false" },
      { name: "renderError/onError/onRender", type: "render and lifecycle callbacks", defaultValue: "undefined" },
    ],
  },
  "streaming-indicator": {
    importName: "StreamingIndicator",
    props: [
      { name: "label/visibleLabel", type: "string / boolean", defaultValue: '"Generating response" / false' },
      { name: "variant", type: '"dots" | "pulse" | "wave"', defaultValue: '"dots"' },
      { name: "tone", type: '"neutral" | "accent" | "success" | "danger"', defaultValue: '"neutral"' },
      { name: "active/progress", type: "boolean / number", defaultValue: "true / undefined" },
      { name: "announce", type: "boolean", defaultValue: "true" },
    ],
  },
  "tool-call-card": {
    importName: "ToolCallCard",
    props: [
      { name: "toolName", type: "string", defaultValue: "—", required: true },
      { name: "description/arguments/result/error", type: "ReactNode / unknown payloads", defaultValue: "undefined" },
      { name: "status/risk", type: "ToolCallStatus / ToolCallRisk", defaultValue: '"draft" / "low"' },
      {
        name: "expanded/onExpandedChange/autoOpen",
        type: "boolean / (expanded) => void / ToolCallAutoOpen",
        defaultValue: 'uncontrolled / "attention"',
      },
      {
        name: "onApprove/onReject/onRetry/onActionError",
        type: "async guarded action handlers",
        defaultValue: "undefined",
      },
      { name: "renderValue/statusLabels/riskLabels", type: "render callback / label maps", defaultValue: "built-in" },
    ],
  },
};

function getPropDescription(doc: ComponentDoc, propName: string): string {
  const normalizedName = propName.toLowerCase();
  const aliases = propName
    .split(/[/,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const match = doc.props.find((item) => {
    const [name] = item.split(":");
    const normalizedDocName = name?.trim().toLowerCase();
    if (!normalizedDocName) return false;
    if (normalizedDocName === normalizedName) return true;
    const docAliases = normalizedDocName
      .split(/[/,]/)
      .map((part) => part.trim())
      .filter(Boolean);
    return aliases.some(
      (alias) =>
        docAliases.includes(alias) ||
        normalizedDocName.includes(alias) ||
        normalizedName.includes(normalizedDocName),
    );
  });
  if (!match) return doc.props[0] ?? doc.summary;
  const [, ...description] = match.split(":");
  return description.join(":").trim() || match;
}

const demoConversationCopy: Record<
  Locale,
  Record<string, { title: string; preview: string; age: string }>
> = {
  en: {
    launch: { title: "Launch narrative", preview: "Refining the product story", age: "Now" },
    research: { title: "Research synthesis", preview: "12 sources connected", age: "18m" },
    architecture: { title: "Runtime architecture", preview: "SSE transport mapped", age: "1h" },
  },
  zh: {
    launch: { title: "发布叙事", preview: "正在打磨产品故事", age: "刚刚" },
    research: { title: "研究综合", preview: "已连接 12 个来源", age: "18 分钟" },
    architecture: { title: "运行时架构", preview: "SSE 传输已映射", age: "1 小时" },
  },
};

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem("velora-locale");
  if (saved === "en" || saved === "zh") return saved;
  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function localizeConversations<T extends (typeof demoConversations)[number]>(
  conversations: readonly T[],
  locale: Locale,
): T[] {
  return conversations.map((conversation) => {
    const localized = demoConversationCopy[locale][conversation.id];
    if (!localized) return conversation;
    return {
      ...conversation,
      title: localized.title,
      metadata: {
        ...conversation.metadata,
        preview: localized.preview,
        age: localized.age,
      },
    };
  });
}

const demoConversations = [
  {
    id: "launch",
    title: "Launch narrative",
    messageIds: ["user-demo", "assistant-demo"],
    createdAt: 1_752_787_200_000,
    updatedAt: 1_752_790_800_000,
    metadata: { preview: "Refining the product story", age: "Now", status: "idle" },
  },
  {
    id: "research",
    title: "Research synthesis",
    messageIds: ["research-user", "research-assistant"],
    createdAt: 1_752_700_800_000,
    updatedAt: 1_752_789_720_000,
    metadata: { preview: "12 sources connected", age: "18m", status: "unread" },
  },
  {
    id: "architecture",
    title: "Runtime architecture",
    messageIds: ["architecture-user", "architecture-assistant"],
    createdAt: 1_752_614_400_000,
    updatedAt: 1_752_787_200_000,
    metadata: { preview: "SSE transport mapped", age: "1h", status: "idle" },
  },
];

const assistantMessage = {
  id: "assistant-demo",
  conversationId: "launch",
  role: "assistant" as const,
  content:
    "The interface is ready. Every token, tool call, and reasoning state can render progressively without blocking the main thread.",
  status: "complete" as const,
  createdAt: 1_752_790_760_000,
  updatedAt: 1_752_790_800_000,
};

const demoMessages = [
  {
    id: "user-demo",
    conversationId: "launch",
    role: "user" as const,
    content: "Design a calmer onboarding flow for our AI workspace.",
    status: "complete" as const,
    createdAt: 1_752_790_720_000,
    updatedAt: 1_752_790_720_000,
  },
  assistantMessage,
];

const researchMessages: readonly AgentMessage[] = [
  {
    id: "research-user",
    conversationId: "research",
    role: "user",
    content: "Synthesize the strongest patterns across the connected sources.",
    status: "complete",
    createdAt: 1_752_789_600_000,
    updatedAt: 1_752_789_600_000,
  },
  {
    id: "research-assistant",
    conversationId: "research",
    role: "assistant",
    content:
      "The clearest pattern is progressive disclosure: reveal depth on demand while preserving the current task context.",
    status: "complete",
    createdAt: 1_752_789_660_000,
    updatedAt: 1_752_789_720_000,
  },
];

const architectureMessages: readonly AgentMessage[] = [
  {
    id: "architecture-user",
    conversationId: "architecture",
    role: "user",
    content: "Map the event path from transport to rendered message.",
    status: "complete",
    createdAt: 1_752_787_080_000,
    updatedAt: 1_752_787_080_000,
  },
  {
    id: "architecture-assistant",
    conversationId: "architecture",
    role: "assistant",
    content:
      "SSE events enter the transport, normalize into the external store, then update only the subscribed message rows.",
    status: "complete",
    createdAt: 1_752_787_140_000,
    updatedAt: 1_752_787_200_000,
  },
];

const seededDemoMessages: readonly AgentMessage[] = [
  ...demoMessages,
  ...researchMessages,
  ...architectureMessages,
];

const demoSteps = [
  { id: "intent", title: "Understand intent", status: "complete" as const },
  { id: "patterns", title: "Compare patterns", status: "complete" as const },
  { id: "compose", title: "Compose response", status: "running" as const },
];

const samples: Sample[] = [
  {
    key: "agent-shell",
    name: "AgentShell",
    eyebrow: "Layout",
    description: "A responsive agent workspace with isolated drafts, streaming turns, and interruption.",
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
    description: "Compose message content with attachments, response branches, actions, and terminal state.",
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
    description: "Copy, edit, regenerate, and persist feedback with pending, success, and rollback states.",
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
    description: "Navigate alternative model responses and create a new branch without replacing history.",
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
    description: "Track live duration, waiting states, failure details, expansion, and asynchronous retry.",
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
    description: "Recover async highlighting and let users wrap, collapse, copy, or download generated code.",
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
        <output>{invalid ? "Error fallback" : displayMode ? "Display math" : "Inline math"}</output>
      </div>
      <div className="live-formula-stage">
        <Formula
          formula={formula}
          displayMode={displayMode}
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
      </div>
      <MermaidDiagram
        title={mode === "loop" ? "Prompt sequence" : "Streaming event path"}
        chart={charts[mode]}
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
    <div className="live-demo live-centered live-streaming-demo">
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
    description: "Review arguments, approve risk, observe execution, reject, and recover a failed tool call.",
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

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function useDemoAgent(conversationId: string) {
  const transport = useMemo(() => createSSETransport({ url: "/api/demo/stream" }), []);
  const storeRef = useRef<ReturnType<typeof createAgentStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createAgentStore({
      conversations: demoConversations,
      messages: seededDemoMessages,
    });
  }

  return useAgentChat({ transport, conversationId, store: storeRef.current });
}

const HeroAgent = memo(function HeroAgent({ locale }: { locale: Locale }) {
  const t = siteCopy[locale].agent;
  const [conversations, setConversations] = useState(() => [...demoConversations]);
  const [activeConversation, setActiveConversation] = useState("launch");
  const [model, setModel] = useState("velora-pro");
  const [tool, setTool] = useState("workspace");
  const [toolStatus, setToolStatus] = useState<ToolCallStatus>("approval-required");
  const [toolExpanded, setToolExpanded] = useState(false);
  const [toolResult, setToolResult] = useState<Record<string, unknown> | undefined>();
  const [composerNotice, setComposerNotice] = useState(t.initialNotice);
  const [feedbackByMessage, setFeedbackByMessage] = useState<
    Record<string, "like" | "dislike" | null>
  >({});
  const drafts = usePromptDrafts();
  const draftCounter = useRef(0);
  const chat = useDemoAgent(activeConversation);
  const renderedConversations = useMemo(
    () => localizeConversations(conversations, locale),
    [conversations, locale],
  );
  const visibleMessages = chat.messages;
  const latestAssistant = [...visibleMessages]
    .reverse()
    .find((message) => message.role === "assistant");
  const visibleSteps = latestAssistant?.steps?.length
    ? latestAssistant.steps
    : visibleMessages.length
      ? demoSteps
      : [];
  const visibleReasoning =
    latestAssistant?.reasoning ||
    (visibleMessages.length
      ? "The response prioritizes legibility, continuity, and reversible actions before visual novelty."
      : "Reasoning will appear after the first response begins.");
  const activeTitle =
    renderedConversations.find((conversation) => conversation.id === activeConversation)?.title ??
    "Agent workspace";
  const modelLabel =
    model === "velora-pro" ? "Velora Pro" : model === "velora-fast" ? "Velora Fast" : t.local;
  const toolLabel =
    tool === "workspace" ? t.applyPatch : tool === "search" ? t.searchSources : t.noTool;

  useEffect(() => {
    setComposerNotice(t.initialNotice);
  }, [t.initialNotice]);

  useEffect(() => {
    setToolStatus(tool === "none" ? "draft" : "approval-required");
    setToolResult(undefined);
    setToolExpanded(false);
  }, [tool]);

  const handleSubmit = useCallback(
    (draft: PromptDraft) => {
      if (tool !== "none" && toolStatus !== "complete") {
        setToolExpanded(true);
        return {
          accepted: false as const,
          error: tool === "workspace" ? t.approveWorkspace : t.approveSources,
        };
      }

      const input =
        draft.text.trim() ||
        `Review ${draft.attachments.length} attached ${draft.attachments.length === 1 ? "file" : "files"}.`;
      const result = chat.send(input, {
        metadata: { model, tool },
        requestMetadata: { model, tool },
        attachments: draft.attachments.map((attachment) => ({
          id: attachment.id,
          name: attachment.file.name,
          kind: attachment.file.type.startsWith("image/") ? "image" : "file",
          mimeType: attachment.file.type || undefined,
          size: attachment.file.size,
        })),
      });

      if (!result.accepted) {
        return {
          accepted: false as const,
          error: result.reason === "busy" ? t.busy : t.empty,
        };
      }

      setComposerNotice(`${t.acceptedBy} ${modelLabel} · ${toolLabel}`);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeConversation
            ? {
                ...conversation,
                updatedAt: Date.now(),
                metadata: {
                  ...conversation.metadata,
                  preview: input.slice(0, 42),
                  age: "Now",
                  status: "idle",
                },
              }
            : conversation,
        ),
      );
      void result.completion.then((outcome) => {
        setComposerNotice(
          outcome.outcome === "complete"
            ? t.responseComplete
            : outcome.outcome === "aborted"
              ? t.generationStopped
              : t.streamNeedsAttention,
        );
      });
      return { accepted: true as const };
    },
    [activeConversation, chat, model, modelLabel, t, tool, toolLabel, toolStatus],
  );
  const handleConversationChange = useCallback(
    (id: string) => {
      chat.stop();
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === id
            ? {
                ...conversation,
                metadata: { ...conversation.metadata, status: "idle" },
              }
            : conversation,
        ),
      );
      setActiveConversation(id);
    },
    [chat],
  );
  const handleNewConversation = useCallback(() => {
    chat.stop();
    draftCounter.current += 1;
    const draftNumber = draftCounter.current;
    const id = `draft-${draftNumber}`;
    const now = Date.now();
    setConversations((current) => [
      {
        id,
        title: `${t.untitled} ${draftNumber}`,
        messageIds: [],
        createdAt: now,
        updatedAt: now,
        metadata: { preview: t.startDirection, age: locale === "zh" ? "刚刚" : "Now", status: "idle" },
      },
      ...current,
    ]);
    setActiveConversation(id);
  }, [chat, locale, t.startDirection, t.untitled]);
  const regenerate = useCallback(async () => {
    const result = chat.retry({ requestMetadata: { model, tool } });
    if (!result.accepted) throw new Error("No completed user turn is available to retry.");
    const outcome = await result.completion;
    if (outcome.outcome === "error") {
      throw new Error(outcome.error?.message ?? "Regeneration failed.");
    }
  }, [chat, model, tool]);
  const renderMessage = useCallback(
    (message: AgentMessage) => {
      if (message.role !== "assistant") {
        return <MessageBubble message={message} />;
      }
      return (
        <MessageBubble
          message={message}
          actions={
            <MessageActions
              message={message}
              feedback={feedbackByMessage[message.id] ?? null}
              onRegenerate={message.status === "complete" ? regenerate : undefined}
              onFeedbackChange={async (feedback) => {
                await new Promise((resolve) => window.setTimeout(resolve, 320));
                setFeedbackByMessage((current) => ({
                  ...current,
                  [message.id]: feedback,
                }));
              }}
            />
          }
        >
          <MarkdownRenderer content={message.content} streaming={message.status === "streaming"} />
        </MessageBubble>
      );
    },
    [feedbackByMessage, regenerate],
  );

  return (
    <div className="agent-stage" aria-label={t.aria}>
      <div className="agent-aura agent-aura-one" />
      <div className="agent-aura agent-aura-two" />
      <div className="agent-window glass-panel">
        <aside className="agent-rail" aria-label={t.conversations}>
          <div className="agent-rail-top">
            <span className="mini-brand">
              <BrandMark />
            </span>
            <button
              className="icon-button"
              type="button"
              aria-label={t.newConversation}
              onClick={handleNewConversation}
            >
              <Sparkles size={14} />
            </button>
          </div>
          <ConversationList
            conversations={renderedConversations}
            activeId={activeConversation}
            onActiveChange={handleConversationChange}
            searchable
            onCreate={handleNewConversation}
            getDescription={(conversation) => String(conversation.metadata?.preview ?? "")}
            getMeta={(conversation) => String(conversation.metadata?.age ?? "")}
            getStatus={(conversation) => {
              if (conversation.id === activeConversation) {
                if (chat.isStreaming) return "streaming";
                if (chat.error) return "error";
                return "idle";
              }
              return conversation.metadata?.status === "unread" ? "unread" : "idle";
            }}
          />
          <div className="rail-user">
            <span>W</span>
            <span className="rail-user-copy">
              <strong>{t.workspace}</strong>
              <small>{t.previewPlan}</small>
            </span>
          </div>
        </aside>

        <section className="agent-main">
          <header className="agent-header">
            <div>
              <span className="agent-header-kicker">{t.kicker}</span>
              <h2>{activeTitle}</h2>
            </div>
            <div className="model-pill">
              <span className="status-dot" />
              {modelLabel}
              <ChevronRight size={12} />
            </div>
          </header>

          <div className="agent-feed">
            <MessageList
              conversationKey={activeConversation}
              messages={visibleMessages}
              renderMessage={renderMessage}
              autoScroll
            />
            {chat.isStreaming ? (
              <div className="hero-streaming">
                <StreamingIndicator label={t.composing} />
              </div>
            ) : null}
            {chat.error ? (
              <div className="agent-stream-error" role="alert">
                <span>
                  {t.streamError} {chat.error.message}
                </span>
                {chat.error.retryable !== false ? (
                  <button type="button" onClick={() => void chat.retry()}>
                    {t.retry}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="agent-context-row">
            <div className="agent-step-compact">
              <AgentSteps steps={visibleSteps} />
            </div>
            <ToolCallCard
              style={{ maxHeight: "none", overflow: "visible" }}
              toolName={
                tool === "workspace"
                  ? "workspace.apply_patch"
                  : tool === "search"
                    ? "sources.search"
                    : t.noToolSelected
              }
              description={tool === "none" ? t.modelOnly : t.reviewBeforeExecution}
              arguments={{
                conversation: activeConversation,
                model,
                intent: visibleReasoning,
              }}
              result={toolResult}
              status={toolStatus}
              risk={tool === "workspace" ? "high" : "low"}
              expanded={toolExpanded}
              onExpandedChange={setToolExpanded}
              onApprove={
                tool === "none"
                  ? undefined
                  : async () => {
                      setComposerNotice(t.verifyingApproval);
                      await new Promise((resolve) => window.setTimeout(resolve, 520));
                      setToolStatus("running");
                      setComposerNotice(t.runningTool);
                      await new Promise((resolve) => window.setTimeout(resolve, 760));
                      setToolResult({ approved: true, checkpoint: "velora-preview-42" });
                      setToolStatus("complete");
                      setComposerNotice(t.approvalNotice);
                    }
              }
              onReject={
                tool === "none"
                  ? undefined
                  : async () => {
                      await new Promise((resolve) => window.setTimeout(resolve, 420));
                      setToolStatus("cancelled");
                      setComposerNotice(t.rejectedTool);
                    }
              }
              onRetry={async () => {
                await new Promise((resolve) => window.setTimeout(resolve, 420));
                setToolStatus("approval-required");
                setComposerNotice(t.approvalRestored);
              }}
              onActionError={(error) => setComposerNotice(String(error))}
            />
          </div>

          <div className="agent-composer">
            <PromptComposer
              draft={drafts.getDraft(activeConversation)}
              onDraftChange={(draft) => drafts.setDraft(activeConversation, draft)}
              onSubmit={handleSubmit}
              onStop={() => {
                chat.stop();
                setComposerNotice(t.stopped);
              }}
              runStatus={chat.isStreaming ? "streaming" : chat.error ? "error" : "idle"}
              placeholder={t.placeholder}
              accept="image/*,.pdf,.md,.txt,.tsx,.ts"
              maxFileSize={8 * 1024 * 1024}
              maxAttachments={5}
              tools={
                <>
                  <select
                    aria-label="Model"
                    value={model}
                    onChange={(event) => setModel(event.currentTarget.value)}
                  >
                    <option value="velora-pro">Velora Pro</option>
                    <option value="velora-fast">Velora Fast</option>
                    <option value="local">{t.local}</option>
                  </select>
                  <select
                    aria-label="Tool"
                    value={tool}
                    onChange={(event) => setTool(event.currentTarget.value)}
                  >
                    <option value="workspace">{t.applyPatch}</option>
                    <option value="search">{t.searchSources}</option>
                    <option value="none">{t.noTool}</option>
                  </select>
                </>
              }
              footer={<span>{composerNotice}</span>}
              onAttachmentsAdd={(attachments, context) => {
                const label =
                  locale === "zh"
                    ? `${attachments.length} ${t.addedFrom} ${context.source}`
                    : `${attachments.length} ${
                        attachments.length === 1 ? "file" : "files"
                      } ${t.addedFrom} ${context.source}`;
                setComposerNotice(label);
              }}
              onAttachmentsRejected={(rejections) =>
                setComposerNotice(
                  locale === "zh"
                    ? `${rejections.length} ${t.attachmentRejected}`
                    : `${rejections.length} ${t.attachmentRejected}`,
                )
              }
            />
            <div className="composer-footnote">
              <span>
                <Command size={11} /> {t.footnoteSend}
              </span>
              <span>
                {t.simulated} · {chat.isStreaming ? t.streaming : t.ready}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
});

function Navbar({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) {
  const t = siteCopy[locale].nav;
  const nextLocale = locale === "en" ? "zh" : "en";
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <header className="site-header">
      <nav className="nav-shell glass-panel" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Velora home">
          <BrandMark />
          <span>Velora</span>
          <sup>alpha</sup>
        </a>

        <div id="primary-links" className={`nav-links ${open ? "is-open" : ""}`}>
          <a href="#components" onClick={() => setOpen(false)}>
            {t.components}
          </a>
          <a href="#api" onClick={() => setOpen(false)}>
            {t.api}
          </a>
          <a href="#runtime" onClick={() => setOpen(false)}>
            {t.runtime}
          </a>
          <a href="#principles" onClick={() => setOpen(false)}>
            {t.principles}
          </a>
          <a href="#open-source" onClick={() => setOpen(false)}>
            {t.openSource}
          </a>
        </div>

        <div className="nav-actions">
          <button
            className="language-toggle"
            type="button"
            aria-label={`${t.languageLabel}: ${localeNames[nextLocale]}`}
            onClick={() => onLocaleChange(nextLocale)}
          >
            <Globe2 size={14} />
            <span>{t.languageValue}</span>
          </button>
          <a className="nav-github" href="#open-source">
            <Braces size={15} />
            <span>{t.openSource}</span>
          </a>
          <a className="nav-cta" href="#components">
            {t.explore}
            <ArrowRight size={14} />
          </a>
          <button
            ref={menuButtonRef}
            className="nav-menu"
            type="button"
            aria-expanded={open}
            aria-controls="primary-links"
            aria-label={open ? t.menuClose : t.menuOpen}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>
    </header>
  );
}

function Hero({ locale }: { locale: Locale }) {
  const t = siteCopy[locale].hero;
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyInstall = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("npm run dev");
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, []);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  return (
    <section className="hero section-shell" id="top">
      <div className="hero-grid" />
      <div className="hero-copy">
        <div className="hero-kicker">
          <span className="pulse-orbit">
            <span />
          </span>
          {t.kicker}
          <ChevronRight size={12} />
        </div>
        <h1>
          {t.title} <span>{t.titleAccent}</span>
        </h1>
        <p className="hero-lede">
          {t.lede}
        </p>

        <div className="hero-actions">
          <a className="primary-button" href="#components">
            {t.explore}
            <ArrowRight size={16} />
          </a>
          <button className="install-command" type="button" onClick={copyInstall}>
            <TerminalSquare size={15} />
            <code>npm run dev</code>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span className="sr-only">{t.copyCommand}</span>
          </button>
        </div>

        <dl
          className="hero-metrics"
          aria-label={locale === "zh" ? "组件库能力" : "Library capabilities"}
        >
          {t.metrics.map(([value, label]) => (
            <div key={label}>
              <dt>{value}</dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <HeroAgent locale={locale} />
    </section>
  );
}

function AccessibleLiveEditor() {
  const editorRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = editorRootRef.current;
    if (!root) return undefined;
    const configureEditor = () => {
      const editor = root.querySelector<HTMLElement>(
        "[contenteditable]:not([contenteditable='false'])",
      );
      if (!editor) return;
      editor.setAttribute("role", "textbox");
      editor.setAttribute("aria-multiline", "true");
      editor.setAttribute("aria-label", "Editable TypeScript component example");
    };
    configureEditor();
    const observer = new MutationObserver(configureEditor);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={editorRootRef}
      className="editor-wrap"
      role="group"
      aria-label="Code editor; Tab moves focus out of the editor"
    >
      <LiveEditor className="live-editor" tabMode="focus" />
    </div>
  );
}

function ComponentDocPanel({
  doc,
  labels,
}: {
  doc: ComponentDoc;
  labels: {
    guide: string;
    useFor: string;
    props: string;
    behavior: string;
    integration: string;
  };
}) {
  return (
    <details className="component-doc-panel" aria-label={`${doc.description} ${labels.guide}`}>
      <summary className="doc-summary">
        <span>
          <BookOpen size={13} />
          {labels.guide}
        </span>
        <p>{doc.summary}</p>
        <ChevronRight className="doc-summary-chevron" size={14} />
      </summary>
      <div className="component-doc-panel__body">
        <div className="doc-grid">
          <article>
            <h4>{labels.useFor}</h4>
            <ul>
              {doc.useCases.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article>
            <h4>{labels.props}</h4>
            <ul>
              {doc.props.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article>
            <h4>{labels.behavior}</h4>
            <ul>
              {doc.interactions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
        <div className="doc-integration">
          <strong>{labels.integration}</strong>
          <span>{doc.integration}</span>
        </div>
      </div>
    </details>
  );
}

function ComponentWorkbench({
  locale,
  activeKey,
  onActiveKeyChange,
}: {
  locale: Locale;
  activeKey: SampleKey;
  onActiveKeyChange: (key: SampleKey) => void;
}) {
  const t = siteCopy[locale].workbench;
  const [copied, setCopied] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [viewport, setViewport] = useState<ViewportKey>("desktop");
  const [mobilePane, setMobilePane] = useState<"preview" | "code">("preview");
  const sectionRef = useRef<HTMLElement | null>(null);
  const catalogRef = useRef<HTMLDivElement | null>(null);
  const activeSample = samples.find((sample) => sample.key === activeKey) ?? samples[0];
  const activeDoc = componentDocs[activeSample.key][locale];
  const viewportOptions = [
    { key: "desktop" as const, label: t.viewports.desktop, Icon: Monitor },
    { key: "tablet" as const, label: t.viewports.tablet, Icon: Tablet },
    { key: "mobile" as const, label: t.viewports.mobile, Icon: Smartphone },
  ];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setEditorReady(true);
      return undefined;
    }
    const fallback = window.setTimeout(() => setEditorReady(true), 1_200);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        window.clearTimeout(fallback);
        setEditorReady(true);
        observer.disconnect();
      },
      { rootMargin: "240px" },
    );
    observer.observe(section);
    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 720px)");
    const syncViewport = () => {
      if (mobileQuery.matches) setViewport("mobile");
    };
    syncViewport();
    mobileQuery.addEventListener("change", syncViewport);
    return () => mobileQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 980px)").matches) return;
    const catalog = catalogRef.current;
    const activeButton = catalog?.querySelector<HTMLButtonElement>(
      'button[aria-pressed="true"]',
    );
    if (!catalog || !activeButton || catalog.scrollWidth <= catalog.clientWidth) return;
    const target =
      activeButton.offsetLeft - (catalog.clientWidth - activeButton.offsetWidth) / 2;
    catalog.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeKey, locale]);

  const scope = useMemo(
    () => ({
      AgentSteps,
      AgentShell,
      CodeBlock,
      ConversationList,
      Formula,
      MarkdownRenderer,
      MermaidDiagram,
      MessageActions,
      MessageBranchNavigator,
      MessageBubble,
      MessageList,
      PromptComposer,
      ReasoningPanel,
      StreamingIndicator,
      ToolCallCard,
      VeloraProvider,
      usePromptDrafts,
      useCallback,
      useEffect,
      useMemo,
      useRef,
      useState,
    }),
    [],
  );

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeSample.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [activeSample.code]);

  return (
    <section ref={sectionRef} className="workbench-section section-shell">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            <Braces size={14} /> {t.kicker}
          </span>
          <h2>{t.title}</h2>
        </div>
        <p>{t.lede}</p>
      </div>

      <div id="components" className="workbench glass-panel">
        <aside className="component-catalog" aria-label={t.catalog}>
          <div className="catalog-heading">
            <span>{t.catalog}</span>
            <span>{samples.length}</span>
          </div>
          <div ref={catalogRef} className="catalog-list">
            {samples.map((sample) => {
              const doc = componentDocs[sample.key][locale];
              return (
                <button
                  key={sample.key}
                  className={activeKey === sample.key ? "is-active" : ""}
                  type="button"
                  aria-pressed={activeKey === sample.key}
                  onClick={() => onActiveKeyChange(sample.key)}
                >
                  <span>
                    <small>{doc.eyebrow}</small>
                    <strong>{sample.name}</strong>
                  </span>
                  <ChevronRight size={14} />
                </button>
              );
            })}
          </div>
          <div className="catalog-note">
            <Sparkles size={14} />
            <p>{t.catalogNote}</p>
          </div>
        </aside>

        <div className="workbench-main">
          <div className="workbench-titlebar">
            <div>
              <span className="component-badge">{activeDoc.eyebrow}</span>
              <h3>{activeSample.name}</h3>
              <p>{activeDoc.description}</p>
            </div>
            <span className="stable-badge">
              <span /> {t.stable}
            </span>
          </div>

          {editorReady ? (
            <Suspense
              fallback={
                <div className="workbench-loading" role="status">
                  <StreamingIndicator label={t.loadingEditor} visibleLabel />
                </div>
              }
            >
            <LiveProvider
              key={activeSample.key}
              code={activeSample.code}
              scope={scope}
              language="tsx"
              enableTypeScript
              noInline
            >
              <div
                className="mobile-workbench-tabs"
                role="tablist"
                aria-label={t.viewportLabel}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobilePane === "preview"}
                  aria-controls="mobile-preview-pane"
                  onClick={() => setMobilePane("preview")}
                >
                  <Play size={13} />
                  {t.preview}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobilePane === "code"}
                  aria-controls="mobile-code-pane"
                  onClick={() => setMobilePane("code")}
                >
                  <Code2 size={13} />
                  {t.appFile}
                </button>
              </div>
              <div className="workbench-grid" data-mobile-pane={mobilePane}>
                <div
                  id="mobile-preview-pane"
                  className="preview-pane"
                  role="tabpanel"
                >
                  <div className="pane-bar">
                    <span>
                      <Play size={12} /> {t.preview}
                    </span>
                    <div className="viewport-switcher" aria-label={t.viewportLabel}>
                      {viewportOptions.map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          className={viewport === key ? "is-active" : ""}
                          type="button"
                          aria-label={label}
                          aria-pressed={viewport === key}
                          onClick={() => setViewport(key)}
                        >
                          <Icon size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="live-preview-shell" data-viewport={viewport}>
                    <div className="preview-light preview-light-one" />
                    <div className="preview-light preview-light-two" />
                    <LivePreview className="live-preview" />
                  </div>
                </div>

                <div
                  id="mobile-code-pane"
                  className="code-pane"
                  role="tabpanel"
                >
                  <div className="pane-bar code-pane-bar">
                    <span>
                      <Code2 size={12} /> {t.appFile}
                    </span>
                    <button
                      type="button"
                      onClick={copyCode}
                      aria-label={`${t.copy} ${activeSample.name}`}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? t.copied : t.copy}
                    </button>
                  </div>
                  <AccessibleLiveEditor />
                  <LiveError className="live-error" />
                </div>
              </div>
            </LiveProvider>
            </Suspense>
          ) : (
            <div className="workbench-loading" role="status">
              {t.loadsInView}
            </div>
          )}

          <ComponentDocPanel doc={activeDoc} labels={t.docs} />

          <div className="workbench-footer">
            <span>
              <Zap size={12} /> {t.liveCompilation}
            </span>
            <span>React 19</span>
            <span>TypeScript</span>
            <span>{t.keyboardAware}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function getUsageSnippet(key: SampleKey): string {
  switch (key) {
    case "agent-shell":
      return `<AgentShell sidebar={sessions} composer={composer} inspector={trace}>
  <MessageList messages={messages} />
</AgentShell>`;
    case "velora-provider":
      return `<VeloraProvider theme="dark" density="comfortable" tokens={{ accent: "#7f96ff" }}>
  <YourAgentSurface />
</VeloraProvider>`;
    case "conversation-list":
      return `<ConversationList
  conversations={conversations}
  activeId={activeId}
  onActiveChange={setActiveId}
/>`;
    case "prompt-composer":
      return `<PromptComposer
  draft={draft}
  onDraftChange={setDraft}
  runStatus={runStatus}
  onSubmit={sendPrompt}
/>`;
    case "message-bubble":
      return `<MessageBubble message={message}>
  <MarkdownRenderer content={message.content} streaming={message.status === "streaming"} />
</MessageBubble>`;
    case "message-actions":
      return `<MessageActions
  message={message}
  feedback={feedback}
  onRegenerate={regenerate}
  onFeedbackChange={saveFeedback}
/>`;
    case "message-branch-navigator":
      return `<MessageBranchNavigator
  count={branches.length}
  index={activeBranch}
  onIndexChange={setActiveBranch}
/>`;
    case "message-list":
      return `<MessageList
  conversationKey={activeConversationId}
  messages={messages}
  onReachStart={loadOlderMessages}
/>`;
    case "reasoning-panel":
      return `<ReasoningPanel status={run.status} startedAt={run.startedAt}>
  {run.reasoningSummary}
</ReasoningPanel>`;
    case "agent-steps":
      return `<AgentSteps
  steps={run.steps}
  autoExpand="running-and-error"
  onRetry={retryStep}
/>`;
    case "code-block":
      return `<CodeBlock
  code={generatedCode}
  language="tsx"
  filename="AgentPanel.tsx"
  showWrapToggle
/>`;
    case "formula":
      return `<Formula
  formula="E = mc^2"
  displayMode
  showCopy
/>`;
    case "markdown-renderer":
      return `<MarkdownRenderer
  content={assistantMessage.content}
  streaming={assistantMessage.status === "streaming"}
/>`;
    case "mermaid-diagram":
      return `<MermaidDiagram
  chart={diagramSource}
  showCopySource
  interactive
/>`;
    case "streaming-indicator":
      return `<StreamingIndicator
  label="Planning response"
  variant="wave"
  visibleLabel
/>`;
    case "tool-call-card":
      return `<ToolCallCard
  toolName="apply_patch"
  status="approval-required"
  risk="high"
  arguments={toolArgs}
  onApprove={approveTool}
/>`;
  }
}

function ComponentApiSection({
  locale,
  onSelectComponent,
}: {
  locale: Locale;
  onSelectComponent: (key: SampleKey) => void;
}) {
  const t = siteCopy[locale].api;

  return (
    <section className="api-section section-shell" id="api">
      <div className="section-heading api-heading">
        <div>
          <span className="section-kicker">
            <BookOpen size={14} /> {t.kicker}
          </span>
          <h2>{t.title}</h2>
        </div>
        <p>{t.lede}</p>
      </div>

      <div className="api-layout">
        <aside className="api-nav glass-panel" aria-label={t.navLabel}>
          {componentApiGroups.map((group) => (
            <div className="api-nav-group" key={group.id}>
              <span>{group.title[locale]}</span>
              <p>{group.description[locale]}</p>
              <div>
                {group.keys.map((key) => {
                  const sample = samples.find((item) => item.key === key);
                  return sample ? (
                    <a href={`#api-${key}`} key={key}>
                      {sample.name}
                    </a>
                  ) : null;
                })}
              </div>
            </div>
          ))}
        </aside>

        <div className="api-content">
          {componentApiGroups.flatMap((group) =>
            group.keys.map((key) => {
              const sample = samples.find((item) => item.key === key);
              if (!sample) return null;
              const doc = componentDocs[key][locale];
              const spec = componentApiSpecs[key];
              const importStatement = `import { ${spec.importName} } from "@velora-ai/react";`;

              return (
                <article className="api-card glass-panel" id={`api-${key}`} key={key}>
                  <div className="api-card-head">
                    <div>
                      <span className="component-badge">{doc.eyebrow}</span>
                      <h3>{sample.name}</h3>
                      <p>{doc.description}</p>
                    </div>
                    <a
                      className="api-demo-link"
                      href="#components"
                      onClick={() => onSelectComponent(key)}
                    >
                      {t.editDemo}
                      <ChevronRight size={14} />
                    </a>
                  </div>

                  <div className="api-overview-grid">
                    <section>
                      <h4>{t.overview}</h4>
                      <p>{doc.summary}</p>
                    </section>
                    <section>
                      <h4>{t.useCases}</h4>
                      <ul>
                        {doc.useCases.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  </div>

                  <div className="api-usage-grid">
                    <section>
                      <h4>{t.importLabel}</h4>
                      <pre>
                        <code>{importStatement}</code>
                      </pre>
                    </section>
                    <section>
                      <h4>{t.quickUse}</h4>
                      <pre>
                        <code>{getUsageSnippet(key)}</code>
                      </pre>
                    </section>
                  </div>

                  <div
                    className="api-table-wrap"
                    role="region"
                    aria-label={`${sample.name} ${t.api}`}
                  >
                    <table className="api-table">
                      <thead>
                        <tr>
                          <th>{t.prop}</th>
                          <th>{t.type}</th>
                          <th>{t.defaultValue}</th>
                          <th>{t.description}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spec.props.map((prop) => (
                          <tr key={prop.name}>
                            <td>
                              <code>{prop.name}</code>
                              {prop.required ? <span>{t.required}</span> : null}
                            </td>
                            <td>
                              <code>{prop.type}</code>
                            </td>
                            <td>
                              <code>{prop.defaultValue === "—" ? t.emptyDefault : prop.defaultValue}</code>
                            </td>
                            <td>{getPropDescription(doc, prop.name)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="api-contract-grid">
                    <section>
                      <h4>{t.interaction}</h4>
                      <ul>
                        {doc.interactions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                    <section>
                      <h4>{t.integration}</h4>
                      <p>{doc.integration}</p>
                    </section>
                  </div>
                </article>
              );
            }),
          )}
        </div>
      </div>
    </section>
  );
}

function RuntimeSection({ locale }: { locale: Locale }) {
  const t = siteCopy[locale].runtime;
  const pipeline = siteCopy[locale].pipeline;

  return (
    <section className="runtime-section section-shell" id="runtime">
      <div className="runtime-intro">
        <span className="section-kicker">
          <Radio size={14} /> {t.kicker}
        </span>
        <h2>{t.title}</h2>
        <p>{t.lede}</p>
        <div className="runtime-code">
          <div className="runtime-code-bar">
            <span>
              <span className="code-dot code-dot-red" />
              <span className="code-dot code-dot-yellow" />
              <span className="code-dot code-dot-green" />
            </span>
            <code>agent.tsx</code>
          </div>
          <pre>
            <code>
              <span className="code-purple">const</span> transport ={" "}
              <span className="code-blue">createSSETransport</span>({`{`} url:{" "}
              <span className="code-green">&quot;/api/chat&quot;</span> {`}`});{"\n"}
              <span className="code-purple">const</span> agent ={" "}
              <span className="code-blue">useAgentChat</span>({`{`} transport {`}`});{"\n\n"}
              <span className="code-muted">{t.codeComment}</span>
              {"\n"}
              {"<"}
              <span className="code-blue">MessageList</span> messages={"{"}agent.messages{"}"} /
              {">"}
            </code>
          </pre>
        </div>
      </div>

      <div
        className="pipeline"
        aria-label={locale === "zh" ? "Velora 事件链路" : "Velora event pipeline"}
      >
        {pipeline.map((item, index) => {
          const Icon = item.icon;
          return (
            <div className="pipeline-row" key={item.title}>
              <div className="pipeline-spine" aria-hidden="true">
                <span>{item.number}</span>
                {index < pipeline.length - 1 ? <i /> : null}
              </div>
              <article className="pipeline-card glass-panel">
                <div className="pipeline-icon">
                  <Icon size={18} />
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <code>{item.code}</code>
                </div>
                <p>{item.copy}</p>
                <ChevronRight size={15} />
              </article>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Principles({ locale }: { locale: Locale }) {
  const t = siteCopy[locale].principles;

  return (
    <section className="principles-section section-shell" id="principles">
      <div className="section-heading principles-heading">
        <div>
          <span className="section-kicker">
            <Sparkles size={14} /> {t.kicker}
          </span>
          <h2>{t.title}</h2>
        </div>
        <p>{t.lede}</p>
      </div>
      <div className="principle-grid">
        <article className="principle-card principle-large glass-panel">
          <span className="principle-index">{t.cards[0].index}</span>
          <div className="latency-visual" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <i />
          </div>
          <h3>{t.cards[0].title}</h3>
          <p>{t.cards[0].copy}</p>
        </article>
        <article className="principle-card glass-panel">
          <span className="principle-index">{t.cards[1].index}</span>
          <div className="selector-visual" aria-hidden="true">
            <span />
            <span className="is-hot" />
            <span />
            <span />
            <span className="is-warm" />
            <span />
          </div>
          <h3>{t.cards[1].title}</h3>
          <p>{t.cards[1].copy}</p>
        </article>
        <article className="principle-card glass-panel">
          <span className="principle-index">{t.cards[2].index}</span>
          <div className="access-visual" aria-hidden="true">
            <kbd>Tab</kbd>
            <span />
            <kbd>Enter</kbd>
          </div>
          <h3>{t.cards[2].title}</h3>
          <p>{t.cards[2].copy}</p>
        </article>
      </div>
    </section>
  );
}

function Footer({ locale }: { locale: Locale }) {
  const t = siteCopy[locale].footer;

  return (
    <footer className="site-footer section-shell" id="open-source">
      <div className="footer-cta">
        <div className="footer-glow" />
        <div>
          <BrandMark />
          <span className="section-kicker">{t.kicker}</span>
          <h2>{t.title}</h2>
          <p>{t.lede}</p>
        </div>
        <div className="footer-actions">
          <a className="primary-button" href="#runtime">
            <Braces size={16} /> {t.architecture}
          </a>
          <a href="#top">
            {t.top} <ArrowRight size={14} />
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <a className="brand" href="#top">
          <BrandMark /> <span>Velora</span>
        </a>
        <p>{t.tagline}</p>
        <span>{t.copyright}</span>
      </div>
    </footer>
  );
}

export function ShowcaseClient() {
  const [locale, setLocale] = useState<Locale>("en");
  const [localeReady, setLocaleReady] = useState(false);
  const [activeComponentKey, setActiveComponentKey] = useState<SampleKey>("prompt-composer");
  const copy = siteCopy[locale];

  useEffect(() => {
    setLocale(getInitialLocale());
    setLocaleReady(true);
  }, []);

  useEffect(() => {
    if (!localeReady) return;
    window.localStorage.setItem("velora-locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale, localeReady]);

  return (
    <VeloraProvider
      className="showcase-provider"
      theme="dark"
      tokens={{
        accent: "#7f96ff",
        accentContrast: "#070a10",
        background: "transparent",
        surface: "rgba(15, 20, 30, 0.78)",
        surfaceElevated: "rgba(22, 28, 41, 0.88)",
        text: "#f3f6ff",
        textMuted: "#8e99ae",
        border: "rgba(207, 219, 255, 0.12)",
        danger: "#ff8294",
        success: "#74e4b3",
        warning: "#f5ca7a",
        radius: "16px",
        radiusSmall: "10px",
        shadow: "0 24px 70px rgba(0, 0, 0, 0.34)",
        blur: "24px",
        fontSans: "var(--font-sans)",
        fontMono: "var(--font-mono)",
      }}
    >
      <main>
        <div className="page-noise" aria-hidden="true" />
        <Navbar locale={locale} onLocaleChange={setLocale} />
        <Hero locale={locale} />
        <div
          className="trust-strip"
          aria-label={locale === "zh" ? "技术支持" : "Technology support"}
        >
          {copy.trust.map((item, index) => (
            <Fragment key={item}>
              {index > 0 ? <i /> : null}
              <span>{item}</span>
            </Fragment>
          ))}
        </div>
        <ComponentWorkbench
          locale={locale}
          activeKey={activeComponentKey}
          onActiveKeyChange={setActiveComponentKey}
        />
        <ComponentApiSection locale={locale} onSelectComponent={setActiveComponentKey} />
        <RuntimeSection locale={locale} />
        <Principles locale={locale} />
        <Footer locale={locale} />
      </main>
    </VeloraProvider>
  );
}
