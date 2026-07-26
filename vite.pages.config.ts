import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { reactPackageAliases } from "./build/react-package-aliases";

const fromProjectRoot = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: fromProjectRoot("./pages"),
  base: "./",
  publicDir: fromProjectRoot("./public"),
  resolve: {
    alias: reactPackageAliases,
  },
  plugins: [react()],
  build: {
    target: "es2022",
    manifest: true,
    outDir: fromProjectRoot("./dist-pages"),
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-core",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: "rich-content",
              test:
                /node_modules[\\/](katex|react-markdown|remark-|rehype-|unified|micromark|mdast|hast)/,
              priority: 20,
            },
            {
              name: "workbench",
              test: /node_modules[\\/](react-live|prism-react-renderer)[\\/]/,
              priority: 20,
            },
            {
              name: "ui-runtime",
              test: /node_modules[\\/](lucide-react|zustand)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
