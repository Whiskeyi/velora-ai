import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function localAgent(): Plugin {
  return {
    name: "velora-example-agent",
    configureServer(server) {
      server.middlewares.use("/api/agent", (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.end();
          return;
        }
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        const send = (event: string, value: unknown) =>
          response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
        send("start", {});
        const chunks = ["This response ", "arrived through ", "a real SSE stream."];
        chunks.forEach((delta, index) => {
          setTimeout(
            () => {
              send("text-delta", { delta });
              if (index === chunks.length - 1) {
                send("done", { finishReason: "stop" });
                response.end();
              }
            },
            240 * (index + 1),
          );
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localAgent()],
});
