import type { ComponentDoc, Locale } from "./model";

export function getPropDescription(
  doc: ComponentDoc,
  propName: string,
  locale: Locale,
): string {
  const normalizedName = propName.toLowerCase();
  const aliases = propName
    .split(/[/,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const match = doc.props.find((item) => {
    const [name] = item.split(":");
    const normalizedDocName = name?.trim().toLowerCase();
    if (!normalizedDocName) return false;
    if (normalizedDocName === normalizedName) return true;
    const docAliases = normalizedDocName
      .split(/[/,]/)
      .map((part) => part.trim())
      .filter(Boolean);
    return aliases.some(
      (alias) =>
        docAliases.includes(alias) ||
        normalizedDocName.includes(alias) ||
        normalizedName.includes(normalizedDocName),
    );
  });

  if (!match) {
    return locale === "zh"
      ? `配置 ${propName}。类型、默认值与是否必填以本行定义为准。`
      : `Configures ${propName}. The type, default, and required state are defined in this row.`;
  }

  const [, ...description] = match.split(":");
  return description.join(":").trim() || match;
}
