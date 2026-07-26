import type { Metadata } from "next";
import "./globals.css";
import "@velora-ai/react/styles.css";
import "@velora-ai/react/rich-content.css";

const themeInitializationScript = `
  (() => {
    const requested = new URLSearchParams(window.location.search).get("theme");
    let saved = null;
    try {
      saved = window.localStorage.getItem("velora-theme-preference");
    } catch {}
    const theme =
      requested === "light" || requested === "dark"
        ? requested
        : saved === "light" || saved === "dark"
          ? saved
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    document.documentElement.dataset.showcaseTheme = theme;
    document.documentElement.style.colorScheme = theme;
  })();
`;

export const metadata: Metadata = {
  title: {
    default: "Velora AI — Interfaces that think beautifully",
    template: "%s · Velora AI",
  },
  description:
    "A streaming-first React component system for precise, expressive agentic interfaces.",
  keywords: ["AI UI", "React components", "agent interface", "streaming UI", "SSE", "Vite+"],
  authors: [{ name: "Velora AI Contributors" }],
  openGraph: {
    type: "website",
    title: "Velora AI — Interfaces for intelligence in motion",
    description: "Streaming-first React primitives for precise, expressive agentic interfaces.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Velora AI liquid-glass streaming interface",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Velora AI — Interfaces for intelligence in motion",
    description: "Streaming-first React primitives for agentic interfaces.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-showcase-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
