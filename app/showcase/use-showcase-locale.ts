"use client";

import { useEffect, useState } from "react";
import type { Locale } from "./model";

function getInitialLocale(): Locale {
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (requested === "en" || requested === "zh") return requested;
  const saved = window.localStorage.getItem("velora-locale");
  if (saved === "en" || saved === "zh") return saved;
  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function useShowcaseLocale() {
  const [locale, setLocale] = useState<Locale>("en");
  const [localeReady, setLocaleReady] = useState(false);

  useEffect(() => {
    setLocale(getInitialLocale());
    setLocaleReady(true);
  }, []);

  useEffect(() => {
    if (!localeReady) return;
    window.localStorage.setItem("velora-locale", locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    const url = new URL(window.location.href);
    url.searchParams.set("lang", locale);
    window.history.replaceState(window.history.state, "", url);
  }, [locale, localeReady]);

  return { locale, setLocale };
}
