"use client";

import { useMemo, useState } from "react";
import {
  MessageBubble,
  MessageList,
  PromptComposer,
  ToolCallCard,
  VeloraProvider,
  createSSETransport,
  useAgentChat,
  type PromptDraft,
} from "@velora-ai/react";

export default function Page() {
  const transport = useMemo(
    () =>
      createSSETransport({
        url: "/api/agent",
        submitToolDecision: async (decision, options) => {
          const response = await fetch("/api/agent", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(decision),
            signal: options?.signal,
          });
          if (!response.ok) throw new Error("Tool decision was rejected");
        },
      }),
    [],
  );
  const chat = useAgentChat({ transport, conversationId: "approval-example" });
  const [draft, setDraft] = useState<PromptDraft>({
    text: "Prepare the release notes",
    attachments: [],
  });

  return (
    <VeloraProvider theme="dark">
      <main>
        <MessageList
          messages={chat.messages}
          conversationKey={chat.conversationId}
          renderMessage={(message) => (
            <MessageBubble message={message}>
              <p>{message.content}</p>
              {message.toolCalls?.map((toolCall) => (
                <ToolCallCard
                  key={toolCall.id}
                  toolName={toolCall.name}
                  status={toolCall.status}
                  risk={toolCall.risk}
                  arguments={toolCall.arguments}
                  result={toolCall.result}
                  error={toolCall.error}
                  onApprove={async () => {
                    const decision = await chat.approveToolCall(toolCall.id);
                    if (!decision.accepted) {
                      throw new Error(`Approval failed: ${decision.reason}`);
                    }
                  }}
                  onReject={async () => {
                    const decision = await chat.rejectToolCall(toolCall.id);
                    if (!decision.accepted) {
                      throw new Error(`Rejection failed: ${decision.reason}`);
                    }
                  }}
                />
              ))}
            </MessageBubble>
          )}
        />
        <PromptComposer
          draft={draft}
          onDraftChange={setDraft}
          runStatus={chat.isStreaming ? "streaming" : "idle"}
          onStop={() => {
            chat.stop();
          }}
          onSubmit={(nextDraft) => {
            const result = chat.send(nextDraft.text);
            return result.accepted
              ? { accepted: true }
              : { accepted: false, error: `Request rejected: ${result.reason}` };
          }}
        />
      </main>
    </VeloraProvider>
  );
}
