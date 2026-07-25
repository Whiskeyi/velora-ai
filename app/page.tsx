import type { Metadata } from "next";
import { ShowcaseClient } from "./showcase-client";

export const metadata: Metadata = {
  title: "Velora — Interfaces for intelligence in motion",
  description: "An open-source React component system for streaming, agentic AI interfaces.",
};

export default function Home() {
  return <ShowcaseClient />;
}
