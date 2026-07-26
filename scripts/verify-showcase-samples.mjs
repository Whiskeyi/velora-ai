import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderElementAsync } from "react-live";
import ts from "typescript";

import { SHOWCASE_SAMPLES } from "../app/showcase/samples-data.mjs";

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

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function extractComponentKeys(source) {
  const sourceFile = ts.createSourceFile(
    "component-registry.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        declaration.name.text !== "COMPONENT_KEYS" ||
        !declaration.initializer
      ) {
        continue;
      }

      const initializer = unwrapExpression(declaration.initializer);
      if (!ts.isArrayLiteralExpression(initializer)) break;

      return initializer.elements.map((element) => {
        if (!ts.isStringLiteralLike(element)) {
          throw new Error("COMPONENT_KEYS must contain only string literals.");
        }
        return element.text;
      });
    }
  }

  throw new Error("Could not read COMPONENT_KEYS from component-registry.ts.");
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

const registryPath = resolve("app/component-registry.ts");
const packagePath = resolve("packages/react/dist/index.mjs");
const registrySource = await readFile(registryPath, "utf8");
const expectedSampleKeys = extractComponentKeys(registrySource);
const actualKeys = SHOWCASE_SAMPLES.map(({ key }) => key);
const duplicateKeys = actualKeys.filter((key, index) => actualKeys.indexOf(key) !== index);

if (duplicateKeys.length > 0) {
  throw new Error(`Duplicate showcase samples: ${[...new Set(duplicateKeys)].join(", ")}.`);
}

if (JSON.stringify([...actualKeys].sort()) !== JSON.stringify([...expectedSampleKeys].sort())) {
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

for (const sample of SHOWCASE_SAMPLES) {
  const markupLength = await compileAndRender(sample, scope);
  console.log(`Showcase sample passed: ${sample.key} (${markupLength} SSR characters)`);
}

console.log(
  `Verified ${SHOWCASE_SAMPLES.length} React Live showcase samples against the built package.`,
);
