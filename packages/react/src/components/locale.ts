export type VeloraLocale = "en-US" | "zh-CN";

export interface VeloraMessages {
  agentShell: {
    sidebarLabel: string;
    inspectorLabel: string;
    openSidebarLabel: string;
    closeSidebarLabel: string;
    openInspectorLabel: string;
    closeInspectorLabel: string;
    closePanelsLabel: string;
  };
  conversationList: {
    idle: string;
    unread: string;
    streaming: string;
    error: string;
    untitled: string;
    searchPlaceholder: string;
    searchLabel: string;
    createLabel: string;
    empty: string;
    noResults: string;
    ariaLabel: string;
  };
  promptComposer: {
    placeholder: string;
    attachmentLabel: string;
    attachmentsLabel: string;
    submitLabel: string;
    stopLabel: string;
    removeAttachment: (fileName: string) => string;
    retryAttachment: (fileName: string) => string;
    uploading: string;
    uploadFailed: string;
    retry: string;
    retrying: string;
    sending: string;
    generating: string;
    stopping: string;
    notAccepted: string;
    fileTypeRejected: (fileName: string) => string;
    fileTooLarge: (fileName: string, limit: string) => string;
    attachmentLimit: (limit: number) => string;
    duplicateAttachment: (fileName: string) => string;
    attachmentCreationFailed: (fileName: string, reason: string) => string;
  };
  messageBubble: {
    system: string;
    user: string;
    assistant: string;
    tool: string;
    queued: string;
    streaming: string;
    complete: string;
    error: string;
    aborted: string;
  };
  messageList: {
    empty: string;
    jumpToLatest: string;
    ariaLabel: string;
    newActivity: (count: number, jumpLabel: string) => string;
    roleSystem: string;
    roleUser: string;
    roleAssistant: string;
    roleTool: string;
    responseComplete: (role: string) => string;
    messageFailed: (role: string) => string;
    responseStopped: (role: string) => string;
    messageAdded: (role: string, count: number) => string;
  };
  messageActions: {
    ariaLabel: string;
    copy: string;
    regenerate: string;
    edit: string;
    like: string;
    dislike: string;
    copied: string;
    pending: Record<"copy" | "regenerate" | "edit" | "like" | "dislike", string>;
    success: Record<"copy" | "regenerate" | "edit" | "like" | "dislike", string>;
    actionFailed: (actionLabel: string, error: string) => string;
  };
  messageBranchNavigator: {
    ariaLabel: string;
    previous: string;
    next: string;
  };
  reasoningPanel: {
    title: string;
    idle: string;
    running: string;
    complete: string;
    error: string;
    thinking: string;
    details: string;
  };
  agentSteps: {
    pending: string;
    waiting: string;
    running: string;
    complete: string;
    error: string;
    cancelled: string;
    retry: string;
    retrying: string;
    empty: string;
  };
  toolCallCard: {
    draft: string;
    approvalRequired: string;
    running: string;
    complete: string;
    error: string;
    cancelled: string;
    lowRisk: string;
    mediumRisk: string;
    highRisk: string;
    criticalRisk: string;
    arguments: string;
    result: string;
    errorLabel: string;
    details: (toolName: string) => string;
    approvalActions: (toolName: string) => string;
    approve: string;
    approving: string;
    reject: string;
    rejecting: string;
    retry: string;
    retrying: string;
  };
  codeBlock: {
    copy: string;
    copied: string;
    wrap: string;
    unwrap: string;
    expand: string;
    collapse: string;
    download: string;
    retryHighlight: string;
    highlightUnavailable: (error: string) => string;
  };
  formula: {
    copy: string;
    copied: string;
  };
  mermaidDiagram: {
    controls: string;
    zoomIn: string;
    zoomOut: string;
    resetZoom: string;
    copySource: string;
    copied: string;
    diagram: string;
    rendering: string;
    empty: string;
    retry: string;
  };
  markdownRenderer: {
    streaming: string;
  };
  streamingIndicator: {
    generating: string;
  };
}

type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> }
    : T;

export type VeloraMessagesOverride = DeepPartial<VeloraMessages>;

