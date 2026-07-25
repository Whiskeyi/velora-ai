import { expect, test } from "@playwright/test";

test("the hero sends a mock SSE run and switches locale", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium");
  await page.goto("/");

  const agent = page.locator(".agent-window");
  const composer = agent.getByRole("textbox");
  await composer.fill("Verify the streaming interaction");
  await agent.getByRole("button", { name: "Send message" }).click();

  await expect(agent.getByText("Verify the streaming interaction", { exact: true })).toBeVisible();
  await expect(agent.getByText("Response complete", { exact: true })).toBeVisible();

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
});

test("mobile component docs avoid page overflow and expose compact navigation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium");
  await page.goto("/components/mermaid-diagram/");

  await expect(page.getByRole("heading", { level: 1, name: "MermaidDiagram" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Preview" })).toBeVisible();
  await expect(page.locator(".vl-mermaid__canvas svg")).toBeVisible();

  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
});
