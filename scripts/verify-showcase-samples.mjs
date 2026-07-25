import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createElement } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderElementAsync } from "react-live";

const expectedSampleKeys = [
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
  "mermaid-diagram",
  "markdown-renderer",
  "streaming-indicator",
  "tool-call-card",
];

const componentNames = [
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
  "usePromptDrafts",
];

function extractSamples(source) {
  const registryStart = source.indexOf("const samples: Sample[] = [");
  const registryEnd = source.indexOf(
    "\n];\n\nfunction getSiteBasePath",
    registryStart,
  );

  if (registryStart === -1 || registryEnd === -1) {
    throw new Error("Could not locate the showcase sample registry.");
  }

  const registry = source.slice(registryStart, registryEnd);
  const keyPattern = /\bkey:\s*"([^"]+)"/g;
  const samples = [];

  for (const match of registry.matchAll(keyPattern)) {
    const key = match[1];
    const codeMarker = "code: `";
    const codeStart = registry.indexOf(codeMarker, match.index) + codeMarker.length;

    if (codeStart < codeMarker.length) {
      throw new Error(`Could not locate the code template for ${key}.`);
    }

    let cursor = codeStart;
    while (cursor < registry.length) {
      if (registry[cursor] === "\\") {
        cursor += 2;
        continue;
      }
      if (registry[cursor] === "`") break;
      cursor += 1;
    }

    if (cursor >= registry.length) {
      throw new Error(`Could not find the end of the code template for ${key}.`);
    }

    const rawCode = registry.slice(codeStart, cursor);
    const code = rawCode.replace(/\\([\\`$])/g, "$1");
    samples.push({ key, code });
  }

  return samples;
}

function compileAndRender({ key, code }, scope) {
  return new Promise((resolveSample, rejectSample) => {
    const fail = (error) => {
      const reason = error instanceof Error ? error.message : String(error);
      rejectSample(new Error(`${key}: ${reason}`));
    };

    try {
      renderElementAsync(
        { code, scope, enableTypeScript: true },
        (SampleComponent) => {
          try {
            const markup = renderToStaticMarkup(createElement(SampleComponent));
            if (!markup.trim()) {
              throw new Error("SSR returned empty markup.");
            }
            resolveSample(markup.length);
          } catch (error) {
            fail(error);
          }
        },
        fail,
      );
    } catch (error) {
      fail(error);
    }
  });
}

const sourcePath = resolve("app/showcase-client.tsx");
const packagePath = resolve("packages/react/dist/index.mjs");
const source = await readFile(sourcePath, "utf8");
const samples = extractSamples(source);
const actualKeys = samples.map(({ key }) => key);

if (JSON.stringify(actualKeys) !== JSON.stringify(expectedSampleKeys)) {
  throw new Error(
    `Expected the ${expectedSampleKeys.length} showcase samples ${expectedSampleKeys.join(", ")}; found ${actualKeys.join(", ")}.`,
  );
}

const velora = await import(pathToFileURL(packagePath).href);
const missingComponents = componentNames.filter((name) => velora[name] == null);
if (missingComponents.length > 0) {
  throw new Error(`Built package is missing showcase components: ${missingComponents.join(", ")}.`);
}

const scope = {
  ...Object.fromEntries(componentNames.map((name) => [name, velora[name]])),
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
};

for (const sample of samples) {
  const markupLength = await compileAndRender(sample, scope);
  console.log(`Showcase sample passed: ${sample.key} (${markupLength} SSR characters)`);
}

console.log(`Verified ${samples.length} React Live showcase samples against the built package.`);
