import type { Metadata } from "next";
import "./globals.css";
import "@velora-ai/react/styles.css";

export const metadata: Metadata = {
  title: {
    default: "Velora AI — Interfaces that think beautifully",
    template: "%s · Velora AI",
  },
  description:
    "A streaming-first React component system for precise, expressive agentic interfaces.",
  keywords: [
    "AI UI",
    "React components",
    "agent interface",
    "streaming UI",
    "SSE",
    "Vite+",
  ],
  authors: [{ name: "Velora AI Contributors" }],
  openGraph: {
    type: "website",
    title: "Velora AI — Interfaces for intelligence in motion",
    description:
      "Streaming-first React primitives for precise, expressive agentic interfaces.",
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
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
