"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "./model";

const SHOWCASE_LOCALE_PREFERENCE_KEY = "velora-locale-preference";

export function resolveShowcaseLocale(search: string, savedLocale: string | null): Locale {
  const requested = new URLSearchParams(search).get("lang");
  if (requested === "en" || requested === "zh") return requested;
  if (savedLocale === "en" || savedLocale === "zh") return savedLocale;
  return "en";
}

function getInitialLocale(): Locale {
  return resolveShowcaseLocale(
    window.location.search,
    window.localStorage.getItem(SHOWCASE_LOCALE_PREFERENCE_KEY),
  );
}

export function useShowcaseLocale() {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [localeReady, setLocaleReady] = useState(false);
  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(SHOWCASE_LOCALE_PREFERENCE_KEY, nextLocale);
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    setLocaleState(getInitialLocale());
    setLocaleReady(true);
  }, []);

  useEffect(() => {
    if (!localeReady) return;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    const url = new URL(window.location.href);
    url.searchParams.set("lang", locale);
    window.history.replaceState(window.history.state, "", url);
  }, [locale, localeReady]);

  return { locale, setLocale };
}
