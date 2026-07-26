# Velora AI

[English](README.md) | [简体中文](README.zh-CN.md)

[![CI](https://github.com/Whiskeyi/velora-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Whiskeyi/velora-ai/actions/workflows/ci.yml)
[![GitHub Pages](https://github.com/Whiskeyi/velora-ai/actions/workflows/pages.yml/badge.svg)](https://github.com/Whiskeyi/velora-ai/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-6d5dfc.svg)](LICENSE)

面向真实 AI 对话与 Agent 界面的流式优先 React 组件库。

Velora 不是固定的聊天模板。它将与模型供应商无关的事件和运行时层，与可组合的交互组件分离：应用负责模型事件映射、持久化、上传、鉴权和业务状态；Velora 负责流式渲染、草稿、消息、审批、富内容、无障碍和响应式 Agent 布局等复杂 UI 机制。

仓库包含可发布的 `@velora-ai/react` 包，以及支持实时编辑的组件工作台。

[打开在线组件工作台](https://ai.components.zhuchj.com/) · [阅读中文包 API 指南](packages/react/README.zh-CN.md)

文档站将实时组件工作台与组件 API 文档分开。首页保留紧凑的组件索引，每个组件都有独立的 `/components/<component>/` 详情页，包含实时编辑器、API 表格、交互约定和响应式导航。

## 推荐组合

- `VeloraProvider` 负责主题 token、密度、动效、语义 class，以及全局 `en-US` / `zh-CN` 组件文案。
- `ConversationList` 与 `usePromptDrafts` 负责会话切换和草稿隔离。
- `MessageList`、`MessageBubble` 与 `MarkdownRenderer` 负责流式消息、富文本和阅读位置。
- `PromptComposer` 负责多模态草稿、附件、预检、提交接受态和停止。
- `AgentSteps`、`ReasoningPanel` 与 `ToolCallCard` 负责步骤、思考展示和工具审批。

提交是否被接受和流式生成是否完成是两个独立状态。`chat.send()` 同步返回 accepted 或 rejected；接受后通过 `completion` 处理终态副作用。不要让输入框一直 pending 到整段 SSE 完成。

## 包含内容

| 领域 | 公共 API |
| --- | --- |
| 布局与主题 | `AgentShell`、`VeloraProvider` |
| 会话与草稿 | `ConversationList`、`usePromptDrafts` |
| 对话 | `MessageList`、`MessageBubble`、`MessageActions`、`MessageBranchNavigator`、`PromptComposer` |
| Agent 过程 | `ReasoningPanel`、`AgentSteps`、`ToolCallCard`、`StreamingIndicator` |
| 富内容 | `MarkdownRenderer`、`CodeBlock`、`Formula`、`MermaidDiagram` |
| 运行时 | `useAgentChat`、隔离的 Zustand store、可重连 SSE 与确定性 mock transport |

运行时统一处理 `start`、文本/思考增量、步骤、工具调用、消息、元数据、可恢复警告与终止事件。

纯适配器可以通过不跨越客户端边界的入口导入：

```ts
import { createSSETransport } from "@velora-ai/react/transport";
import { createAgentStore } from "@velora-ai/react/runtime";
```

## 运行工作台

需要 Node.js 20.19+、22.18+ 或 24.11+，以及 [Vite+](https://viteplus.dev/)。

```bash
vp install
vp dev
```

打开 `http://localhost:3000`。主演示使用真实的 `text/event-stream` 路由 `/api/demo/stream`，每个组件示例都可以原地编辑并重新编译。

## GitHub Pages

仓库使用官方 GitHub Pages Actions 流程从 `main` 部署组件工作台。Pages 构建通过 Vite+ 使用相对资源路径，因此能够在 `/velora-ai/` 项目子路径下运行。

```bash
npm run build:pages
```

静态构建输出到 `dist-pages/`。由于 GitHub Pages 无法托管服务端 SSE 路由，该部署会切换到 Velora 的确定性 mock transport，但仍保留相同的类型化运行时、增量 token、思考、步骤、停止和重试行为。产品接入应继续使用 `createSSETransport`。

## 快速开始

```bash
npm install @velora-ai/react
```

```tsx
"use client";

import { useState } from "react";
import {
  MessageList,
  PromptComposer,
  VeloraProvider,
  createSSETransport,
  useAgentChat,
  type PromptDraft,
  type PromptSubmitResult,
} from "@velora-ai/react";
import "@velora-ai/react/styles.css";
// 仅在渲染公式或数学 Markdown 时引入。
import "@velora-ai/react/rich-content.css";

const transport = createSSETransport({ url: "/api/agent" });

export function AgentSurface() {
  const chat = useAgentChat({ transport, conversationId: "product-copilot" });
  const [draft, setDraft] = useState<PromptDraft>({ text: "", attachments: [] });

  const submit = (nextDraft: PromptDraft): PromptSubmitResult => {
    const result = chat.send(nextDraft.text, {
      attachments: nextDraft.attachments.map(({ id, file }) => ({
        id,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      })),
    });
    if (!result.accepted) {
      return { accepted: false, error: `Message rejected: ${result.reason}` };
    }

    // 接受是同步的。仅在产品需要终态副作用时单独观察 completion。
    void result.completion.then(({ outcome }) => {
      console.info("Agent run settled", outcome);
    });
    return { accepted: true };
  };

  return (
    <VeloraProvider theme="system" locale="zh-CN">
      <MessageList messages={chat.messages} />
      <PromptComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={submit}
        runStatus={chat.isStreaming ? "streaming" : chat.status === "error" ? "error" : "idle"}
        onStop={() => {
          chat.stop();
        }}
      />
    </VeloraProvider>
  );
}
```

关键边界是“接受”与“完成”：`chat.send()` 会立即返回 `{ accepted: false, reason }`，或包含运行 ID 与 `completion: Promise<AgentRunOutcome>` 的接受结果。输入框在接受后清空；流式和停止状态由 `runStatus` 驱动；消息增量通过 store 更新。让输入提交一直等待生成完成会造成错误的交互。

文本、文件和会话草稿应使用完整 draft 协议：

```tsx
import {
  PromptComposer,
  createSSETransport,
  useAgentChat,
  usePromptDrafts,
  type PromptDraft,
  type PromptSubmitResult,
} from "@velora-ai/react";

const workspaceTransport = createSSETransport({ url: "/api/agent" });

function WorkspaceComposer({ activeId }: { activeId: string }) {
  const chat = useAgentChat({ transport: workspaceTransport, conversationId: activeId });
  const { getDraft, setDraft, clearDraft, clearAllDrafts } = usePromptDrafts();

  const submit = (draft: PromptDraft): PromptSubmitResult => {
    const result = chat.send(draft.text, {
      attachments: draft.attachments.map(({ id, file }) => ({
        id,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      })),
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
        accept="image/*,.pdf"
        maxFileSize={10 * 1024 * 1024}
      />
      <button type="button" onClick={() => clearDraft(activeId)}>
        丢弃当前草稿
      </button>
      <button type="button" onClick={clearAllDrafts}>
        丢弃全部草稿
      </button>
    </>
  );
}
```

`clearDraft(id)` 丢弃单个会话的文本和附件；`clearAllDrafts()` 适合在工作区或账号关闭时使用。文件字节有意不进入 transport 的 JSON 请求；请在产品上传层完成上传，并把已就绪附件映射为持久化 `AgentAttachment` 引用。

## 交互约定

- `MessageList` 仅在读者接近底部时跟随流式增长。向上滚动会保留阅读位置、累计新活动并显示“跳到最新”。切换数据集时传入 `conversationKey`，让滚动与活动状态随会话重置。长历史使用 `windowing={{ threshold: 200 }}`。
- `MessageActions` 提供复制、重新生成、编辑、赞踩、异步锁、回滚和状态播报。`MessageBranchNavigator` 通过按钮或方向键/Home/End 切换从零开始的响应版本。真实数据修改与分支数据由应用负责。
- `ToolCallCard` 覆盖待审批、运行、完成、失败、取消与重试状态，包含风险标识和受保护的异步操作。UI 审批不能替代服务端鉴权与策略检查。
- `ReasoningPanel` 将展开状态与运行状态、耗时分离。`AgentSteps` 渲染不可变步骤，自动展开运行/错误详情，测量耗时并保护重试操作。
- `CodeBlock` 支持复制、换行、折叠、下载、可取消异步高亮、降级与重试。`MermaidDiagram` 支持懒加载、缩放/重置、复制源码、严格安全配置、缓存与渲染重试。
- `MarkdownRenderer` 延后昂贵的流式计算，保持未闭合 Mermaid fence 稳定，默认跳过 raw HTML，并组合 GFM、KaTeX、代码和图表。

更多内容参见中文[使用与 API 指南](packages/react/README.zh-CN.md)、[流式协议](docs/streaming-protocol.md)、[架构说明](docs/architecture.md)和[性能约定](docs/performance.md)。

## 安全、性能与无障碍

- 消费者 highlighter 返回的 `{ html }` 会被视为可信 HTML。优先返回 React node，或先清理来自模型、供应商和用户的不可信 HTML。Mermaid 的安全敏感配置固定为严格模式。
- 未变化的消息与步骤应保持对象引用稳定，`renderMessage` 也应保持稳定。流式增量默认按 16 ms 批处理；已完成行通过 memo 避开活动 token 更新。
- Mermaid 按需加载。富文本解析不进入输入框按键路径，长历史应在渲染边界窗口化，而不是截断源状态。
- 交互组件包含无障碍名称、键盘操作、状态/错误 live region、可见焦点和 reduced-motion 处理。`AgentShell` 抽屉会锁定焦点、将背景设为 inert、可预测关闭，并使用容器而不是视口断点。
- 组件暴露稳定的 `vl-*` class、类型化语义 slot 与 CSS token 主题能力，不从 JavaScript 注入样式。

## 运行时适配器

```ts
const transport = createSSETransport({
  url: "/api/agent",
  maxReconnectAttempts: 3,
  connectTimeoutMs: 15_000,
  headers: () => ({ Authorization: "Bearer …" }),
  parseEvent(frame) {
    return frame.event === "token"
      ? { type: "text-delta", delta: JSON.parse(frame.data).text }
      : null;
  },
});
```

重连会通过 `Last-Event-ID` 携带最新 SSE `id`；只应对能够根据自动提供的 `requestId` / `Idempotency-Key` 去重的端点启用。`useAgentChat` 还支持 `prepareRequestMessages` 完成 token 窗口裁剪与供应商映射，并通过 `onWarning` 接收非终止错误。发送给供应商的是安全消息投影，不包含 UI 的思考、步骤、分支和诊断状态。

`createAgentRuntime` 在 React 之外管理活动运行，避免路由切换或多面板意外终止任务。`createMockTransport` 与真实接入使用同一个 `AgentTransport` 协议，适合确定性组件测试与演示。

## 质量命令

```bash
vp check
vp test run
vp pack
npm run verify:package
npm run verify:api-docs
npm run verify:showcase
vp build
npm run verify:site-css
npm run build:pages
npm run verify:bundle
npm run test:e2e
```

## 仓库结构

```text
app/                              工作台与模拟 SSE 路由
packages/react/src/components/   公共交互组件
packages/react/src/runtime/      transport、协议、store 与 React hook
examples/                        可运行的 SSE 与工具审批接入示例
docs/                             架构与性能约定
```

Velora 使用 MIT 许可证。提交变更前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [SECURITY.md](SECURITY.md)。