export const enUS: VeloraMessages = {
  agentShell: {
    sidebarLabel: "Conversations",
    inspectorLabel: "Inspector",
    openSidebarLabel: "Open conversations",
    closeSidebarLabel: "Close conversations",
    openInspectorLabel: "Open inspector",
    closeInspectorLabel: "Close inspector",
    closePanelsLabel: "Close open panel",
  },
  conversationList: {
    idle: "Idle",
    unread: "Unread activity",
    streaming: "Generating response",
    error: "Needs attention",
    untitled: "Untitled conversation",
    searchPlaceholder: "Search conversations",
    searchLabel: "Search conversations",
    createLabel: "New conversation",
    empty: "No conversations yet",
    noResults: "No matching conversations",
    ariaLabel: "Conversations",
  },
  promptComposer: {
    placeholder: "Ask anything…",
    attachmentLabel: "Attach files",
    attachmentsLabel: "Attachments",
    submitLabel: "Send message",
    stopLabel: "Stop generating",
    removeAttachment: (fileName) => `Remove ${fileName}`,
    retryAttachment: (fileName) => `Retry ${fileName}`,
    uploading: "Uploading",
    uploadFailed: "Upload failed",
    retry: "Retry",
    retrying: "Retrying",
    sending: "Sending",
    generating: "Generating",
    stopping: "Stopping",
    notAccepted: "The message was not accepted. Try again.",
    fileTypeRejected: (fileName) => `${fileName} is not an accepted file type.`,
    fileTooLarge: (fileName, limit) => `${fileName} exceeds the ${limit} limit.`,
    attachmentLimit: (limit) => `Only ${limit} attachments are allowed.`,
    duplicateAttachment: (fileName) => `${fileName} has a duplicate attachment id.`,
    attachmentCreationFailed: (fileName, reason) =>
      `${fileName} could not be attached: ${reason}`,
  },
  messageBubble: {
    system: "System",
    user: "You",
    assistant: "Assistant",
    tool: "Tool",
    queued: "Queued",
    streaming: "Streaming",
    complete: "Complete",
    error: "Failed",
    aborted: "Stopped",
  },
  messageList: {
    empty: "Start a conversation",
    jumpToLatest: "Jump to latest",
    ariaLabel: "Conversation messages",
    newActivity: (count, jumpLabel) =>
      `${jumpLabel} · ${count} new ${count === 1 ? "update" : "updates"}`,
    roleSystem: "System",
    roleUser: "User",
    roleAssistant: "Assistant",
    roleTool: "Tool",
    responseComplete: (role) => `${role} response complete`,
    messageFailed: (role) => `${role} message failed`,
    responseStopped: (role) => `${role} response stopped`,
    messageAdded: (role, count) =>
      count > 1 ? `${count} new messages. Latest from ${role}` : `${role} message added`,
  },
  messageActions: {
    ariaLabel: "Message actions",
    copy: "Copy message",
    regenerate: "Regenerate response",
    edit: "Edit message",
    like: "Helpful",
    dislike: "Not helpful",
    copied: "Message copied",
    pending: {
      copy: "Copying message",
      regenerate: "Requesting a new response",
      edit: "Opening message editor",
      like: "Saving positive feedback",
      dislike: "Saving negative feedback",
    },
    success: {
      copy: "Message copied",
      regenerate: "New response requested",
      edit: "Message editor opened",
      like: "Feedback saved",
      dislike: "Feedback saved",
    },
    actionFailed: (actionLabel, error) => `${actionLabel} failed: ${error}`,
  },
  messageBranchNavigator: {
    ariaLabel: "Response versions",
    previous: "Previous response version",
    next: "Next response version",
  },
  reasoningPanel: {
    title: "Reasoning",
    idle: "Idle",
    running: "Reasoning is in progress",
    complete: "Complete",
    error: "Reasoning failed",
    thinking: "Thinking",
    details: "Reasoning details",
  },
  agentSteps: {
    pending: "Pending",
    waiting: "Waiting",
    running: "In progress",
    complete: "Complete",
    error: "Failed",
    cancelled: "Cancelled",
    retry: "Retry",
    retrying: "Retrying…",
    empty: "No steps",
  },
  toolCallCard: {
    draft: "Draft",
    approvalRequired: "Approval required",
    running: "Running",
    complete: "Complete",
    error: "Failed",
    cancelled: "Cancelled",
    lowRisk: "Low risk",
    mediumRisk: "Medium risk",
    highRisk: "High risk",
    criticalRisk: "Critical risk",
    arguments: "Arguments",
    result: "Result",
    errorLabel: "Error",
    details: (toolName) => `${toolName} details`,
    approvalActions: (toolName) => `${toolName} approval actions`,
    approve: "Approve",
    approving: "Approving…",
    reject: "Reject",
    rejecting: "Rejecting…",
    retry: "Retry",
    retrying: "Retrying…",
  },
  codeBlock: {
    copy: "Copy code",
    copied: "Copied",
    wrap: "Wrap lines",
    unwrap: "Disable line wrap",
    expand: "Show all code",
    collapse: "Collapse code",
    download: "Download code",
    retryHighlight: "Retry highlighting",
    highlightUnavailable: (error) => `Syntax highlighting unavailable: ${error}`,
  },
  formula: {
    copy: "Copy formula",
    copied: "Copied",
  },
  mermaidDiagram: {
    controls: "Diagram controls",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    resetZoom: "Reset zoom",
    copySource: "Copy diagram source",
    copied: "Copied",
    diagram: "Mermaid diagram",
    rendering: "Rendering diagram",
    empty: "Mermaid definition is empty.",
    retry: "Retry",
  },
  markdownRenderer: {
    streaming: "Response is streaming",
  },
  streamingIndicator: {
    generating: "Generating response",
  },
};

