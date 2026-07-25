import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(root, "dist-pages");
const sourceHtml = await readFile(resolve(outputDirectory, "index.html"), "utf8");
const componentKeys = [
  "agent-shell",
  "velora-provider",
  "conversation-list",
  "prompt-composer",
  "message-bubble",
  "message-actions",
  "message-branch-navigator",
  "message-list",
  "reasoning-panel",
  "agent-steps",
  "code-block",
  "formula",
  "markdown-renderer",
  "mermaid-diagram",
  "streaming-indicator",
  "tool-call-card",
];

const nestedHtml = sourceHtml
  .replaceAll('href="./', 'href="../../')
  .replaceAll('src="./', 'src="../../')
  .replaceAll('content="./', 'content="../../');

await Promise.all(
  componentKeys.map(async (componentKey) => {
    const routeDirectory = resolve(outputDirectory, "components", componentKey);
    await mkdir(routeDirectory, { recursive: true });
    await writeFile(resolve(routeDirectory, "index.html"), nestedHtml);
  }),
);

console.log(`Prepared ${componentKeys.length} static component routes.`);
