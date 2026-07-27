import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const outputDirectory = resolve(import.meta.dirname, "..", "dist-pages");
const html = await readFile(resolve(outputDirectory, "index.html"), "utf8");
const requiredThemeMarkup = [
  'data-showcase-theme="dark"',
  "velora-theme-preference",
  "prefers-color-scheme: dark",
  'meta[name="theme-color"]',
];
const missingThemeMarkup = requiredThemeMarkup.filter((value) => !html.includes(value));
if (missingThemeMarkup.length > 0) {
  throw new Error(
    `Pages HTML is missing pre-paint theme initialization: ${missingThemeMarkup.join(", ")}`,
  );
}
const manifest = JSON.parse(
  await readFile(resolve(outputDirectory, ".vite", "manifest.json"), "utf8"),
);
const entryPath = html.match(/<script[^>]+src="\.\/([^"]+\.js)"/)?.[1];
const stylesheetPath = html.match(/<link[^>]+href="\.\/([^"]+\.css)"/)?.[1];
if (!entryPath || !stylesheetPath) {
  throw new Error("Unable to resolve the Pages entry assets from dist-pages/index.html.");
}

const manifestEntries = Object.values(manifest);
const entryRecord = manifestEntries.find((record) => record.isEntry && record.file === entryPath);
if (!entryRecord) {
  throw new Error("Unable to resolve the Pages entry in the Vite manifest.");
}

const bySource = new Map(Object.entries(manifest).map(([source, record]) => [source, record]));
const initialSources = new Set();
const visitStaticImports = (source) => {
  if (initialSources.has(source)) return;
  initialSources.add(source);
  const record = bySource.get(source);
  for (const dependency of record?.imports ?? []) visitStaticImports(dependency);
};

// The entry invokes its top-level dynamic bootstraps immediately. Their nested
// dynamic imports (for example the live editor and Mermaid renderers) remain lazy.
for (const source of entryRecord.imports ?? []) visitStaticImports(source);
for (const source of entryRecord.dynamicImports ?? []) visitStaticImports(source);
const initialPaths = [...initialSources]
  .map((source) => bySource.get(source)?.file)
  .filter((file) => typeof file === "string" && file !== entryPath);

const budgets = {
  entryRaw: 300 * 1024,
  entryGzip: 90 * 1024,
  initialJavaScriptRaw: 900 * 1024,
  initialJavaScriptGzip: 275 * 1024,
  stylesheetRaw: 135 * 1024,
  stylesheetGzip: 30 * 1024,
  largestLazyJavaScriptRaw: 700 * 1024,
};

async function measure(relativePath) {
  const absolutePath = resolve(outputDirectory, relativePath);
  const [metadata, contents] = await Promise.all([stat(absolutePath), readFile(absolutePath)]);
  return { raw: metadata.size, gzip: gzipSync(contents).byteLength };
}

const [entry, stylesheet] = await Promise.all([measure(entryPath), measure(stylesheetPath)]);
const initialAssets = await Promise.all(initialPaths.map(measure));
const initialJavaScript = initialAssets.reduce(
  (total, asset) => ({ raw: total.raw + asset.raw, gzip: total.gzip + asset.gzip }),
  { ...entry },
);
const initialPathSet = new Set([entryPath, ...initialPaths]);
const lazyJavaScriptPaths = [
  ...new Set(
    manifestEntries
      .map((record) => record.file)
      .filter(
        (file) => typeof file === "string" && file.endsWith(".js") && !initialPathSet.has(file),
      ),
  ),
];
const lazyJavaScriptAssets = await Promise.all(
  lazyJavaScriptPaths.map(async (path) => ({ path, ...(await measure(path)) })),
);
const largestLazyJavaScript = lazyJavaScriptAssets.reduce(
  (largest, asset) => (asset.raw > largest.raw ? asset : largest),
  { path: "none", raw: 0, gzip: 0 },
);

const failures = [
  ["entry raw", entry.raw, budgets.entryRaw],
  ["entry gzip", entry.gzip, budgets.entryGzip],
  ["initial JavaScript raw", initialJavaScript.raw, budgets.initialJavaScriptRaw],
  ["initial JavaScript gzip", initialJavaScript.gzip, budgets.initialJavaScriptGzip],
  ["stylesheet raw", stylesheet.raw, budgets.stylesheetRaw],
  ["stylesheet gzip", stylesheet.gzip, budgets.stylesheetGzip],
  [
    `largest lazy JavaScript (${largestLazyJavaScript.path})`,
    largestLazyJavaScript.raw,
    budgets.largestLazyJavaScriptRaw,
  ],
].filter(([, actual, budget]) => actual > budget);

const kilobytes = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
console.log(
  `Pages budget: entry ${kilobytes(entry.raw)} raw / ${kilobytes(entry.gzip)} gzip; ` +
    `initial JS ${kilobytes(initialJavaScript.raw)} raw / ${kilobytes(initialJavaScript.gzip)} gzip; ` +
    `CSS ${kilobytes(stylesheet.raw)} raw / ${kilobytes(stylesheet.gzip)} gzip; ` +
    `largest lazy JS ${kilobytes(largestLazyJavaScript.raw)} raw (${largestLazyJavaScript.path}).`,
);

if (failures.length > 0) {
  throw new Error(
    failures
      .map(([label, actual, budget]) => `${label}: ${kilobytes(actual)} > ${kilobytes(budget)}`)
      .join("\n"),
  );
}
