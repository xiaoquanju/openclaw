/**
 * Build script for Electron app packaging.
 * Sets ELECTRON_BUILD=1 so Vite outputs to dist/renderer.
 *
 * Usage: node scripts/electron-build.mjs
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Set environment variables for the build
const env = {
  ...process.env,
  ELECTRON_BUILD: "1",
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${command} ${args.join(" ")}\n`);
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env,
      shell: true,
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

async function main() {
  try {
    // Step 1: Build renderer with Vite (ELECTRON_BUILD=1 ensures output to dist/renderer)
    await run("npx", ["vite", "build"]);

    // Step 2: Build Electron main + preload
    await run("node", ["scripts/build-electron.mjs"]);

    // Step 3: Run electron-builder
    await run("npx", ["electron-builder"]);

    console.log("\n✅ Build complete! Output in release/win-unpacked/\n");
  } catch (err) {
    console.error("\n❌ Build failed:", err.message);
    process.exit(1);
  }
}

main();
