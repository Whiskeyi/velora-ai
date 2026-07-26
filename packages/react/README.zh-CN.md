# @velora-ai/react

[English](README.md) | [简体中文](README.zh-CN.md)

面向生产级 AI 对话与 Agent 工作流、与模型供应商无关的 React 交互组件。Velora 负责流式跟随、输入草稿、异步操作状态、审批控件和无障碍播报；应用继续掌控供应商数据、上传、鉴权与业务状态。

## 安装

```bash
npm install @velora-ai/react
```

React 与 React DOM 18.3 或更高版本是 peer dependency。请在应用入口或根布局中引入一次样式；JavaScript 入口不会隐式加载 CSS。

```tsx
import "@velora-ai/react/styles.css";
```

只有在渲染公式或数学 Markdown 的产品中才需要可选 KaTeX 字体样式：

```tsx
import "@velora-ai/react/rich-content.css";
```

富内容组件可以从根入口或聚合的 `rich-content` 入口导入。需要按路由或功能拆包时，请使用细粒度客户端子路径，避免加载一个代码块时同时引入 Markdown、KaTeX 和 Mermaid：

```tsx
import { CodeBlock } from "@velora-ai/react/rich-content/code-block";
import { Formula } from "@velora-ai/react/rich-content/formula";
import { MarkdownRenderer } from "@velora-ai/react/rich-content/markdown";
import { MermaidDiagram } from "@velora-ai/react/rich-content/mermaid";
```

项目站点包含支持实时编辑的工作台与组件 API 文档。API 文档按基础能力、工作区、消息、Agent 状态和生成内容分组，并列出 props、默认值、交互约定与接入建议。

## 组件使用索引

Velora 按职责拆分组件，不限制后端、模型供应商、上传层或权限系统。

| 组件 | 负责什么 | 接入重点 |
| --- | --- | --- |
| `VeloraProvider` | 主题、密度、动效和语义 token | 在 AI 界面外层包一次，按产品覆盖 token |
| `AgentShell` | 会话侧栏、主对话区、输入区和检查器布局 | 状态放在应用层，移动端抽屉交给 shell |
| `ConversationList` | 会话搜索、分组、新建和状态 | 受控 `activeId` 与 `MessageList.conversationKey` 使用同一个会话 ID |
| `PromptComposer` | 文本、附件、选择器、预检、提交和停止 | `onSubmit` 返回接受态；文件上传由应用层完成 |
| `MessageList` | 流式跟随、历史 prepend、活动提示和窗口化 | 保持消息 ID 稳定，长会话启用 `windowing` |
| `MessageBubble` | 消息外壳、附件、操作、分支和 footer | 通过 `children` 接入 `MarkdownRenderer` |
| `MessageActions` | 复制、编辑、重新生成、反馈和异步回滚 | 组件负责交互态，应用负责真实数据修改 |
| `MessageBranchNavigator` | 多候选响应切换 | 受控零基 `index`，分支内容保存在应用状态 |
| `ReasoningPanel` | 思考摘要/trace 展开与耗时 | 优先使用 `contentMode="summary"`，不要直接暴露敏感 trace |
| `AgentSteps` | 步骤状态、详情、耗时和重试 | 后端事件间保持稳定的 step ID |
| `ToolCallCard` | 工具参数、风险、审批、执行和重试 | UI 审批不能替代服务端鉴权 |
| `MarkdownRenderer` | 渐进式 GFM、数学、代码和 Mermaid 渲染 | 默认关闭 raw HTML，流式期间稳定未完成 block |
| `CodeBlock` | 高亮、复制、换行、折叠和下载 | 清理自定义 highlighter 返回的不可信 HTML |
| `Formula` | KaTeX 行内/块级渲染、复制和降级 | 保持有限的 `maxSize` 与 `maxExpand` 安全配置 |
| `MermaidDiagram` | 懒加载、缩放、源码复制和错误恢复 | 不可信图表使用严格安全配置 |
| `StreamingIndicator` | 生成、暂停、进度与完成反馈 | 放在等待内容附近，不阻塞整个界面 |

## 完整发送生命周期

