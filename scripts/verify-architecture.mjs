import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";

import ts from "typescript";

const packageSourceRoot = resolve("packages/react/src");
const sourceExtensions = new Set([".ts", ".tsx", ".mts", ".mtsx"]);
const serverEntries = ["runtime-entry.ts", "transport-entry.ts"];
const clientEntries = [
  "index.ts",
  "components-entry.ts",
  "hooks-entry.ts",
  "rich-content-entry.ts",
  "code-block-entry.ts",
  "formula-entry.ts",
  "markdown-entry.ts",
  "mermaid-entry.ts",
];
const forbiddenServerPackages = ["react", "react-dom", "zustand/react"];
const granularRichContentEntries = new Map([
  ["code-block-entry.ts", "./components/CodeBlock"],
  ["formula-entry.ts", "./components/Formula"],
  ["markdown-entry.ts", "./components/MarkdownRenderer"],
  ["mermaid-entry.ts", "./components/MermaidDiagram"],
]);

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(path);
      return sourceExtensions.has(extname(entry.name)) ? [path] : [];
    }),
  );
  return nested.flat();
}

function packagePath(path) {
  return relative(packageSourceRoot, path).split(sep).join("/");
}

function hasClientDirective(sourceFile) {
  const [firstStatement] = sourceFile.statements;
  return Boolean(
    firstStatement &&
    ts.isExpressionStatement(firstStatement) &&
    ts.isStringLiteral(firstStatement.expression) &&
    firstStatement.expression.text === "use client",
  );
}

function readModuleSpecifiers(sourceFile) {
  const specifiers = [];

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function resolveRelativeModule(fromPath, specifier, modulePaths) {
  const unresolved = resolve(dirname(fromPath), specifier);
  const candidates = [
    unresolved,
    ...[...sourceExtensions].map((extension) => `${unresolved}${extension}`),
    ...[...sourceExtensions].map((extension) => resolve(unresolved, `index${extension}`)),
  ];
  return candidates.find((candidate) => modulePaths.has(candidate));
}

function isForbiddenServerPackage(specifier) {
  return forbiddenServerPackages.some(
    (name) => specifier === name || specifier.startsWith(`${name}/`),
  );
}

const sourcePaths = await collectSourceFiles(packageSourceRoot);
const modulePaths = new Set(sourcePaths);
const modules = new Map(
  await Promise.all(
    sourcePaths.map(async (path) => {
      const source = await readFile(path, "utf8");
      const sourceFile = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        true,
        path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      return [
        path,
        {
          client: hasClientDirective(sourceFile),
          specifiers: readModuleSpecifiers(sourceFile),
        },
      ];
    }),
  ),
);

for (const entry of clientEntries) {
  const path = resolve(packageSourceRoot, entry);
  if (!modules.get(path)?.client) {
    throw new Error(`${entry} must declare "use client" as its first statement.`);
  }
}

for (const entry of serverEntries) {
  const entryPath = resolve(packageSourceRoot, entry);
  const queue = [entryPath];
  const visited = new Set();

  while (queue.length > 0) {
    const path = queue.pop();
    if (!path || visited.has(path)) continue;
    visited.add(path);

    const module = modules.get(path);
    if (!module) {
      throw new Error(`${entry} reaches unknown module ${packagePath(path)}.`);
    }
    if (module.client) {
      throw new Error(
        `${entry} reaches client module ${packagePath(path)}. Keep the server-safe entry React-free.`,
      );
    }
    if (packagePath(path).startsWith("components/")) {
      throw new Error(`${entry} must not depend on component module ${packagePath(path)}.`);
    }

    for (const specifier of module.specifiers) {
      if (isForbiddenServerPackage(specifier)) {
        throw new Error(
          `${entry} reaches browser package "${specifier}" through ${packagePath(path)}.`,
        );
      }
      if (!specifier.startsWith(".")) continue;

      const dependency = resolveRelativeModule(path, specifier, modulePaths);
      if (!dependency) {
        throw new Error(
          `${packagePath(path)} has an unresolved relative dependency "${specifier}".`,
        );
      }
      queue.push(dependency);
    }
  }

  console.log(`Server boundary passed: ${entry} (${visited.size} source modules).`);
}

const richContentEntry = modules.get(resolve(packageSourceRoot, "rich-content-entry.ts"));
const richComponentExports = new Set(
  richContentEntry.specifiers.filter((specifier) => specifier.startsWith("./components")),
);
const expectedRichComponentExports = new Set([
  "./components/CodeBlock",
  "./components/Formula",
  "./components/MarkdownRenderer",
  "./components/MermaidDiagram",
]);

if (
  richComponentExports.size !== expectedRichComponentExports.size ||
  [...richComponentExports].some((specifier) => !expectedRichComponentExports.has(specifier))
) {
  throw new Error(
    "rich-content-entry.ts must export the four rich components directly instead of traversing the full component barrel.",
  );
}

for (const [entry, expectedSpecifier] of granularRichContentEntries) {
  const module = modules.get(resolve(packageSourceRoot, entry));
  if (
    !module ||
    module.specifiers.length !== 1 ||
    module.specifiers[0] !== expectedSpecifier
  ) {
    throw new Error(
      `${entry} must expose only ${expectedSpecifier} so consumers can load rich components independently.`,
    );
  }
}

console.log(
  `Verified ${serverEntries.length} server-safe entry graphs, ${clientEntries.length} client entry directives, and ${granularRichContentEntries.size} granular rich-content exports.`,
);
