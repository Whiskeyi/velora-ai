import { performance } from "node:perf_hooks";

import { createAgentStore } from "../packages/react/dist/runtime-entry.mjs";

const conversationId = "benchmark";
const messages = Array.from({ length: 1_000 }, (_, index) => ({
  id: `message-${index}`,
  conversationId,
  role: index % 2 === 0 ? "user" : "assistant",
  content: `Message ${index}`,
  status: "complete",
  createdAt: index,
  updatedAt: index,
}));
const store = createAgentStore({
  conversations: [
    {
      id: conversationId,
      messageIds: messages.map((message) => message.id),
      createdAt: 0,
      updatedAt: messages.length,
    },
  ],
  messages,
});
const unchanged = store.getState().messagesById["message-500"];
const startedAt = performance.now();
for (let index = 0; index < 2_000; index += 1) {
  store.getState().appendMessageText("message-999", "x");
}
const duration = performance.now() - startedAt;

if (store.getState().messagesById["message-500"] !== unchanged) {
  throw new Error("Streaming updates invalidated an unchanged message identity");
}
if (store.getState().messagesById["message-999"]?.content.length !== 2_011) {
  throw new Error("Streaming benchmark lost message deltas");
}

console.log(
  `Runtime benchmark: 1,000 messages, 2,000 deltas in ${duration.toFixed(1)}ms; unchanged row identity preserved.`,
);