export const zhCN: VeloraMessages = {
  agentShell: {
    sidebarLabel: "会话",
    inspectorLabel: "检查器",
    openSidebarLabel: "打开会话列表",
    closeSidebarLabel: "关闭会话列表",
    openInspectorLabel: "打开检查器",
    closeInspectorLabel: "关闭检查器",
    closePanelsLabel: "关闭当前面板",
  },
  conversationList: {
    idle: "空闲",
    unread: "有未读动态",
    streaming: "正在生成回复",
    error: "需要处理",
    untitled: "未命名会话",
    searchPlaceholder: "搜索会话",
    searchLabel: "搜索会话",
    createLabel: "新建会话",
    empty: "还没有会话",
    noResults: "没有匹配的会话",
    ariaLabel: "会话",
  },
  promptComposer: {
    placeholder: "输入问题、粘贴图片或添加上下文…",
    attachmentLabel: "添加文件",
    attachmentsLabel: "附件",
    submitLabel: "发送消息",
    stopLabel: "停止生成",
    removeAttachment: (fileName) => `移除 ${fileName}`,
    retryAttachment: (fileName) => `重试 ${fileName}`,
    uploading: "上传中",
    uploadFailed: "上传失败",
    retry: "重试",
    retrying: "重试中",
    sending: "发送中",
    generating: "生成中",
    stopping: "停止中",
    notAccepted: "消息未被接受，请重试。",
    fileTypeRejected: (fileName) => `${fileName} 的文件类型不受支持。`,
    fileTooLarge: (fileName, limit) => `${fileName} 超过 ${limit} 的大小限制。`,
    attachmentLimit: (limit) => `最多只能添加 ${limit} 个附件。`,
    duplicateAttachment: (fileName) => `${fileName} 的附件标识重复。`,
    attachmentCreationFailed: (fileName, reason) => `${fileName} 无法添加：${reason}`,
  },
  messageBubble: {
    system: "系统",
    user: "你",
    assistant: "助手",
    tool: "工具",
    queued: "排队中",
    streaming: "生成中",
    complete: "已完成",
    error: "失败",
    aborted: "已停止",
  },
  messageList: {
    empty: "开始一段对话",
    jumpToLatest: "回到最新消息",
    ariaLabel: "对话消息",
    newActivity: (count, jumpLabel) => `${jumpLabel} · ${count} 条新动态`,
    roleSystem: "系统",
    roleUser: "用户",
    roleAssistant: "助手",
    roleTool: "工具",
    responseComplete: (role) => `${role}回复已完成`,
    messageFailed: (role) => `${role}消息发送失败`,
    responseStopped: (role) => `${role}回复已停止`,
    messageAdded: (role, count) =>
      count > 1 ? `${count} 条新消息，最新来自${role}` : `${role}新增了一条消息`,
  },
  messageActions: {
    ariaLabel: "消息操作",
    copy: "复制消息",
    regenerate: "重新生成",
    edit: "编辑消息",
    like: "有帮助",
    dislike: "没有帮助",
    copied: "消息已复制",
    pending: {
      copy: "正在复制消息",
      regenerate: "正在请求新的回复",
      edit: "正在打开消息编辑器",
      like: "正在保存正向反馈",
      dislike: "正在保存负向反馈",
    },
    success: {
      copy: "消息已复制",
      regenerate: "已请求新的回复",
      edit: "消息编辑器已打开",
      like: "反馈已保存",
      dislike: "反馈已保存",
    },
    actionFailed: (actionLabel, error) => `${actionLabel}失败：${error}`,
  },
  messageBranchNavigator: {
    ariaLabel: "回复版本",
    previous: "上一个回复版本",
    next: "下一个回复版本",
  },
  reasoningPanel: {
    title: "思考过程",
    idle: "空闲",
    running: "思考正在进行",
    complete: "已完成",
    error: "思考失败",
    thinking: "正在思考",
    details: "思考详情",
  },
  agentSteps: {
    pending: "等待中",
    waiting: "等待确认",
    running: "进行中",
    complete: "已完成",
    error: "失败",
    cancelled: "已取消",
    retry: "重试",
    retrying: "正在重试…",
    empty: "暂无步骤",
  },
  toolCallCard: {
    draft: "草稿",
    approvalRequired: "需要确认",
    running: "执行中",
    complete: "已完成",
    error: "失败",
    cancelled: "已取消",
    lowRisk: "低风险",
    mediumRisk: "中等风险",
    highRisk: "高风险",
    criticalRisk: "严重风险",
    arguments: "参数",
    result: "结果",
    errorLabel: "错误",
    details: (toolName) => `${toolName} 详情`,
    approvalActions: (toolName) => `${toolName} 确认操作`,
    approve: "确认",
    approving: "确认中…",
    reject: "拒绝",
    rejecting: "拒绝中…",
    retry: "重试",
    retrying: "重试中…",
  },
  codeBlock: {
    copy: "复制代码",
    copied: "已复制",
    wrap: "自动换行",
    unwrap: "关闭自动换行",
    expand: "展开全部代码",
    collapse: "收起代码",
    download: "下载代码",
    retryHighlight: "重试代码高亮",
    highlightUnavailable: (error) => `代码高亮不可用：${error}`,
  },
  formula: {
    copy: "复制公式",
    copied: "已复制",
  },
  mermaidDiagram: {
    controls: "图表控制",
    zoomIn: "放大",
    zoomOut: "缩小",
    resetZoom: "重置缩放",
    copySource: "复制图表源码",
    copied: "已复制",
    diagram: "Mermaid 图表",
    rendering: "正在渲染图表",
    empty: "Mermaid 图表定义为空。",
    retry: "重试",
  },
  markdownRenderer: {
    streaming: "回复正在生成",
  },
  streamingIndicator: {
    generating: "正在生成回复",
  },
};

export function resolveVeloraLocale(locale: string | undefined): VeloraLocale {
  return locale?.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export function mergeVeloraMessages(
  base: VeloraMessages,
  overrides: VeloraMessagesOverride | undefined,
): VeloraMessages {
  if (!overrides) return base;

  const mergeBranch = (baseBranch: unknown, overrideBranch: unknown): unknown => {
    if (
      overrideBranch === undefined ||
      baseBranch === null ||
      typeof baseBranch !== "object" ||
      Array.isArray(baseBranch)
    ) {
      return overrideBranch ?? baseBranch;
    }
    if (
      overrideBranch === null ||
      typeof overrideBranch !== "object" ||
      Array.isArray(overrideBranch)
    ) {
      return overrideBranch;
    }

    const result: Record<string, unknown> = { ...(baseBranch as Record<string, unknown>) };
    Object.entries(overrideBranch).forEach(([key, value]) => {
      result[key] = mergeBranch(result[key], value);
    });
    return result;
  };

  return mergeBranch(base, overrides) as VeloraMessages;
}
