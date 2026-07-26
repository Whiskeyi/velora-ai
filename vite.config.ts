import { defineConfig, lazyPlugins, type UserConfig } from "vite-plus";
import hostingConfig from "./.openai/hosting.json";
import { reactPackageAliases } from "./build/react-package-aliases";
import { sites } from "./build/sites-vite-plugin";

// Wrangler reads these paths while its Vite plugin module initializes.
process.env.WRANGLER_WRITE_LOGS ??= "false";
process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

const [{ default: vinext }, { cloudflare }] = await Promise.all([
  import("vinext"),
  import("@cloudflare/vite-plugin"),
]);

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID = "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(({ mode }) => {
  const config = {
    resolve: {
      alias: reactPackageAliases,
    },
    test: {
      environment: "node",
      include: [
        "packages/react/src/**/*.test.{ts,tsx}",
        "app/showcase/**/*.test.{ts,tsx}",
      ],
    },
    lint: {
      ignorePatterns: ["dist/**", ".next/**", "packages/react/dist/**"],
    },
    fmt: {
      semi: true,
      singleQuote: false,
    },
    check: {
      fmt: false,
      lint: true,
    },
    pack: {
      entry: [
        "packages/react/src/index.ts",
        "packages/react/src/components-entry.ts",
        "packages/react/src/runtime-entry.ts",
        "packages/react/src/transport-entry.ts",
        "packages/react/src/hooks-entry.ts",
        "packages/react/src/rich-content-entry.ts",
        "packages/react/src/code-block-entry.ts",
        "packages/react/src/formula-entry.ts",
        "packages/react/src/markdown-entry.ts",
        "packages/react/src/mermaid-entry.ts",
        "packages/react/src/velora.css",
      ],
      outDir: "packages/react/dist",
      dts: true,
      format: ["esm"],
      sourcemap: true,
      clean: true,
      copy: [
        {
          from: "node_modules/katex/dist/fonts/*.woff2",
          to: "packages/react/dist/fonts",
          flatten: true,
        },
      ],
      deps: {
        neverBundle: [
          "react",
          "react-dom",
          "react/jsx-runtime",
          "katex",
          "mermaid",
          "react-markdown",
          "rehype-katex",
          "remark-gfm",
          "remark-math",
          "zustand",
          "zustand/react",
          "zustand/vanilla",
        ],
      },
    },
    server: {
      port: 3000,
      strictPort: true,
      watch: isCodexSeatbeltSandbox ? { useFsEvents: false, usePolling: true } : undefined,
    },
    // The framework plugins stay out of Vite+ metadata commands and unit tests.
    plugins:
      mode === "test"
        ? []
        : lazyPlugins(() => [
            vinext(),
            {
              name: "velora:react-source-aliases",
              enforce: "post",
              // Vinext materializes tsconfig paths as prefix aliases during its config hook.
              config: () => ({ resolve: { alias: reactPackageAliases } }),
            },
            sites(),
            cloudflare({
              inspectorPort: false,
              viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
              config: localBindingConfig,
            }),
          ]),
  } satisfies UserConfig;

  return config;
});