`PromptComposer` 交换的是 `PromptDraft`，而不是普通字符串。`chat.send()` 会同步报告本次运行是否被接受；接受结果另外提供 `completion` Promise，用于终态工作流副作用。

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
            ? "请等待当前回复完成。"
            : "请输入消息后再发送。",
      };
    }

    // 输入框可以立即清空。completion 仅用于分析、导航或完成提示等终态副作用。
    void accepted.completion.then(({ outcome }) => {
      console.info("Agent run settled", outcome);
    });
    return { accepted: true };
  };

  return (
    <VeloraProvider theme="system" locale="zh-CN">
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

需要跨路由保持运行时，请在视图上层创建 runtime，并传给每个订阅者：

```tsx
const runtime = createAgentRuntime({ transport });

function Conversation({ id }: { id: string }) {
  const chat = useAgentChat({ runtime, transport, conversationId: id });
  // 卸载视图不会停止 runtime；只有工作流本身需要结束时才调用 chat.stop()。
}
```

`ChatRequest.messages` 使用面向供应商的 `AgentRequestMessage` 结构。Velora 默认排除 UI 状态、思考、步骤、分支和错误。每个请求在重连期间都保留稳定的 `requestId`、协议版本与幂等 header。

`VeloraProvider` 同时提供组件国际化和设计 token。设置一次 `locale="en-US"` 或 `locale="zh-CN"`，即可统一内置标签、屏幕阅读器播报、placeholder 和操作名称。使用类型化 `messages` prop 可以局部覆盖产品文案，不需要复制完整消息表。

不要让输入框提交等待整个 stream。`runStatus` 是停止按钮与生成状态的事实来源；`messages` 是流式输出的事实来源。`chat.stop()` 会同步终止活动 transport，并返回是否确实停止了一个运行。需要远程取消握手的应用，可以在握手完成前暂时传入 `runStatus="stopping"`。

附件转换只发送 JSON 安全的文件描述，不发送文件字节。请先通过应用上传层上传二进制数据，再将持久 URL 或供应商引用写入 `AgentAttachment`。仅客户端有效的预览 URL 不是服务端上传 URL。

## 草稿与附件

`PromptDraft` 包含 `{ text, attachments }`。`PromptAttachment` 保存浏览器 `File`、稳定 ID、可选预览 URL 与可选 `ready | uploading | error` 状态。上传中或失败的附件会阻止提交。

`PromptComposer` 支持通过 `draft` + `onDraftChange` 使用受控状态，也可以通过 `defaultDraft` 初始化本地状态。交互协议还包括：

- 文件选择、拖放和剪贴板输入，以及类型、大小、数量、重复与构造失败原因；
- 对输入法安全的 `enter`、`mod-enter` 或 `button-only` 提交快捷键；
- 自动高度、字符限制、附件渲染与重试 hook；
- 同步接受或通过 `onSubmit` 执行异步预检；
- 快照清理：接受后只移除已提交附件，不会抹掉异步预检期间新输入的文字；
- 独立的 `submitting`、`streaming`、`stopping` 与 `error` UI 状态。

### 按会话隔离草稿

`usePromptDrafts` 会在用户切换会话时保留文本和附件。草稿 key 由应用定义，因此同一个 hook 也适用于 tab、Agent 或工作区。

```tsx
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
        onStop={() => chat.stop()}
      />
      <button type="button" onClick={() => clearDraft(activeId)}>丢弃当前草稿</button>
      <button type="button" onClick={clearAllDrafts}>丢弃全部草稿</button>
    </>
  );
}
```

## 消息交互

`MessageBubble` 提供 `attachments`、`branchNavigator`、`actions` 和 `footer` slot。`MessageActions` 负责重复操作锁、复制反馈、赞踩乐观回滚、成功播报和错误展示，但不会自行修改数据。`MessageBranchNavigator` 控制零基分支索引，应用负责选择对应内容。

`MessageList` 只在读者位于底部 `followThreshold` 范围内时跟随 token 增长。读者向上滚动后，组件会保持阅读位置、统计更新并显示“跳到最新”。`onReachStart` 支持加载历史；向前插入旧消息时会保持视觉滚动锚点，包括富内容后续高度变化。

切换会话或数据集时应同步更新 `conversationKey`。消息 ID 必须稳定且唯一；prepend 时保持原序列和未变化对象引用；`renderMessage` 应保持引用稳定。长历史应在渲染边界窗口化，而不是删除源状态。

## Agent 过程与审批

`ToolCallCard` 渲染草稿、待审批、运行、终态和重试状态，默认序列化参数/结果、锁定并发操作、捕获 rejected handler 并播报状态变化。应用仍负责修改 `status` 和持久化决定。

```tsx
<ToolCallCard
  toolName="deploy_preview"
  description="发布当前构建到预览地址"
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

审批按钮不是鉴权边界。执行工具前必须在服务端重新校验身份、scope、参数和策略，尤其是高风险与严重风险操作。

`ReasoningPanel` 将展开与思考状态分开。`autoOpen="while-running"` 会跟随运行，直到用户第一次手动切换；`startedAt` 或 `elapsedMs` 驱动耗时。`AgentSteps` 接收不可变 `AgentStep[]`，自动展开运行/错误详情并保护异步重试。

## 富内容交互

- `MarkdownRenderer` 支持 GFM、数学、代码和 Mermaid fence。流式时 deferred 模式保持输入响应，未闭合 Mermaid fence 会先显示源码。
- `CodeBlock` 支持复制、换行、折叠、下载、自定义操作、异步高亮、abort、错误降级和重试。
- `Formula` 使用 KaTeX 渲染 HTML + MathML，并可提供复制与解析错误 UI。
- `MermaidDiagram` 按需加载 Mermaid、串行渲染、缓存最多 32 个任务，并支持缩放、重置、复制源码、回调和重试。

消费者 highlighter 返回的 `{ html }` 会被视为可信内容，不会自动清理。优先返回 React node，或先净化来自供应商、模型和用户的 HTML。`MermaidDiagram` 始终锁定严格安全配置。

## 受控状态表

| 组件 / 状态 | 受控 prop | 初始 prop | 变化回调 |
| --- | --- | --- | --- |
| `PromptComposer` 草稿 | `draft` | `defaultDraft` | `onDraftChange` |
| `ConversationList` 会话 | `activeId` | `defaultActiveId` | `onActiveChange` |
| `MessageActions` 反馈 | `feedback` | `defaultFeedback` | `onFeedbackChange` |
| `MessageBranchNavigator` 分支 | `index` | `defaultIndex` | `onIndexChange` |
| `ReasoningPanel` 展开 | `open` | `defaultOpen` | `onOpenChange` |
| `AgentSteps` 展开项 | `expandedStepIds` | `defaultExpandedStepIds` | `onExpandedStepIdsChange` |
| `ToolCallCard` 展开 | `expanded` | `defaultExpanded` | `onExpandedChange` |
| `CodeBlock` 换行 | `wrap` | `defaultWrap` | `onWrapChange` |
| `CodeBlock` 折叠 | `collapsed` | `defaultCollapsed` | `onCollapsedChange` |
| `MermaidDiagram` 缩放 | `zoom` | `defaultZoom` | `onZoomChange` |
| `AgentShell` 移动面板 | `mobileSidebarOpen`、`mobileInspectorOpen` | 对应的 `defaultMobile*Open` | 对应的 `onMobile*OpenChange` |

## 状态、性能与无障碍边界

- 每个界面或工作区拥有隔离的 headless runtime；包内不存在全局 Agent store。直接读取 Zustand vanilla store 时使用窄 selector。
- 会话、消息、步骤和附件应按不可变数据处理。稳定引用能让 memo 后的已完成行避开流式渲染。
- 文本与思考增量默认按 16 ms 批处理。`streamBatchMs: 0` 仅用于确定性测试或明确要求立即更新的场景。
- Mermaid 动态导入。富内容渲染应远离输入按键路径，并使用真实 token 频率与长输出验证生产 trace。
- 内置交互控件提供键盘路径、可见焦点、状态/错误播报与 reduced-motion 行为。替换默认标签或图标时应提供有意义的本地化名称。
- `AgentShell` 移动抽屉会锁定焦点、使背景 inert、响应 Escape/遮罩并恢复触发器焦点。断点基于容器宽度。
- 稳定的 `vl-*` class 与类型化 `classNames` / `styles` slot 是公共样式表面。主题 token 由 `VeloraProvider` 通过 CSS 自定义属性提供。

包使用 MIT 许可证，当前版本为 `0.1.0`。
