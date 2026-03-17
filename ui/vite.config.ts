import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const isElectronBuild = process.env.ELECTRON_BUILD === "1";

function normalizeBase(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "/";
  }
  if (trimmed === "./") {
    return "./";
  }
  if (trimmed.endsWith("/")) {
    return trimmed;
  }
  return `${trimmed}/`;
}

export default defineConfig(() => {
  const envBase = process.env.OPENCLAW_CONTROL_UI_BASE_PATH?.trim();
  // Electron loads from file://, must use relative paths
  const base = isElectronBuild ? "./" : envBase ? normalizeBase(envBase) : "./";
  // Electron renderer output goes to dist/renderer; original web build goes to ../dist/control-ui
  const outDir = isElectronBuild
    ? path.resolve(here, "dist/renderer")
    : path.resolve(here, "../dist/control-ui");

  return {
    base,
    publicDir: path.resolve(here, "public"),
    define: {
      // `local-storage.ts` references `process.env.VITEST` which doesn't exist in the browser.
      // Replace it at build time so it won't throw a ReferenceError.
      "process.env.VITEST": "undefined",
    },
    optimizeDeps: {
      include: ["lit/directives/repeat.js"],
    },
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: true,
      // Keep CI/onboard logs clean; current control UI chunking is intentionally above 500 kB.
      chunkSizeWarningLimit: 1024,
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },
    plugins: [
      {
        name: "control-ui-dev-stubs",
        configureServer(server) {
          server.middlewares.use("/__openclaw/control-ui-config.json", (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                basePath: "/",
                assistantName: "",
                assistantAvatar: "",
                assistantAgentId: "",
              }),
            );
          });
        },
      },
    ],
  };
});
