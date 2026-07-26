import { fileURLToPath } from "node:url";

const fromProjectRoot = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

export const reactPackageAliases = [
  {
    find: /^@velora-ai\/react\/rich-content\/code-block$/,
    replacement: fromProjectRoot("packages/react/src/code-block-entry.ts"),
  },
  {
    find: /^@velora-ai\/react\/rich-content\/formula$/,
    replacement: fromProjectRoot("packages/react/src/formula-entry.ts"),
  },
  {
    find: /^@velora-ai\/react\/rich-content\/markdown$/,
    replacement: fromProjectRoot("packages/react/src/markdown-entry.ts"),
  },
  {
    find: /^@velora-ai\/react\/rich-content\/mermaid$/,
    replacement: fromProjectRoot("packages/react/src/mermaid-entry.ts"),
  },
  {
    find: /^@velora-ai\/react\/rich-content$/,
    replacement: fromProjectRoot("packages/react/src/rich-content-entry.ts"),
  },
  {
    find: /^@velora-ai\/react\/styles\.css$/,
    replacement: fromProjectRoot("packages/react/src/velora.css"),
  },
  {
    find: /^@velora-ai\/react$/,
    replacement: fromProjectRoot("packages/react/src/index.ts"),
  },
];
