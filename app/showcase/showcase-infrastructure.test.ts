import { describe, expect, it } from "vitest";

import {
  demoConversations,
  getDemoMessages,
  localizeConversations,
  localizeDemoMessages,
} from "./demo-fixtures";
import { getPropDescription } from "./prop-description";
import { resolveShowcaseLocale } from "./use-showcase-locale";

describe("showcase infrastructure", () => {
  it("localizes seeded messages without changing their identity", () => {
    const english = getDemoMessages("en");
    const chinese = getDemoMessages("zh");

    expect(chinese.map((message) => message.id)).toEqual(
      english.map((message) => message.id),
    );
    expect(chinese.find((message) => message.id === "assistant-demo")?.content).toContain(
      "界面已经就绪",
    );
  });

  it("preserves runtime message state while localizing known content", () => {
    const runtimeMessage = {
      ...getDemoMessages("en")[0]!,
      metadata: { source: "runtime" },
    };
    const [localized] = localizeDemoMessages([runtimeMessage], "zh");

    expect(localized?.metadata).toEqual({ source: "runtime" });
    expect(localized?.content).not.toBe(runtimeMessage.content);
  });

  it("localizes known conversations and preserves runtime-created drafts", () => {
    const draft = {
      ...demoConversations[0],
      id: "draft-1",
      title: "Draft",
      metadata: { ...demoConversations[0].metadata, preview: "Draft preview" },
    };
    const localized = localizeConversations([demoConversations[0], draft], "zh");

    expect(localized[0]).toMatchObject({
      id: "launch",
      title: "发布叙事",
      metadata: { preview: "正在打磨产品故事" },
    });
    expect(localized[1]).toEqual(draft);
  });

  it("matches API aliases and provides a localized fallback", () => {
    const doc = {
      eyebrow: "Interaction",
      description: "Description",
      summary: "Summary",
      useCases: [],
      props: ["value/defaultValue: Controls the current value."],
      interactions: [],
      integration: "Integration",
    };

    expect(getPropDescription(doc, "defaultValue", "en")).toBe(
      "Controls the current value.",
    );
    expect(getPropDescription(doc, "onChange", "zh")).toBe(
      "配置 onChange。类型、默认值与是否必填以本行定义为准。",
    );
  });

  it("defaults to English while respecting explicit language choices", () => {
    expect(resolveShowcaseLocale("", null)).toBe("en");
    expect(resolveShowcaseLocale("", "zh")).toBe("zh");
    expect(resolveShowcaseLocale("?lang=en", "zh")).toBe("en");
    expect(resolveShowcaseLocale("?lang=zh", "en")).toBe("zh");
  });
});
