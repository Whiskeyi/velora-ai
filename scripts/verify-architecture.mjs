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
const runtimeDependencyRules = new Map([
  ["runtime/types.ts", new Set()],
  ["runtime/abort.ts", new Set()],
  ["runtime/sse.ts", new Set(["runtime/abort.ts"])],
  ["runtime/transport.ts", new Set(["runtime/sse.ts", "runtime/types.ts"])],
  ["runtime/mock.ts", new Set(["runtime/abort.ts", "runtime/types.ts"])],
  ["runtime/store.ts", new Set(["runtime/types.ts"])],
  ["runtime/persistence.ts", new Set(["runtime/store.ts", "runtime/types.ts"])],
  ["runtime/stream-events.ts", new Set(["runtime/store.ts", "runtime/types.ts"])],
  [
    "runtime/agent-runtime.ts",
    new Set([
      "runtime/abort.ts",
      "runtime/store.ts",
      "runtime/stream-events.ts",
      "runtime/types.ts",
    ]),
  ],
  [
    "runtime/use-agent-chat.ts",
    new Set(["runtime/agent-runtime.ts", "runtime/store.ts", "runtime/types.ts"]),
  ],
]);
const showcaseSourceRoot = resolve("app/showcase");
const showcaseClientPath = resolve("app/showcase-client.tsx");
const showcaseHelperRules = new Map([
  [
    "demo-fixtures.ts",
    new Set(["@velora-ai/react/runtime", "./model"]),
  ],
  [
    "demo-transport.ts",
    new Set(["@velora-ai/react/runtime", "./model"]),
  ],
  ["prop-description.ts", new Set(["./model"])],
]);
const requiredShowcaseClientModules = [
  "./showcase/demo-fixtures",
  "./showcase/demo-transport",
  "./showcase/lazy-components",
  "./showcase/prop-description",
  "./showcase/routing",
  "./showcase/use-showcase-locale",
];

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
const dependencyGraph = new Map(
  [...modules].map(([path, module]) => [
    path,
    module.specifiers
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) => resolveRelativeModule(path, specifier, modulePaths))
      .filter(Boolean),
  ]),
);

function assertAcyclic(graph, displayPath, label) {
  const visiting = new Set();
  const visited = new Set();
  const pathStack = [];

  function visit(path) {
    if (visited.has(path)) return;
    if (visiting.has(path)) {
      const cycleStart = pathStack.indexOf(path);
      const cycle = [...pathStack.slice(cycleStart), path]
        .map((item) => displayPath(item))
        .join(" -> ");
      throw new Error(`${label} contains a dependency cycle: ${cycle}`);
    }

    visiting.add(path);
    pathStack.push(path);
    for (const dependency of graph.get(path) ?? []) visit(dependency);
    pathStack.pop();
    visiting.delete(path);
    visited.add(path);
  }

  for (const path of graph.keys()) visit(path);
}

assertAcyclic(dependencyGraph, packagePath, "Package source");

for (const [modulePath, allowedDependencies] of runtimeDependencyRules) {
  const path = resolve(packageSourceRoot, modulePath);
  const dependencies = dependencyGraph.get(path);
  if (!dependencies) {
    throw new Error(`Runtime boundary references missing module ${modulePath}.`);
  }

  for (const dependency of dependencies) {
    const dependencyPath = packagePath(dependency);
    if (
      dependencyPath.startsWith("runtime/") &&
      !allowedDependencies.has(dependencyPath)
    ) {
      throw new Error(
        `${modulePath} must not depend on ${dependencyPath}. Update the runtime layer contract intentionally before crossing this boundary.`,
      );
    }
  }
}

for (const [path, dependencies] of dependencyGraph) {
  const sourcePath = packagePath(path);
  if (!sourcePath.startsWith("components/") || sourcePath.includes(".test.")) continue;

  for (const dependency of dependencies) {
    const dependencyPath = packagePath(dependency);
    if (dependencyPath.startsWith("runtime/") && dependencyPath !== "runtime/types.ts") {
      throw new Error(
        `${sourcePath} must consume runtime contracts from runtime/types.ts, not ${dependencyPath}.`,
      );
    }
  }
}

