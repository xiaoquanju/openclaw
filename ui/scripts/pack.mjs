// oxlint-disable-next-line no-unused-vars
import { execSync } from "node:child_process";
/**
 * Manual Electron packaging — bypasses electron-builder entirely.
 * Copies the pre-built Electron binary and injects our app code.
 * Usage: node scripts/pack.mjs
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "release", "win-unpacked");

// Step 1: Find the Electron distribution directory
const require_ = createRequire(import.meta.url);
const electronPath = require_("electron");
// electronPath = ".../node_modules/electron/dist/electron.exe"
const electronDist = path.dirname(electronPath);

console.log("📦 Manual Electron packager");
console.log(`  Electron dist: ${electronDist}`);
console.log(`  Output:        ${outDir}`);
console.log();

// Step 2: Clean output
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// Step 3: Copy Electron runtime (skip symlinks to avoid Windows permission issues)
console.log("⏳ Copying Electron runtime...");
copyDirSync(electronDist, outDir);

// Step 4: Rename electron.exe → "OpenClaw Control.exe"
const srcExe = path.join(outDir, "electron.exe");
const dstExe = path.join(outDir, "OpenClaw Control.exe");
if (fs.existsSync(srcExe)) {
  fs.renameSync(srcExe, dstExe);
  console.log(`  ✅ Renamed electron.exe → OpenClaw Control.exe`);
}

// Step 5: Create app directory with our built code
const appDir = path.join(outDir, "resources", "app");
fs.mkdirSync(appDir, { recursive: true });

// Copy package.json (electron needs it to find the entry point)
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
// Minimal package.json for Electron
const electronPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: "dist/electron/main.mjs",
  type: "module",
};
fs.writeFileSync(path.join(appDir, "package.json"), JSON.stringify(electronPkg, null, 2));
console.log("  ✅ package.json written");

// Copy dist/electron (main process + preload)
copyDirSync(path.join(root, "dist", "electron"), path.join(appDir, "dist", "electron"));
console.log("  ✅ dist/electron/ copied");

// Copy dist/renderer or dist/control-ui (Vite output)
// Check which directory exists — Vite may output to different dirs based on config
const rendererCandidates = ["dist/renderer", "dist/control-ui"];
let rendererSrc = null;
for (const candidate of rendererCandidates) {
  const full = path.join(root, candidate);
  if (fs.existsSync(full)) {
    rendererSrc = full;
    break;
  }
}

if (rendererSrc) {
  // We need to figure out where the Electron main process expects the renderer files.
  // Read the main.mjs to find the path pattern
  const mainCode = fs.readFileSync(path.join(root, "dist", "electron", "main.mjs"), "utf8");

  // Copy to both possible locations to be safe
  const rendererDirName = path.basename(rendererSrc);
  copyDirSync(rendererSrc, path.join(appDir, "dist", rendererDirName));
  console.log(`  ✅ ${rendererDirName}/ copied`);

  // Also copy as dist/renderer if source was control-ui
  if (rendererDirName !== "renderer") {
    // Check if main.mjs references "renderer" or "control-ui"
    if (mainCode.includes("control-ui")) {
      console.log(`  ℹ️  main.mjs references "control-ui" — already correct`);
    } else if (mainCode.includes("renderer")) {
      copyDirSync(rendererSrc, path.join(appDir, "dist", "renderer"));
      console.log(`  ✅ Also copied as dist/renderer/`);
    }
  }
} else {
  console.warn("  ⚠️  No renderer output found in dist/");
}

// Copy public/ (static assets like favicons)
const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  copyDirSync(publicDir, path.join(appDir, "public"));
  console.log("  ✅ public/ copied");
}

// Copy node_modules runtime dependencies (only production deps)
// For a Lit-based app, most deps are bundled by Vite, so this may not be needed.
// We'll copy only if there are requires in the Electron main process code.
const mainCode = fs.readFileSync(path.join(root, "dist", "electron", "main.mjs"), "utf8");
const needsNodeModules = mainCode.includes("node_modules") || mainCode.includes("require(");
if (needsNodeModules) {
  console.log("  ⏳ Copying node_modules (main process has external requires)...");
  // Only copy specific required modules instead of all
  const requiredModules = ["electron-updater", "electron-log"].filter(
    (m) => mainCode.includes(m) && fs.existsSync(path.join(root, "node_modules", m)),
  );
  for (const mod of requiredModules) {
    copyDirSync(path.join(root, "node_modules", mod), path.join(appDir, "node_modules", mod));
    console.log(`    ✅ ${mod}`);
  }
}

console.log(`\n✅ Done! App packaged to: ${outDir}`);
console.log(`   Run it: "${dstExe}"`);

// --- Helper ---
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      // Skip symlinks on Windows to avoid permission issues
      continue;
    } else if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
