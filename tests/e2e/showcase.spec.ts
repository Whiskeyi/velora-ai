import { expect, test } from "@playwright/test";

test("the site theme follows the system, switches, and persists", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const root = page.locator("html");
  const provider = page.locator(".showcase-provider").first();
  await expect(root).toHaveAttribute("data-showcase-theme", "dark");
  await expect(provider).toHaveAttribute("data-vl-theme", "dark");

  const darkComposerLuminance = await page
    .locator(".vl-prompt-composer__surface")
    .first()
    .evaluate((element) => {
      const value = getComputedStyle(element).backgroundColor;
      const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const normalized = value.startsWith("color(srgb")
        ? channels.map((channel) => channel * 255)
        : channels;
      return (
        normalized[0]! * 0.2126 + normalized[1]! * 0.7152 + normalized[2]! * 0.0722
      );
    });
  expect(darkComposerLuminance).toBeLessThan(32);

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(root).toHaveAttribute("data-showcase-theme", "light");
  await expect(provider).toHaveAttribute("data-vl-theme", "light");
  await expect(page.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();

  const lightSurfaceColors = await page
    .locator(".runtime-code, .pipeline-spine span")
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).backgroundColor),
    );
  expect(lightSurfaceColors.every((color) => color.includes("255") || color.includes("247"))).toBe(
    true,
  );
  await expect(page.locator(".access-visual kbd").first()).toHaveCSS(
    "background-image",
    /rgb\(228, 233, 242\).*rgb\(255, 255, 255\)/,
  );
  await expect(page.locator(".footer-actions .primary-button")).toHaveCSS(
    "color",
    "rgb(16, 20, 31)",
  );

  await page.reload();
  await expect(root).toHaveAttribute("data-showcase-theme", "light");
  await expect(provider).toHaveAttribute("data-vl-theme", "light");

  await page.goto("/components/mermaid-diagram/");
  await expect(root).toHaveAttribute("data-showcase-theme", "light");
  await expect(provider).toHaveAttribute("data-vl-theme", "light");
  await expect(page.locator(".vl-mermaid__canvas svg")).toBeVisible();
  await expect(page.locator(".live-editor pre")).toHaveCSS("color", "rgb(52, 64, 84)");
  await expect(page.locator(".code-pane")).toHaveCSS(
    "background-color",
    "rgba(247, 249, 253, 0.72)",
  );
});

test("the hero sends a mock SSE run and switches locale", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/");

  const agent = page.locator(".agent-window");
  const composer = agent.getByRole("textbox");
  await composer.fill("Verify the streaming interaction");
  await agent.getByRole("button", { name: "Send message" }).click();

  await expect(agent.getByText("Verify the streaming interaction", { exact: true })).toBeVisible();
  await expect(agent.getByText("Response complete", { exact: true })).toBeVisible();

  const layout = await agent.evaluate((element) => {
    const windowElement = element as HTMLElement;
    const main = element.querySelector<HTMLElement>(".agent-main");
    const header = element.querySelector<HTMLElement>(".agent-header");
    const feed = element.querySelector<HTMLElement>(".agent-feed");
    const list = element.querySelector<HTMLElement>(".agent-feed .vl-message-list");

    return {
      windowHeight: windowElement.clientHeight,
      mainHeight: main?.offsetHeight,
      headerHeight: header?.offsetHeight,
      feedTop: feed?.offsetTop,
      feedHeight: feed?.clientHeight,
      listHeight: list?.clientHeight,
    };
  });
  expect(layout.mainHeight).toBeLessThanOrEqual(layout.windowHeight);
  expect(layout.feedTop).toBeGreaterThanOrEqual(layout.headerHeight!);
  expect(layout.listHeight).toBeLessThanOrEqual(layout.feedHeight!);

  await page.getByRole("button", { name: "Switch language: 中文" }).click();
  await expect(agent.getByRole("button", { name: "发送消息" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
});

test("component details edit, render, and reset independently", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/components/prompt-composer/");

  await expect(page.getByRole("heading", { level: 1, name: "PromptComposer" })).toBeVisible();
  const editor = page.getByRole("textbox", {
    name: "Editable TypeScript component example",
  });
  await editor.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await editor.type('render(<div data-testid="edited-preview">Edited preview works</div>);');

  await expect(page.getByTestId("edited-preview")).toBeVisible();
  const reset = page.getByRole("button", { name: "Reset example code" });
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(page.getByPlaceholder("Ask Velora anything…")).toBeVisible();

  const previewAlignment = await page.locator(".live-preview").evaluate((element) => {
    const style = getComputedStyle(element);
    return { alignItems: style.alignItems, justifyContent: style.justifyContent };
  });
  expect(previewAlignment).toEqual({
    alignItems: "flex-start",
    justifyContent: "flex-start",
  });
});

test("mobile component docs avoid page overflow and expose compact navigation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/components/mermaid-diagram/");

  await expect(page.getByRole("heading", { level: 1, name: "MermaidDiagram" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Preview" })).toBeVisible();
  await expect(page.locator(".vl-mermaid__canvas svg")).toBeVisible();
  await expect(page.locator(".vl-mermaid")).toHaveAttribute("data-align", "start");
  const canvasAlignment = await page
    .locator(".vl-mermaid__canvas")
    .evaluate((element) => getComputedStyle(element).justifyItems);
  expect(canvasAlignment).toBe("start");

  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
});

test("the component reference keeps its core contract across desktop engines", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium");
  await page.goto("/components/message-list/");

  await expect(page.getByRole("heading", { level: 1, name: "MessageList" })).toBeVisible();
  await expect(page.getByRole("region", { name: "MessageList API" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Theme" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Direction" })).toBeVisible();

  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
});
