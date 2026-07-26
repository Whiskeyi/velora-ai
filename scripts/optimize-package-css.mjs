import { readFile, writeFile } from "node:fs/promises";

const sourceStylesheet = new URL("../node_modules/katex/dist/katex.min.css", import.meta.url);
const outputStylesheet = new URL("../packages/react/dist/rich-content.css", import.meta.url);
const source = await readFile(sourceStylesheet, "utf8");
const optimized = source.replaceAll(
  /,?url\(["']?fonts\/[^)"']+\.woff["']?\) format\("woff"\),url\(["']?fonts\/[^)"']+\.ttf["']?\) format\("truetype"\)/g,
  "",
);

if (optimized === source) {
  throw new Error("KaTeX font fallbacks were not found in the package stylesheet.");
}

await writeFile(outputStylesheet, optimized);
console.log("Created optional rich-content styles with modern WOFF2 fonts.");
