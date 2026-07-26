import { readFile } from "node:fs/promises";

const root = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const reactPackage = JSON.parse(
  await readFile(
    new URL("../packages/react/package.json", import.meta.url),
    "utf8",
  ),
);

if (root.version !== reactPackage.version) {
  throw new Error(
    `Version mismatch: root ${root.version} != @velora-ai/react ${reactPackage.version}`,
  );
}

const releaseTag = process.env.RELEASE_TAG;
if (releaseTag && releaseTag !== `v${reactPackage.version}`) {
  throw new Error(
    `Release tag ${releaseTag} must match package version v${reactPackage.version}`,
  );
}

console.log(`Verified release version ${reactPackage.version}.`);
