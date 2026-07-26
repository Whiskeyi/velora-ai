import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

import { COMPONENT_API_SPECS } from "../app/showcase/component-docs.ts";

const root = resolve(import.meta.dirname, "..");
const failures = [];

function documentedNames(name) {
  return name
    .split(/[,/]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

for (const [componentKey, spec] of Object.entries(COMPONENT_API_SPECS)) {
  const sourcePath = resolve(root, "packages/react/src/components", `${spec.importName}.tsx`);
  const sourceText = await readFile(sourcePath, "utf8");
  const source = ts.createSourceFile(
    sourcePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const interfaceName = `${spec.importName}Props`;
  const declaration = source.statements.find(
    (node) => ts.isInterfaceDeclaration(node) && node.name.text === interfaceName,
  );
  if (!declaration) {
    failures.push(`${componentKey}: ${interfaceName} was not found`);
    continue;
  }

  const publicProps = new Set(
    declaration.members.flatMap((member) => {
      if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) {
        return [];
      }
      const name = member.name;
      if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
        return [name.text];
      }
      return [];
    }),
  );

  for (const prop of spec.props) {
    for (const name of documentedNames(prop.name)) {
      if (!publicProps.has(name)) {
        failures.push(
          `${componentKey}: documented prop "${name}" is missing from ${interfaceName}`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Component API documentation drifted:\n${failures.join("\n")}`);
}

console.log(
  `Verified documented props against ${Object.keys(COMPONENT_API_SPECS).length} public component interfaces.`,
);
