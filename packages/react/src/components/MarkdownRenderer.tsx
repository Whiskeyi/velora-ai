import {
  Children,
  forwardRef,
  isValidElement,
  memo,
  type HTMLAttributes,
  type ReactNode,
  useDeferredValue,
  useMemo,
} from "react";
import ReactMarkdown, {
  type Components,
  type Options as ReactMarkdownOptions,
} from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CodeBlock, type CodeBlockProps, type CodeHighlighter } from "./CodeBlock";
import {
  MermaidDiagram,
  type MermaidDiagramProps,
  type SafeMermaidConfig,
} from "./MermaidDiagram";
import { useComponentClass, useVelora } from "./VeloraProvider";
import { cx } from "./utils";

export interface MarkdownRendererProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children">,
    Omit<
      ReactMarkdownOptions,
      "children" | "components" | "remarkPlugins" | "rehypePlugins"
    > {
  content: string;
  streaming?: boolean;
  streamingMode?: "deferred" | "immediate";
  /** Keeps an unfinished Mermaid fence as source until its closing fence arrives. */
  stabilizeIncompleteBlocks?: boolean;
  streamingLabel?: string;
  components?: Components;
  remarkPlugins?: ReactMarkdownOptions["remarkPlugins"];
  rehypePlugins?: ReactMarkdownOptions["rehypePlugins"];
  codeHighlighter?: CodeHighlighter;
  codeBlockProps?: Partial<
    Omit<CodeBlockProps, "code" | "language" | "highlighter" | "children">
  >;
  mermaidConfig?: SafeMermaidConfig;
  mermaidProps?: Partial<Omit<MermaidDiagramProps, "chart" | "config">>;
}

function stabilizeStreamingContent(content: string): string {
  const fencePattern = /^(\s*)(`{3,}|~{3,})([^\n]*)$/gm;
  const openFences: Array<{
    marker: string;
    infoStart: number;
    infoEnd: number;
    info: string;
  }> = [];
  let match: RegExpExecArray | null;
  while ((match = fencePattern.exec(content))) {
    const marker = match[2] ?? "";
    const current = openFences.at(-1);
    if (current && marker[0] === current.marker[0] && marker.length >= current.marker.length) {
      openFences.pop();
      continue;
    }
    const info = match[3] ?? "";
    openFences.push({
      marker,
      info,
      infoStart: match.index + (match[1]?.length ?? 0) + marker.length,
      infoEnd: match.index + match[0].length,
    });
  }
  const unfinished = openFences.at(-1);
  if (!unfinished || unfinished.info.trim().toLowerCase() !== "mermaid") return content;
  return `${content.slice(0, unfinished.infoStart)}text${content.slice(unfinished.infoEnd)}`;
}

function MarkdownRendererInner(
  {
    content,
    streaming = false,
    streamingMode = "deferred",
    stabilizeIncompleteBlocks = true,
    streamingLabel,
    components,
    remarkPlugins,
    rehypePlugins,
    codeHighlighter,
    codeBlockProps,
    mermaidConfig,
    mermaidProps,
    className,
    skipHtml = true,
    allowElement,
    allowedElements,
    disallowedElements,
    remarkRehypeOptions,
    unwrapDisallowed,
    urlTransform,
    ...divProps
  }: MarkdownRendererProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  const componentClass = useComponentClass("markdown");
  const { messages } = useVelora();
  const resolvedStreamingLabel =
    streamingLabel ?? messages.markdownRenderer.streaming;
  const deferredContent = useDeferredValue(content);
  const candidateContent =
    streaming && streamingMode === "deferred" ? deferredContent : content;
  const renderedContent = useMemo(
    () =>
      streaming && stabilizeIncompleteBlocks
        ? stabilizeStreamingContent(candidateContent)
        : candidateContent,
    [candidateContent, stabilizeIncompleteBlocks, streaming],
  );

  const markdownComponents = useMemo<Components>(() => {
    const renderBlockCode = (source: string, codeClassName?: string) => {
      const match = /(?:^|\s)language-([^\s]+)/.exec(codeClassName ?? "");
      const language = match?.[1];

      if (language?.toLowerCase() === "mermaid") {
        return (
          <MermaidDiagram
            {...mermaidProps}
            chart={source}
            config={mermaidConfig}
          />
        );
      }

      return (
        <CodeBlock
          {...codeBlockProps}
          code={source}
          language={language}
          highlighter={codeHighlighter}
        />
      );
    };

    const defaults: Components = {
      pre: ({ children, node: _node, ...props }) => {
        if (components?.code) {
          return <pre {...props}>{children}</pre>;
        }
        const childElements = Children.toArray(children);
        const child = childElements.length === 1 ? childElements[0] : null;
        if (!isValidElement(child)) {
          return <pre {...props}>{children}</pre>;
        }

        const codeProps = child.props as {
          children?: ReactNode;
          className?: string;
        };
        const source = String(codeProps.children ?? "").replace(/\n$/, "");
        return renderBlockCode(source, codeProps.className);
      },
      code: ({ className: codeClassName, children, node: _node, ...props }) => {
        return (
          <code {...props} className={codeClassName}>
            {children}
          </code>
        );
      },
      a: ({ node: _node, href, children, ...props }) => {
        const external = Boolean(href && /^(https?:)?\/\//.test(href));
        return (
          <a
            {...props}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer noopener" : undefined}
          >
            {children}
          </a>
        );
      },
    };
    return { ...defaults, ...components };
  }, [codeBlockProps, codeHighlighter, components, mermaidConfig, mermaidProps]);

  const mergedRemarkPlugins = useMemo(
    () => [remarkGfm, remarkMath, ...(remarkPlugins ?? [])],
    [remarkPlugins],
  );
  const mergedRehypePlugins = useMemo(
    () => [rehypeKatex, ...(rehypePlugins ?? [])],
    [rehypePlugins],
  );

  return (
    <div
      {...divProps}
      ref={ref}
      className={cx(componentClass, className)}
      data-streaming={streaming ? "true" : "false"}
      aria-busy={streaming || undefined}
    >
      <ReactMarkdown
        skipHtml={skipHtml}
        allowElement={allowElement}
        allowedElements={allowedElements}
        disallowedElements={disallowedElements}
        remarkRehypeOptions={remarkRehypeOptions}
        unwrapDisallowed={unwrapDisallowed}
        urlTransform={urlTransform}
        components={markdownComponents}
        remarkPlugins={mergedRemarkPlugins}
        rehypePlugins={mergedRehypePlugins}
      >
        {renderedContent}
      </ReactMarkdown>
      {streaming ? (
        <>
          <span className="vl-markdown__cursor" aria-hidden="true" />
          <span className="vl-sr-only" role="status">
            {resolvedStreamingLabel}
          </span>
        </>
      ) : null}
    </div>
  );
}

const ForwardedMarkdownRenderer = forwardRef<HTMLDivElement, MarkdownRendererProps>(
  MarkdownRendererInner,
);
ForwardedMarkdownRenderer.displayName = "MarkdownRenderer";

export const MarkdownRenderer = memo(ForwardedMarkdownRenderer);
