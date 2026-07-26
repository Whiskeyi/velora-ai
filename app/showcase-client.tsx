"use client";

import {
  AgentShell,
  AgentSteps,
  ConversationList,
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
  createMockTransport,
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
  Github,
  Globe2,
  Layers3,
  Menu,
  Monitor,
  PanelLeft,
  Play,
  Radio,
  RotateCcw,
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
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { COMPONENT_KEYS, isSampleKey, type SampleKey } from "./component-registry";
import {
  COMPONENT_API_GROUPS,
  COMPONENT_API_SPECS,
  COMPONENT_DOCS,
} from "./showcase/component-docs";
import {
  CodeBlock,
  Formula,
  LiveEditor,
  LiveError,
  LivePreview,
  LiveProvider,
  MarkdownRenderer,
  MermaidDiagram,
} from "./showcase/lazy-components";
import type { ComponentDoc, Locale, ViewportKey } from "./showcase/model";
import { getComponentHref, getHomeHref } from "./showcase/routing";
import { loadShowcaseSample, SHOWCASE_SAMPLE_BY_KEY, SHOWCASE_SAMPLES } from "./showcase/samples";
import { useShowcaseLocale } from "./showcase/use-showcase-locale";

export { COMPONENT_KEYS, isSampleKey };
export type { SampleKey };

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
      lede: "A precise React system for building AI products that feel immediate, legible, and distinctly human, from the first token to the final tool call.",
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
      modelLabel: "Model",
      toolLabel: "Tool",
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
      reasoning:
        "Inspecting the interaction goal. Balancing disclosure, continuity, and motion. Preparing the smallest complete interface plan.",
      responseLead: "I mapped the request into a focused agent surface.",
      responseTitle: "Recommended direction",
      responsePoints: [
        "Keep one calm primary action.",
        "Reveal tool progress only when it builds trust.",
        "Preserve reading position while tokens arrive.",
      ],
      responseNote:
        "This demo uses Velora’s deterministic mock transport. Swap it for the SSE adapter without changing the component tree.",
      stepIntent: "Understand intent",
      stepIntentDescription: "Mapped the request to interaction primitives",
      stepCompose: "Compose response",
      stepComposeDescription: "Streamed the response through the typed runtime",
    },
    trust: [
      "React 19",
      "TypeScript first",
      "SSE + streams",
      "VoidZero toolchain",
      "Composable by design",
    ],
    workbench: {
      kicker: "Component workbench",
      title: "Shape the interface. See it breathe.",
      lede: "Edit typed, composable primitives in place. Each component now includes a usage contract, key props, and interaction notes so this reads like a library guide, not only a gallery.",
      catalog: "Primitives",
      catalogNote: "Headless where it matters. Beautiful before you touch a token.",
      preview: "Preview",
      appFile: "App.tsx",
      copy: "Copy",
      copied: "Copied",
      reset: "Reset",
      resetCode: "Reset example code",
      stable: "Usage guide",
      loadingEditor: "Loading interactive editor",
      loadsInView: "Interactive editor loads as this section enters view.",
      liveCompilation: "Live compilation",
      keyboardAware: "Keyboard-aware",
      viewportLabel: "Preview viewport",
      environmentLabel: "Preview environment",
      themeLabel: "Theme",
      densityLabel: "Density",
      directionLabel: "Direction",
      motionLabel: "Motion",
      dark: "Dark",
      light: "Light",
      comfortable: "Comfortable",
      compact: "Compact",
      motionOn: "Motion on",
      motionReduced: "Reduced motion",
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
      lede: "Browse components by category, inspect their typed props, and jump back into the live editor when you want to change the implementation.",
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
      lede: "Bring any backend. Velora turns server events into a small, typed state graph and coalesces high-frequency deltas before React commits them.",
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
        code: "createAgentRuntime()",
        copy: "Owns idempotent runs, approvals, cancellation, retries, and telemetry outside React.",
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
      lede: "The system handles the hard edges of AI interaction while leaving your product's voice intact.",
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
      lede: "一套面向真实 AI 产品的 React 组件系统：从第一个 token 到最后一次工具调用，都保持即时、清晰、可控。",
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
      modelLabel: "模型",
      toolLabel: "工具",
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
      reasoning: "正在分析交互目标，平衡信息披露、操作连续性与动效，并整理最小完整界面方案。",
      responseLead: "我已将这次请求整理为一套聚焦的智能体界面方案。",
      responseTitle: "建议方向",
      responsePoints: [
        "保留一个安静、明确的主操作。",
        "只在有助于建立信任时展示工具进度。",
        "流式内容到达时保持用户当前阅读位置。",
      ],
      responseNote: "此演示使用 Velora 的确定性模拟传输；替换为 SSE 适配器时无需改动组件树。",
      stepIntent: "理解意图",
      stepIntentDescription: "将请求映射为可组合的交互原语",
      stepCompose: "组织回复",
      stepComposeDescription: "通过类型化运行时完成流式输出",
    },
    trust: ["React 19", "TypeScript 优先", "SSE + 流式", "VoidZero 工具链", "组合式设计"],
    workbench: {
      kicker: "组件工作台",
      title: "调组件，看它真实运转。",
      lede: "每个组件都可编辑、可预览，并补上适用场景、关键 props 和交互约定。这里不再只是展厅，而是组件库使用入口。",
      catalog: "组件",
      catalogNote: "需要时可无头组合，默认也具备精致交互。",
      preview: "预览",
      appFile: "App.tsx",
      copy: "复制",
      copied: "已复制",
      reset: "重置",
      resetCode: "重置示例代码",
      stable: "用法指南",
      loadingEditor: "正在加载交互编辑器",
      loadsInView: "进入该区域后加载交互编辑器。",
      liveCompilation: "实时编译",
      keyboardAware: "键盘友好",
      viewportLabel: "预览视口",
      environmentLabel: "预览环境",
      themeLabel: "主题",
      densityLabel: "密度",
      directionLabel: "方向",
      motionLabel: "动效",
      dark: "深色",
      light: "浅色",
      comfortable: "舒适",
      compact: "紧凑",
      motionOn: "开启动效",
      motionReduced: "减少动效",
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
      lede: "按分类浏览组件，查看类型化 Props，并在需要验证交互时跳回实时编辑器修改代码。",
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
      lede: "后端可以自由替换。Velora 将服务端事件归一到小型类型化状态图，并在 React 提交前合并高频 token 更新。",
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
        code: "createAgentRuntime()",
        copy: "在 React 之外负责幂等运行、审批、取消、重试与遥测。",
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

function getPropDescription(doc: ComponentDoc, propName: string, locale: Locale): string {
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
  if (!match) {
    return locale === "zh"
      ? `配置 ${propName}。类型、默认值与是否必填以本行定义为准。`
      : `Configures ${propName}. The type, default, and required state are defined in this row.`;
  }
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

const demoMessageContent: Record<Locale, Record<string, string>> = {
  en: {},
  zh: {
    "user-demo": "为我们的 AI 工作区设计一套更平静的引导流程。",
    "assistant-demo": "界面已经就绪。每个 token、工具调用和思考状态都能渐进渲染，不阻塞主线程。",
    "research-user": "综合已连接资料中最有价值的设计模式。",
    "research-assistant": "最清晰的模式是渐进式披露：按需呈现深度，同时保留当前任务上下文。",
    "architecture-user": "梳理从传输层事件到消息渲染的完整链路。",
    "architecture-assistant":
      "SSE 事件进入传输层后会被归一化到外部状态仓库，并且只更新订阅了变化数据的消息行。",
  },
};

function localizeDemoMessages(
  messages: readonly AgentMessage[],
  locale: Locale,
): readonly AgentMessage[] {
  const content = demoMessageContent[locale];
  if (locale === "en") return messages;
  return messages.map((message) => {
    const localized = content[message.id];
    return localized ? { ...message, content: localized } : message;
  });
}

function getDemoSteps(locale: Locale) {
  if (locale === "zh") {
    return [
      { id: "intent", title: "理解意图", status: "complete" as const },
      { id: "patterns", title: "比较方案", status: "complete" as const },
      { id: "compose", title: "组织回复", status: "running" as const },
    ];
  }
  return [
    { id: "intent", title: "Understand intent", status: "complete" as const },
    { id: "patterns", title: "Compare patterns", status: "complete" as const },
    { id: "compose", title: "Compose response", status: "running" as const },
  ];
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function createDemoTransport(locale: Locale) {
  const isStaticDemo =
    typeof document !== "undefined" &&
    document.documentElement.dataset.veloraDemoTransport === "mock";

  if (!isStaticDemo) {
    return createSSETransport({ url: "/api/demo/stream" });
  }

  const copy = siteCopy[locale].agent;
  return createMockTransport({
    initialDelayMs: 120,
    chunkSize: [2, 4, 3, 5],
    reasoningChunkSize: [10, 14, 8],
    delayMs: ({ event }) => {
      if (event.type === "text-delta") return 20;
      if (event.type === "reasoning-delta" || event.type === "reasoning-summary-delta") {
        return 72;
      }
      if (event.type === "step") return 90;
      return 36;
    },
    response: ({ lastUserMessage }) => {
      const subject = lastUserMessage?.content.trim().slice(0, 120) || "this interface request";
      const completedAt = Date.now();

      return {
        content: [
          locale === "zh"
            ? `${copy.responseLead}\n\n> ${subject}`
            : `${copy.responseLead}\n\n> ${subject}`,
          `\n\n**${copy.responseTitle}**\n\n`,
          `1. ${copy.responsePoints[0]}\n`,
          `2. ${copy.responsePoints[1]}\n`,
          `3. ${copy.responsePoints[2]}\n\n`,
          "```tsx\n<AgentShell composer={<PromptComposer onSubmit={send} />} />\n```\n\n",
          copy.responseNote,
        ].join(""),
        reasoning: copy.reasoning,
        steps: [
          {
            id: "intent",
            title: copy.stepIntent,
            status: "complete",
            description: copy.stepIntentDescription,
            startedAt: completedAt - 420,
            completedAt: completedAt - 180,
          },
          {
            id: "compose",
            title: copy.stepCompose,
            status: "complete",
            description: copy.stepComposeDescription,
            startedAt: completedAt - 170,
            completedAt,
          },
        ],
        metadata: { adapter: "velora-demo-mock" },
      };
    },
  });
}

function useDemoAgent(conversationId: string, locale: Locale) {
  const transport = useMemo(() => createDemoTransport(locale), [locale]);
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
  const [tool, setTool] = useState("none");
  const [toolStatus, setToolStatus] = useState<ToolCallStatus>("draft");
  const [toolExpanded, setToolExpanded] = useState(false);
  const [toolResult, setToolResult] = useState<Record<string, unknown> | undefined>();
  const [composerNotice, setComposerNotice] = useState(t.initialNotice);
  const [feedbackByMessage, setFeedbackByMessage] = useState<
    Record<string, "like" | "dislike" | null>
  >({});
  const drafts = usePromptDrafts();
  const draftCounter = useRef(0);
  const chat = useDemoAgent(activeConversation, locale);
  const renderedConversations = useMemo(
    () => localizeConversations(conversations, locale),
    [conversations, locale],
  );
  const visibleMessages = useMemo(
    () => localizeDemoMessages(chat.messages, locale),
    [chat.messages, locale],
  );
  const latestAssistant = [...visibleMessages]
    .reverse()
    .find((message) => message.role === "assistant");
  const visibleSteps = latestAssistant?.steps?.length
    ? latestAssistant.steps
    : visibleMessages.length
      ? getDemoSteps(locale)
      : [];
  const visibleReasoning =
    latestAssistant?.reasoning ||
    (visibleMessages.length
      ? t.reasoning
      : locale === "zh"
        ? "首次回复开始后会在这里展示思考过程。"
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
        metadata: {
          preview: t.startDirection,
          age: locale === "zh" ? "刚刚" : "Now",
          status: "idle",
        },
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
        />
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
                    aria-label={t.modelLabel}
                    value={model}
                    onChange={(event) => setModel(event.currentTarget.value)}
                  >
                    <option value="velora-pro">Velora Pro</option>
                    <option value="velora-fast">Velora Fast</option>
                    <option value="local">{t.local}</option>
                  </select>
                  <select
                    aria-label={t.toolLabel}
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
  homeHref = "",
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  homeHref?: string;
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
      <nav
        className="nav-shell glass-panel"
        aria-label={locale === "zh" ? "主导航" : "Primary navigation"}
      >
        <a
          className="brand"
          href={`${homeHref}#top`}
          aria-label={locale === "zh" ? "Velora 首页" : "Velora home"}
        >
          <BrandMark />
          <span>Velora</span>
          <sup>alpha</sup>
        </a>

        <div id="primary-links" className={`nav-links ${open ? "is-open" : ""}`}>
          <a href={`${homeHref}#components`} onClick={() => setOpen(false)}>
            {t.components}
          </a>
          <a href={`${homeHref}#api`} onClick={() => setOpen(false)}>
            {t.api}
          </a>
          <a href={`${homeHref}#runtime`} onClick={() => setOpen(false)}>
            {t.runtime}
          </a>
          <a href={`${homeHref}#principles`} onClick={() => setOpen(false)}>
            {t.principles}
          </a>
          <a href={`${homeHref}#open-source`} onClick={() => setOpen(false)}>
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
          <a
            className="nav-github"
            href="https://github.com/Whiskeyi/velora-ai"
            target="_blank"
            rel="noreferrer"
          >
            <Github size={15} />
            <span>GitHub</span>
          </a>
          <a className="nav-cta" href={`${homeHref}#components`}>
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
      await navigator.clipboard.writeText("git clone https://github.com/Whiskeyi/velora-ai.git");
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
        <p className="hero-lede">{t.lede}</p>

        <div className="hero-actions">
          <a className="primary-button" href="#components">
            {t.explore}
            <ArrowRight size={16} />
          </a>
          <button className="install-command" type="button" onClick={copyInstall}>
            <TerminalSquare size={15} />
            <code>git clone Whiskeyi/velora-ai</code>
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

function AccessibleLiveEditor({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (code: string) => void;
}) {
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
      editor.setAttribute(
        "aria-label",
        locale === "zh" ? "可编辑的 TypeScript 组件示例" : "Editable TypeScript component example",
      );
    };
    configureEditor();
    const observer = new MutationObserver(configureEditor);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [locale]);

  return (
    <div
      ref={editorRootRef}
      className="editor-wrap"
      role="group"
      aria-label={
        locale === "zh"
          ? "代码编辑器；按 Tab 可将焦点移出编辑器"
          : "Code editor; Tab moves focus out of the editor"
      }
    >
      <LiveEditor className="live-editor" tabMode="focus" onChange={onChange} />
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
  compact = false,
}: {
  locale: Locale;
  activeKey: SampleKey;
  onActiveKeyChange: (key: SampleKey) => void;
  compact?: boolean;
}) {
  const t = siteCopy[locale].workbench;
  const [copied, setCopied] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [viewport, setViewport] = useState<ViewportKey>("desktop");
  const [mobilePane, setMobilePane] = useState<"preview" | "code">("preview");
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");
  const [previewDensity, setPreviewDensity] = useState<"compact" | "comfortable">("comfortable");
  const [previewDirection, setPreviewDirection] = useState<"ltr" | "rtl">("ltr");
  const [previewReducedMotion, setPreviewReducedMotion] = useState(false);
  const [sampleCode, setSampleCode] = useState<Partial<Record<SampleKey, string>>>({});
  const [sampleSource, setSampleSource] = useState<Partial<Record<SampleKey, string>>>({});
  const sectionRef = useRef<HTMLElement | null>(null);
  const catalogRef = useRef<HTMLDivElement | null>(null);
  const viewportWasChosen = useRef(false);
  const activeSample = SHOWCASE_SAMPLE_BY_KEY[activeKey];
  const activeDoc = COMPONENT_DOCS[activeSample.key][locale];
  const activeCode = sampleCode[activeSample.key] ?? "";
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
    if (!editorReady || sampleSource[activeKey] !== undefined) return;
    let active = true;
    void loadShowcaseSample(activeKey).then((sample) => {
      if (!active) return;
      setSampleSource((current) => ({ ...current, [activeKey]: sample.code }));
      setSampleCode((current) => ({ ...current, [activeKey]: sample.code }));
    });
    return () => {
      active = false;
    };
  }, [activeKey, editorReady, sampleSource]);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 720px)");
    const syncViewport = () => {
      if (!viewportWasChosen.current) {
        setViewport(mobileQuery.matches ? "mobile" : "desktop");
      }
    };
    syncViewport();
    mobileQuery.addEventListener("change", syncViewport);
    return () => mobileQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 980px)").matches) return;
    const catalog = catalogRef.current;
    const activeButton = catalog?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (!catalog || !activeButton || catalog.scrollWidth <= catalog.clientWidth) return;
    const target = activeButton.offsetLeft - (catalog.clientWidth - activeButton.offsetWidth) / 2;
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
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [activeCode]);

  const resetCode = useCallback(() => {
    const source = sampleSource[activeSample.key];
    if (source === undefined) return;
    setSampleCode((current) => ({
      ...current,
      [activeSample.key]: source,
    }));
  }, [activeSample, sampleSource]);

  return (
    <section
      ref={sectionRef}
      className={`workbench-section section-shell${compact ? " is-compact" : ""}`}
    >
      {!compact ? (
        <div className="section-heading">
          <div>
            <span className="section-kicker">
              <Braces size={14} /> {t.kicker}
            </span>
            <h2>{t.title}</h2>
          </div>
          <p>{t.lede}</p>
        </div>
      ) : null}

      <div id="components" className={`workbench glass-panel${compact ? " is-compact" : ""}`}>
        {!compact ? (
          <aside className="component-catalog" aria-label={t.catalog}>
            <div className="catalog-heading">
              <span>{t.catalog}</span>
              <span>{SHOWCASE_SAMPLES.length}</span>
            </div>
            <div ref={catalogRef} className="catalog-list">
              {SHOWCASE_SAMPLES.map((sample) => {
                const doc = COMPONENT_DOCS[sample.key][locale];
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
        ) : null}

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

          {editorReady && activeCode ? (
            <Suspense
              fallback={
                <div className="workbench-loading" role="status">
                  <StreamingIndicator label={t.loadingEditor} visibleLabel />
                </div>
              }
            >
              <LiveProvider
                key={activeSample.key}
                code={activeCode}
                scope={scope}
                language="tsx"
                enableTypeScript
                noInline
              >
                <div className="mobile-workbench-tabs" role="tablist" aria-label={t.viewportLabel}>
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
                  <div id="mobile-preview-pane" className="preview-pane" role="tabpanel">
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
                            onClick={() => {
                              viewportWasChosen.current = true;
                              setViewport(key);
                            }}
                          >
                            <Icon size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="preview-environment-controls" aria-label={t.environmentLabel}>
                      <label>
                        <span>{t.themeLabel}</span>
                        <select
                          value={previewTheme}
                          onChange={(event) =>
                            setPreviewTheme(event.currentTarget.value as "dark" | "light")
                          }
                        >
                          <option value="dark">{t.dark}</option>
                          <option value="light">{t.light}</option>
                        </select>
                      </label>
                      <label>
                        <span>{t.densityLabel}</span>
                        <select
                          value={previewDensity}
                          onChange={(event) =>
                            setPreviewDensity(
                              event.currentTarget.value as "compact" | "comfortable",
                            )
                          }
                        >
                          <option value="comfortable">{t.comfortable}</option>
                          <option value="compact">{t.compact}</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        aria-label={t.directionLabel}
                        aria-pressed={previewDirection === "rtl"}
                        onClick={() =>
                          setPreviewDirection((current) => (current === "ltr" ? "rtl" : "ltr"))
                        }
                      >
                        {previewDirection.toUpperCase()}
                      </button>
                      <button
                        type="button"
                        aria-label={t.motionLabel}
                        aria-pressed={previewReducedMotion}
                        onClick={() => setPreviewReducedMotion((current) => !current)}
                      >
                        {previewReducedMotion ? t.motionReduced : t.motionOn}
                      </button>
                    </div>
                    <div className="live-preview-shell" data-viewport={viewport}>
                      <div className="preview-light preview-light-one" />
                      <div className="preview-light preview-light-two" />
                      <VeloraProvider
                        className="preview-environment"
                        theme={previewTheme}
                        density={previewDensity}
                        direction={previewDirection}
                        locale={locale}
                        reducedMotion={previewReducedMotion}
                      >
                        <LivePreview className="live-preview" />
                      </VeloraProvider>
                    </div>
                  </div>

                  <div id="mobile-code-pane" className="code-pane" role="tabpanel">
                    <div className="pane-bar code-pane-bar">
                      <span>
                        <Code2 size={12} /> {t.appFile}
                      </span>
                      <div className="code-pane-actions">
                        <button
                          type="button"
                          onClick={resetCode}
                          aria-label={t.resetCode}
                          disabled={activeCode === sampleSource[activeSample.key]}
                        >
                          <RotateCcw size={13} />
                          {t.reset}
                        </button>
                        <button
                          type="button"
                          onClick={copyCode}
                          aria-label={`${t.copy} ${activeSample.name}`}
                        >
                          {copied ? <Check size={13} /> : <Copy size={13} />}
                          {copied ? t.copied : t.copy}
                        </button>
                      </div>
                    </div>
                    <AccessibleLiveEditor
                      locale={locale}
                      onChange={(code) =>
                        setSampleCode((current) => ({
                          ...current,
                          [activeSample.key]: code,
                        }))
                      }
                    />
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
  confirmApproval={confirmToolApproval}
  onApprove={approveTool}
/>`;
  }
}

function ComponentApiCard({
  componentKey,
  locale,
  showDemoLink = false,
}: {
  componentKey: SampleKey;
  locale: Locale;
  showDemoLink?: boolean;
}) {
  const t = siteCopy[locale].api;
  const sample = SHOWCASE_SAMPLE_BY_KEY[componentKey];
  const doc = COMPONENT_DOCS[componentKey][locale];
  const spec = COMPONENT_API_SPECS[componentKey];
  const richContentSubpath: Partial<Record<SampleKey, string>> = {
    "code-block": "code-block",
    formula: "formula",
    "markdown-renderer": "markdown",
    "mermaid-diagram": "mermaid",
  };
  const subpath = richContentSubpath[componentKey];
  const importStatement = `import { ${spec.importName} } from "@velora-ai/react${
    subpath ? `/rich-content/${subpath}` : ""
  }";`;

  return (
    <article className="api-card glass-panel" id="api-reference">
      <div className="api-card-head">
        <div>
          <span className="component-badge">{doc.eyebrow}</span>
          <h3>{sample.name}</h3>
          <p>{doc.description}</p>
        </div>
        {showDemoLink ? (
          <a className="api-demo-link" href="#components">
            {t.editDemo}
            <ChevronRight size={14} />
          </a>
        ) : null}
      </div>

      <div className="api-overview-grid" id="overview">
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

      <div className="api-usage-grid" id="usage">
        <section>
          <h4>{t.importLabel}</h4>
          <pre>
            <code>{importStatement}</code>
          </pre>
        </section>
        <section>
          <h4>{t.quickUse}</h4>
          <pre>
            <code>{getUsageSnippet(componentKey)}</code>
          </pre>
        </section>
      </div>

      <div
        className="api-table-wrap"
        id="props"
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
                <td>{prop.description?.[locale] ?? getPropDescription(doc, prop.name, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="api-contract-grid" id="behavior">
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
}

function ComponentApiSection({ locale }: { locale: Locale }) {
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

      <div className="api-layout api-index-layout">
        <aside className="api-nav glass-panel" aria-label={t.navLabel}>
          {COMPONENT_API_GROUPS.map((group) => (
            <div className="api-nav-group" key={group.id}>
              <span>{group.title[locale]}</span>
              <p>{group.description[locale]}</p>
              <div>
                {group.keys.map((key) => {
                  const sample = SHOWCASE_SAMPLE_BY_KEY[key];
                  return (
                    <a href={getComponentHref(key)} key={key}>
                      {sample.name}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        <div className="api-index-grid">
          {COMPONENT_API_GROUPS.flatMap((group) =>
            group.keys.map((key) => {
              const sample = SHOWCASE_SAMPLE_BY_KEY[key];
              const doc = COMPONENT_DOCS[key][locale];

              return (
                <a className="api-index-card glass-panel" href={getComponentHref(key)} key={key}>
                  <span className="component-badge">{doc.eyebrow}</span>
                  <h3>{sample.name}</h3>
                  <p>{doc.description}</p>
                  <span className="api-index-card__action">
                    {locale === "zh" ? "查看文档与示例" : "View docs & example"}
                    <ChevronRight size={14} />
                  </span>
                </a>
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

function Footer({ locale, homeHref = "" }: { locale: Locale; homeHref?: string }) {
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
          <a className="primary-button" href={`${homeHref}#runtime`}>
            <Braces size={16} /> {t.architecture}
          </a>
          <a href={`${homeHref}#top`}>
            {t.top} <ArrowRight size={14} />
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <a className="brand" href={`${homeHref}#top`}>
          <BrandMark /> <span>Velora</span>
        </a>
        <p>{t.tagline}</p>
        <span>{t.copyright}</span>
      </div>
    </footer>
  );
}

function ShowcaseTheme({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <VeloraProvider
      className="showcase-provider"
      theme="dark"
      locale={locale === "zh" ? "zh-CN" : "en-US"}
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
      {children}
    </VeloraProvider>
  );
}

export function ComponentDetailClient({ componentKey }: { componentKey: SampleKey }) {
  const { locale, setLocale } = useShowcaseLocale();
  const detailSidebarRef = useRef<HTMLElement | null>(null);
  const [componentQuery, setComponentQuery] = useState("");
  const sample = SHOWCASE_SAMPLE_BY_KEY[componentKey];
  const doc = COMPONENT_DOCS[componentKey][locale];
  const currentIndex = COMPONENT_KEYS.indexOf(componentKey);
  const previousKey =
    COMPONENT_KEYS[(currentIndex - 1 + COMPONENT_KEYS.length) % COMPONENT_KEYS.length];
  const nextKey = COMPONENT_KEYS[(currentIndex + 1) % COMPONENT_KEYS.length];
  const homeHref = getHomeHref();
  const filteredApiGroups = useMemo(() => {
    const query = componentQuery.trim().toLocaleLowerCase(locale);
    if (!query) return COMPONENT_API_GROUPS;
    return COMPONENT_API_GROUPS.map((group) => ({
      ...group,
      keys: group.keys.filter((key) => {
        const item = SHOWCASE_SAMPLE_BY_KEY[key];
        const itemDoc = COMPONENT_DOCS[key][locale];
        return `${item.name} ${itemDoc.eyebrow} ${itemDoc.description}`
          .toLocaleLowerCase(locale)
          .includes(query);
      }),
    })).filter((group) => group.keys.length > 0);
  }, [componentQuery, locale]);

  useEffect(() => {
    const sidebar = detailSidebarRef.current;
    const activeLink = sidebar?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!sidebar || !activeLink || sidebar.scrollWidth <= sidebar.clientWidth) return;
    const sidebarRect = sidebar.getBoundingClientRect();
    const activeRect = activeLink.getBoundingClientRect();
    sidebar.scrollTo({
      left:
        sidebar.scrollLeft +
        activeRect.left -
        sidebarRect.left -
        (sidebarRect.width - activeRect.width) / 2,
      behavior: "instant",
    });
  }, [componentKey, locale]);

  return (
    <ShowcaseTheme locale={locale}>
      <main className="component-detail-page" id="top">
        <div className="page-noise" aria-hidden="true" />
        <Navbar locale={locale} onLocaleChange={setLocale} homeHref={homeHref} />

        <header className="component-detail-hero section-shell">
          <nav aria-label={locale === "zh" ? "面包屑" : "Breadcrumb"}>
            <a href={homeHref}>{locale === "zh" ? "组件" : "Components"}</a>
            <ChevronRight size={13} />
            <span>{sample.name}</span>
          </nav>
          <span className="component-badge">{doc.eyebrow}</span>
          <h1>{sample.name}</h1>
          <p>{doc.description}</p>
        </header>

        <div className="component-detail-layout section-shell">
          <aside
            ref={detailSidebarRef}
            className="component-detail-sidebar glass-panel"
            aria-label={siteCopy[locale].api.navLabel}
          >
            <label className="component-detail-search">
              <span className="vl-sr-only">
                {locale === "zh" ? "搜索组件" : "Search components"}
              </span>
              <input
                type="search"
                value={componentQuery}
                placeholder={locale === "zh" ? "搜索组件…" : "Search components…"}
                onChange={(event) => setComponentQuery(event.currentTarget.value)}
              />
            </label>
            {filteredApiGroups.map((group) => (
              <div key={group.id}>
                <strong>{group.title[locale]}</strong>
                {group.keys.map((key) => {
                  const item = SHOWCASE_SAMPLE_BY_KEY[key];
                  return (
                    <a
                      className={key === componentKey ? "is-active" : ""}
                      href={getComponentHref(key)}
                      key={key}
                      aria-current={key === componentKey ? "page" : undefined}
                    >
                      {item.name}
                    </a>
                  );
                })}
              </div>
            ))}
          </aside>

          <div className="component-detail-main">
            <section id="demo" aria-label={locale === "zh" ? "实时示例" : "Live example"}>
              <ComponentWorkbench
                locale={locale}
                activeKey={componentKey}
                onActiveKeyChange={() => undefined}
                compact
              />
            </section>
            <ComponentApiCard componentKey={componentKey} locale={locale} />
            <nav
              className="component-detail-pagination"
              aria-label={locale === "zh" ? "组件翻页" : "Component pagination"}
            >
              <a href={getComponentHref(previousKey)}>
                <span>{locale === "zh" ? "上一个" : "Previous"}</span>
                <strong>{SHOWCASE_SAMPLE_BY_KEY[previousKey].name}</strong>
              </a>
              <a href={getComponentHref(nextKey)}>
                <span>{locale === "zh" ? "下一个" : "Next"}</span>
                <strong>{SHOWCASE_SAMPLE_BY_KEY[nextKey].name}</strong>
              </a>
            </nav>
          </div>

          <aside
            className="component-detail-toc"
            aria-label={locale === "zh" ? "本页目录" : "On this page"}
          >
            <span>{locale === "zh" ? "本页目录" : "On this page"}</span>
            <a href="#demo">{locale === "zh" ? "实时示例" : "Live example"}</a>
            <a href="#overview">{siteCopy[locale].api.overview}</a>
            <a href="#usage">{siteCopy[locale].api.quickUse}</a>
            <a href="#props">Props</a>
            <a href="#behavior">{siteCopy[locale].api.interaction}</a>
          </aside>
        </div>
        <Footer locale={locale} homeHref={homeHref} />
      </main>
    </ShowcaseTheme>
  );
}

export function ShowcaseClient() {
  const { locale, setLocale } = useShowcaseLocale();
  const [activeComponentKey, setActiveComponentKey] = useState<SampleKey>("prompt-composer");
  const copy = siteCopy[locale];

  return (
    <ShowcaseTheme locale={locale}>
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
        <ComponentApiSection locale={locale} />
        <RuntimeSection locale={locale} />
        <Principles locale={locale} />
        <Footer locale={locale} />
      </main>
    </ShowcaseTheme>
  );
}
