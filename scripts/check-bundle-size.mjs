import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const outputDirectory = resolve(import.meta.dirname, "..", "dist-pages");
const html = await readFile(resolve(outputDirectory, "index.html"), "utf8");
const entryPath = html.match(/<script[^>]+src="\.\/([^"]+\.js)"/)?.[1];
const stylesheetPath = html.match(/<link[^>]+href="\.\/([^"]+\.css)"/)?.[1];
const preloadPaths = [
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\.\/([^"]+\.js)"/g),
].map((match) => match[1]);

if (!entryPath || !stylesheetPath) {
  throw new Error("Unable to resolve the Pages entry assets from dist-pages/index.html.");
}

const budgets = {
  entryRaw: 300 * 1024,
  entryGzip: 90 * 1024,
  initialJavaScriptRaw: 900 * 1024,
  initialJavaScriptGzip: 275 * 1024,
  stylesheetRaw: 135 * 1024,
  stylesheetGzip: 30 * 1024,
};

async function measure(relativePath) {
  const absolutePath = resolve(outputDirectory, relativePath);
  const [metadata, contents] = await Promise.all([stat(absolutePath), readFile(absolutePath)]);
  return { raw: metadata.size, gzip: gzipSync(contents).byteLength };
}

const [entry, stylesheet] = await Promise.all([
  measure(entryPath),
  measure(stylesheetPath),
]);
const preloadAssets = await Promise.all(preloadPaths.map(measure));
const initialJavaScript = preloadAssets.reduce(
  (total, asset) => ({ raw: total.raw + asset.raw, gzip: total.gzip + asset.gzip }),
  { ...entry },
);

const failures = [
  ["entry raw", entry.raw, budgets.entryRaw],
  ["entry gzip", entry.gzip, budgets.entryGzip],
  ["initial JavaScript raw", initialJavaScript.raw, budgets.initialJavaScriptRaw],
  ["initial JavaScript gzip", initialJavaScript.gzip, budgets.initialJavaScriptGzip],
  ["stylesheet raw", stylesheet.raw, budgets.stylesheetRaw],
  ["stylesheet gzip", stylesheet.gzip, budgets.stylesheetGzip],
].filter(([, actual, budget]) => actual > budget);

const kilobytes = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
console.log(
  `Pages budget: entry ${kilobytes(entry.raw)} raw / ${kilobytes(entry.gzip)} gzip; ` +
    `initial JS ${kilobytes(initialJavaScript.raw)} raw / ${kilobytes(initialJavaScript.gzip)} gzip; ` +
    `CSS ${kilobytes(stylesheet.raw)} raw / ${kilobytes(stylesheet.gzip)} gzip.`,
);

if (failures.length > 0) {
  throw new Error(
    failures
      .map(([label, actual, budget]) => `${label}: ${kilobytes(actual)} > ${kilobytes(budget)}`)
      .join("\n"),
  );
}