const runtimeIndex = modules.get(resolve(packageSourceRoot, "runtime/index.ts"));
if (runtimeIndex?.specifiers.includes("./use-agent-chat")) {
  throw new Error(
    "runtime/index.ts is the headless core barrel and must not export the React adapter.",
  );
}

const rootIndex = modules.get(resolve(packageSourceRoot, "index.ts"));
if (!rootIndex?.specifiers.includes("./runtime/use-agent-chat")) {
  throw new Error("index.ts must compose the React adapter explicitly.");
}

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
const richEntryExports = new Set(richContentEntry.specifiers);
const expectedRichEntryExports = new Set([
  "./code-block-entry",
  "./formula-entry",
  "./markdown-entry",
  "./mermaid-entry",
]);

if (
  richEntryExports.size !== expectedRichEntryExports.size ||
  [...richEntryExports].some((specifier) => !expectedRichEntryExports.has(specifier))
) {
  throw new Error("rich-content-entry.ts must compose the four granular rich-content entrypoints.");
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

const routeRoots = [resolve("app"), resolve("examples")];
const serverRouteFiles = (
  await Promise.all(routeRoots.map((root) => collectSourceFiles(root)))
)
  .flat()
  .filter((path) => path.endsWith(`${sep}route.ts`));

for (const path of serverRouteFiles) {
  const source = await readFile(path, "utf8");
  const sourceFile = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  if (
    !hasClientDirective(sourceFile) &&
    readModuleSpecifiers(sourceFile).includes("@velora-ai/react")
  ) {
    throw new Error(
      `${relative(resolve("."), path)} is server code and must import a server-safe Velora subpath.`,
    );
  }
}

const showcaseSourcePaths = [
  showcaseClientPath,
  ...(await collectSourceFiles(showcaseSourceRoot)),
];
const showcaseModulePaths = new Set(showcaseSourcePaths);
const showcaseModules = new Map(
  await Promise.all(
    showcaseSourcePaths.map(async (path) => {
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
          specifiers: readModuleSpecifiers(sourceFile),
        },
      ];
    }),
  ),
);
const showcaseDependencyGraph = new Map(
  [...showcaseModules].map(([path, module]) => [
    path,
    module.specifiers
      .filter((specifier) => specifier.startsWith("."))
      .map((specifier) => resolveRelativeModule(path, specifier, showcaseModulePaths))
      .filter(Boolean),
  ]),
);

assertAcyclic(
  showcaseDependencyGraph,
  (path) => relative(resolve("app"), path).split(sep).join("/"),
  "Showcase source",
);

const showcaseClient = showcaseModules.get(showcaseClientPath);
for (const requiredModule of requiredShowcaseClientModules) {
  if (!showcaseClient?.specifiers.includes(requiredModule)) {
    throw new Error(
      `app/showcase-client.tsx must compose ${requiredModule} instead of absorbing its responsibility.`,
    );
  }
}

for (const [helperPath, allowedSpecifiers] of showcaseHelperRules) {
  const path = resolve(showcaseSourceRoot, helperPath);
  const helper = showcaseModules.get(path);
  if (!helper) {
    throw new Error(`Showcase boundary references missing module ${helperPath}.`);
  }
  for (const specifier of helper.specifiers) {
    if (!allowedSpecifiers.has(specifier)) {
      throw new Error(
        `app/showcase/${helperPath} must not depend on ${specifier}. Keep showcase infrastructure independent from page composition.`,
      );
    }
  }
}

for (const [path, dependencies] of showcaseDependencyGraph) {
  if (path === showcaseClientPath) continue;
  if (dependencies.includes(showcaseClientPath)) {
    throw new Error(
      `${relative(resolve("."), path)} must not import the showcase composition root.`,
    );
  }
}

console.log(
  `Verified acyclic package and showcase graphs, ${runtimeDependencyRules.size} runtime layer contracts, ${showcaseHelperRules.size} showcase helper contracts, ${serverEntries.length} server-safe entry graphs, ${clientEntries.length} client entry directives, ${serverRouteFiles.length} server routes, and ${granularRichContentEntries.size} granular rich-content exports.`,
);
