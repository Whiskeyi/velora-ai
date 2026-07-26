import { readFile, writeFile } from "node:fs/promises";

const stylesheet = new URL(
  "../packages/react/dist/style.css",
  import.meta.url,
);
const source = await readFile(stylesheet, "utf8");
const optimized = source.replaceAll(
  /, url\("fonts\/[^"]+\.woff"\) format\("woff"\), url\("fonts\/[^"]+\.ttf"\) format\("truetype"\)/g,
  "",
);

if (optimized === source) {
  throw new Error("KaTeX font fallbacks were not found in the package stylesheet.");
}

await writeFile(stylesheet, optimized);
console.log("Optimized package fonts for modern WOFF2-capable browsers.");
