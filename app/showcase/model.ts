import type { SampleKey } from "../component-registry";

export type Locale = "en" | "zh";

export type ShowcaseTheme = "light" | "dark";

export type Localized<T> = Record<Locale, T>;

export type ViewportKey = "desktop" | "tablet" | "mobile";

export type Sample = {
  key: SampleKey;
  name: string;
  eyebrow: string;
  description: string;
  code: string;
};

export type SampleMeta = Omit<Sample, "code" | "eyebrow" | "description">;

export type ComponentDoc = {
  eyebrow: string;
  description: string;
  summary: string;
  useCases: readonly string[];
  props: readonly string[];
  interactions: readonly string[];
  integration: string;
};

export type ComponentApiProp = {
  name: string;
  type: string;
  defaultValue: string;
  required?: boolean;
  description?: Localized<string>;
};

export type ComponentApiSpec = {
  importName: string;
  props: readonly ComponentApiProp[];
};

export type ComponentApiGroup = {
  id: string;
  title: Localized<string>;
  description: Localized<string>;
  keys: readonly SampleKey[];
};
