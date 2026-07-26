import type { AgentMessage } from "@velora-ai/react/runtime";
import type { Locale } from "./model";

const conversationCopy: Record<
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

export const demoConversations = [
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

export function localizeConversations<T extends (typeof demoConversations)[number]>(
  conversations: readonly T[],
  locale: Locale,
): T[] {
  return conversations.map((conversation) => {
    const localized = conversationCopy[locale][conversation.id];
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

const seededMessages: readonly AgentMessage[] = [
  {
    id: "user-demo",
    conversationId: "launch",
    role: "user",
    content: "Design a calmer onboarding flow for our AI workspace.",
    status: "complete",
    createdAt: 1_752_790_720_000,
    updatedAt: 1_752_790_720_000,
  },
  {
    id: "assistant-demo",
    conversationId: "launch",
    role: "assistant",
    content:
      "The interface is ready. Every token, tool call, and reasoning state can render progressively without blocking the main thread.",
    status: "complete",
    createdAt: 1_752_790_760_000,
    updatedAt: 1_752_790_800_000,
  },
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

const localizedMessageContent: Record<Locale, Record<string, string>> = {
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

export function localizeDemoMessages(
  messages: readonly AgentMessage[],
  locale: Locale,
): readonly AgentMessage[] {
  if (locale === "en") return messages;
  const content = localizedMessageContent[locale];
  return messages.map((message) => {
    const localized = content[message.id];
    return localized ? { ...message, content: localized } : message;
  });
}

export function getDemoMessages(locale: Locale): readonly AgentMessage[] {
  return localizeDemoMessages(seededMessages, locale);
}

export function getDemoSteps(locale: Locale) {
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
