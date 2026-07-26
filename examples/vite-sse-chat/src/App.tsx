import { useState } from "react";
import {
  MessageList,
  PromptComposer,
  VeloraProvider,
  createSSETransport,
  useAgentChat,
  type PromptDraft,
} from "@velora-ai/react";

const transport = createSSETransport({
  url: "/api/agent",
  maxReconnectAttempts: 2,
});

export function App() {
  const chat = useAgentChat({ transport, conversationId: "vite-example" });
  const [draft, setDraft] = useState<PromptDraft>({
    text: "",
    attachments: [],
  });

  return (
    <VeloraProvider theme="dark">
      <main>
        <MessageList messages={chat.messages} conversationKey={chat.conversationId} />
        <PromptComposer
          draft={draft}
          onDraftChange={setDraft}
          runStatus={chat.isStreaming ? "streaming" : "idle"}
          onStop={() => {
            chat.stop();
          }}
          placeholder="Send through the local SSE endpoint…"
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
