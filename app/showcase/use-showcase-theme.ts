"use client";

import { useCallback, useEffect, useState } from "react";
import type { ShowcaseTheme } from "./model";

const SHOWCASE_THEME_PREFERENCE_KEY = "velora-theme-preference";

export function resolveShowcaseTheme(
  search: string,
  savedTheme: string | null,
  prefersDark: boolean,
): ShowcaseTheme {
  const requested = new URLSearchParams(search).get("theme");
  if (requested === "light" || requested === "dark") return requested;
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return prefersDark ? "dark" : "light";
}

function getInitialTheme(): ShowcaseTheme {
  let savedTheme: string | null = null;
  try {
    savedTheme = window.localStorage.getItem(SHOWCASE_THEME_PREFERENCE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted embeds.
  }

  return resolveShowcaseTheme(
    window.location.search,
    savedTheme,
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
}

export function useShowcaseTheme() {
  const [theme, setThemeState] = useState<ShowcaseTheme>("dark");
  const setTheme = useCallback((nextTheme: ShowcaseTheme) => {
    try {
      window.localStorage.setItem(SHOWCASE_THEME_PREFERENCE_KEY, nextTheme);
    } catch {
      // The in-memory preference still applies for the current document.
    }
    setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    setThemeState(getInitialTheme());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.showcaseTheme = theme;
    document.documentElement.style.colorScheme = theme;

    let themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      document.head.append(themeColor);
    }
    themeColor.content = theme === "light" ? "#eef2f8" : "#05070b";
  }, [theme]);

  return { theme, setTheme };
}
