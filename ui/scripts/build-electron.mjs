/**
 * Build Electron main process + preload with esbuild.
 * Outputs ESM bundles to dist/electron/.
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  // Don't bundle Electron — it's provided at runtime
  external: ["electron"],
};

await Promise.all([
  build({
    ...shared,
    entryPoints: [path.join(root, "electron/main.ts")],
    outfile: path.join(root, "dist/electron/main.mjs"),
  }),
  // Preload must be CJS — Electron's sandbox does not support ESM preload scripts
  build({
    ...shared,
    format: "cjs",
    entryPoints: [path.join(root, "electron/preload.ts")],
    outfile: path.join(root, "dist/electron/preload.cjs"),
  }),
]);

console.log("✅ Electron main + preload built → dist/electron/");
