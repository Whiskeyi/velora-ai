import { access, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const packageRoot = new URL("../packages/react/", import.meta.url);
const entryUrl = new URL("dist/index.mjs", packageRoot);
const declarationUrl = new URL("dist/index.d.mts", packageRoot);
const styleUrl = new URL("dist/style.css", packageRoot);
const manifestUrl = new URL("package.json", packageRoot);
const subpathEntries = [
  ["./components", "components-entry.mjs", true],
  ["./runtime", "runtime-entry.mjs", false],
  ["./transport", "transport-entry.mjs", false],
  ["./hooks", "hooks-entry.mjs", true],
  ["./rich-content", "rich-content-entry.mjs", true],
  ["./rich-content/code-block", "code-block-entry.mjs", true],
  ["./rich-content/formula", "formula-entry.mjs", true],
  ["./rich-content/markdown", "markdown-entry.mjs", true],
  ["./rich-content/mermaid", "mermaid-entry.mjs", true],
];

const [entry, declarations, style, manifestSource] = await Promise.all([
  readFile(entryUrl, "utf8"),
  readFile(declarationUrl, "utf8"),
  readFile(styleUrl, "utf8"),
  readFile(manifestUrl, "utf8"),
]);
const manifest = JSON.parse(manifestSource);

if (!entry.startsWith('"use client";')) {
  throw new Error("Package entry is missing the React client directive");
}

for (const [subpath, filename, client] of subpathEntries) {
  const source = await readFile(new URL(`dist/${filename}`, packageRoot), "utf8");
  if (client !== source.startsWith('"use client";')) {
    throw new Error(
      `${subpath} ${client ? "must" : "must not"} carry the React client directive`,
    );
  }
  if (manifest.exports?.[subpath]?.import !== `./dist/${filename}`) {
    throw new Error(`Package manifest is missing the ${subpath} export`);
  }
}

const requiredDeclarationTypes = [
  "AgentRunOutcome",
  "PromptDraft",
  "SafeMermaidConfig",
  "SafeKatexOptions",
  "AgentToolCall",
  "ToolCallCardProps",
];

for (const typeName of requiredDeclarationTypes) {
  if (!new RegExp(`export \\{[^}]*\\b${typeName}\\b[^}]*\\}`, "s").test(declarations)) {
    throw new Error(`Package declarations are missing the public ${typeName} type`);
  }
}

const fontPaths = [
  ...style.matchAll(/url\(["']?(fonts\/KaTeX_[^)"']+)["']?\)/g),
].map((match) => match[1]);

if (fontPaths.length === 0) {
  throw new Error("Bundled styles do not reference KaTeX fonts");
}

await Promise.all(
  [...new Set(fontPaths)].map((fontPath) => access(new URL(`dist/${fontPath}`, packageRoot))),
);

const packageModule = await import(`${pathToFileURL(entryUrl.pathname).href}?smoke=${Date.now()}`);
const requiredExports = [
  "AgentShell",
  "AgentSteps",
  "CodeBlock",
  "ConversationList",
  "Formula",
  "MarkdownRenderer",
  "MermaidDiagram",
  "MessageActions",
  "MessageBranchNavigator",
  "MessageBubble",
  "MessageList",
  "PromptComposer",
  "ReasoningPanel",
  "StreamingIndicator",
  "ToolCallCard",
  "VeloraProvider",
  "createSSETransport",
  "useAgentChat",
  "usePromptDrafts",
];

for (const name of requiredExports) {
  if (!(name in packageModule)) {
    throw new Error(`Package entry is missing export: ${name}`);
  }
}

const requiredSelectors = [
  ".vl-agent-shell",
  ".vl-agent-steps",
  ".vl-code-block",
  ".vl-conversation-list",
  ".vl-formula",
  ".vl-markdown",
  ".vl-mermaid",
  ".vl-message-actions",
  ".vl-message-branch-navigator",
  ".vl-message-bubble",
  ".vl-message-list",
  ".vl-prompt-composer",
  ".vl-reasoning-panel",
  ".vl-streaming-indicator",
  ".vl-tool-call-card",
  ".vl-provider",
];
for (const selector of requiredSelectors) {
  if (!style.includes(selector)) {
    throw new Error(`Package styles are missing selector: ${selector}`);
  }
}

if (manifest.exports?.["./styles.css"] !== "./dist/style.css") {
  throw new Error("Package manifest is missing the public styles.css export");
}

console.log(
  `Verified ${requiredExports.length} public exports, ${requiredDeclarationTypes.length} public contract types, ${requiredSelectors.length} component selectors, and ${fontPaths.length} font references.`,
);
