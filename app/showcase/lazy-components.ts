"use client";

import { lazy } from "react";

export const CodeBlock = lazy(() =>
  import("@velora-ai/react/rich-content/code-block").then((module) => ({
    default: module.CodeBlock,
  })),
);

export const Formula = lazy(() =>
  import("@velora-ai/react/rich-content/formula").then((module) => ({
    default: module.Formula,
  })),
);

export const MarkdownRenderer = lazy(() =>
  import("@velora-ai/react/rich-content/markdown").then((module) => ({
    default: module.MarkdownRenderer,
  })),
);

export const MermaidDiagram = lazy(() =>
  import("@velora-ai/react/rich-content/mermaid").then((module) => ({
    default: module.MermaidDiagram,
  })),
);

export const LiveProvider = lazy(() =>
  import("react-live").then((module) => ({ default: module.LiveProvider })),
);

export const LiveEditor = lazy(() =>
  import("react-live").then((module) => ({ default: module.LiveEditor })),
);

export const LiveError = lazy(() =>
  import("react-live").then((module) => ({ default: module.LiveError })),
);

export const LivePreview = lazy(() =>
  import("react-live").then((module) => ({ default: module.LivePreview })),
);
