import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const outputPath = process.argv[2];

if (!outputPath) {
  throw new Error("Usage: node scripts/optimize-site-fonts.mjs <build-output>");
}

const outputDirectory = pathToFileURL(`${resolve(outputPath)}/`);
const legacyFontFallbacks =
  /,url\([^)]*\.woff\)\s*format\("woff"\),url\([^)]*\.ttf\)\s*format\("truetype"\)/g;
const cssFiles = [];
const legacyFontFiles = [];
let replacements = 0;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const entryUrl = new URL(entry.name, directory);

      if (entry.isDirectory()) {
        await collectFiles(new URL(`${entry.name}/`, directory));
      } else if (entry.name.endsWith(".css")) {
        cssFiles.push(entryUrl);
      } else if (/\.(?:woff|ttf)$/.test(entry.name)) {
        legacyFontFiles.push(entryUrl);
      }
    }),
  );
}

await collectFiles(outputDirectory);

for (const stylesheetUrl of cssFiles) {
  const source = await readFile(stylesheetUrl, "utf8");
  const optimized = source.replaceAll(legacyFontFallbacks, () => {
    replacements += 1;
    return "";
  });

  if (optimized !== source) {
    await writeFile(stylesheetUrl, optimized);
  }
}

await Promise.all(legacyFontFiles.map((fontUrl) => unlink(fontUrl)));

if (legacyFontFiles.length > 0 && replacements === 0) {
  throw new Error("Legacy font assets were emitted without removable CSS fallbacks.");
}

console.log(
  `Kept WOFF2 font sources and removed ${legacyFontFiles.length} legacy font asset(s).`,
);
