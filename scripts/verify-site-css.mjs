import { readdir, readFile } from "node:fs/promises";

const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
const entries = await readdir(assetsDirectory, { withFileTypes: true });
const cssFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".css"));

if (cssFiles.length === 0) {
  throw new Error("Production build emitted no client CSS assets");
}

const styles = await Promise.all(
  cssFiles.map((entry) => readFile(new URL(entry.name, assetsDirectory), "utf8")),
);
const productionCss = styles.join("\n");
const requiredSelectors = [
  ".vl-provider",
  ".vl-prompt-composer",
  ".vl-message-actions",
  ".vl-message-branch-navigator",
  ".vl-tool-call-card",
  ".theme-toggle",
  "[data-showcase-theme=light]",
  ".live-preview-shell[data-theme=light]",
];
const missingSelectors = requiredSelectors.filter((selector) => !productionCss.includes(selector));

if (missingSelectors.length > 0) {
  throw new Error(
    `Production client CSS is missing required selectors: ${missingSelectors.join(", ")}`,
  );
}

console.log(
  `Verified production client CSS contains ${requiredSelectors.join(", ")} across ${cssFiles.length} asset(s).`,
);
