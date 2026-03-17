/**
 * Development script: build electron code, start Vite dev server, then launch Electron.
 *
 * Usage: node scripts/electron-dev.mjs
 */
import { build } from "esbuild";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const VITE_PORT = 5173;
const VITE_URL = `http://localhost:${VITE_PORT}`;

// Step 1: Build electron main + preload
const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
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
console.log("✅ Electron code built");

// Step 2: Start Vite dev server
// Run Vite CLI via Node.js directly to avoid Windows .cmd spawn issues (EINVAL)
// and the DEP0190 deprecation warning for shell:true with args.
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
const vite = spawn(process.execPath, [viteCli, "--port", String(VITE_PORT)], {
  cwd: root,
  stdio: "pipe",
});

// Wait for Vite to be ready
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Vite dev server timed out")), 30_000);

  vite.stdout.on("data", (data) => {
    const text = data.toString();
    process.stdout.write(text);
    if (text.includes("Local:") || text.includes("ready in")) {
      clearTimeout(timeout);
      resolve(undefined);
    }
  });
  vite.stderr.on("data", (data) => process.stderr.write(data));
  vite.on("error", (err) => {
    clearTimeout(timeout);
    reject(err);
  });
});

console.log("✅ Vite dev server ready");

// Step 3: Launch Electron
// electron package is CJS and exports the path to the Electron binary
const require = createRequire(import.meta.url);
const electronExePath = require("electron");
const electron = spawn(
  electronExePath,
  [path.join(root, "dist/electron/main.mjs")],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
      VITE_DEV_SERVER_URL: VITE_URL,
    },
  },
);

electron.on("close", (code) => {
  vite.kill();
  process.exit(code ?? 0);
});

// Clean up on ctrl+c
process.on("SIGINT", () => {
  electron.kill();
  vite.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  electron.kill();
  vite.kill();
  process.exit(0);
});
