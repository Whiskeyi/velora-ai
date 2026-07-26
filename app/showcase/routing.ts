import type { SampleKey } from "../component-registry";

function getSiteBasePath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname === "/velora-ai" ||
    window.location.pathname.startsWith("/velora-ai/")
    ? "/velora-ai"
    : "";
}

export function getHomeHref(fragment = ""): string {
  return `${getSiteBasePath()}/${fragment}`;
}

export function getComponentHref(key: SampleKey): string {
  return `${getSiteBasePath()}/components/${key}/`;
}
