import vinext from "vinext";
import { nitro } from "nitro/vite";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const isVercel = process.env.VERCEL === "1";

// vinext currently emits stylesheet links without Vite's `?direct` query in
// development. Vite otherwise serves those requests as JS modules, leaving the
// page unstyled. Rewrite only real stylesheet requests; production builds are
// unaffected because this plugin applies to the dev server only.
function directStylesheetsInDevelopment(): Plugin {
  return {
    name: "halovia:direct-dev-stylesheets",
    apply: "serve",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const acceptsCss = request.headers.accept?.includes("text/css");
        if (acceptsCss && request.url && /\.css(?:$|\?)/.test(request.url) && !request.url.includes("direct")) {
          request.url += request.url.includes("?") ? "&direct" : "?direct";
        }
        next();
      });
    },
  };
}

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

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  if (isVercel) {
    return {
      resolve: {
        alias: [
          {
            find: /^tailwindcss$/,
            replacement: resolve("node_modules/tailwindcss/index.css"),
          },
        ],
      },
      server: isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : undefined,
      plugins: [
        directStylesheetsInDevelopment(),
        vinext(),
        // Nitro detects Vercel automatically and writes the deployment
        // output to `.output`. Keep this minimal to avoid unsupported or
        // version-specific configuration.
        nitro(),
      ],
    };
  }

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      directStylesheetsInDevelopment(),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
