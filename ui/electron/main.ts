import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, shell, ipcMain, nativeTheme, session } from "electron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve paths based on dev vs production
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";

// Path to preload script (built output)
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");

// Path to renderer build output (Vite produces index.html here)
// In production, main.mjs is at dist/electron/, renderer is at dist/renderer/
// So relative path from dist/electron/ to dist/renderer/ is ../renderer
const RENDERER_DIST = path.join(__dirname, "../renderer");

let mainWindow: BrowserWindow | null = null;

/**
 * Convert WebSocket URL to HTTP Origin
 * ws:// -> http://, wss:// -> https://
 */
function wsUrlToOrigin(wsUrl: string): string {
  try {
    const url = new URL(wsUrl);
    const httpProtocol = url.protocol === "wss:" ? "https:" : "http:";
    return `${httpProtocol}//${url.host}`;
  } catch {
    // Fallback to localhost if URL parsing fails
    return "http://localhost:18789";
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: "OpenClaw Control",
    icon: path.join(__dirname, "../public/favicon.ico"),
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    // Use frameless title bar with native traffic lights on macOS
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a1a2e" : "#ffffff",
  });

  // Open external links in system browser instead of Electron window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  // Prevent navigation away from the app
  mainWindow.webContents.on("will-navigate", (event, url) => {
    // Allow in-app navigation (same origin or dev server)
    if (isDev && url.startsWith(VITE_DEV_SERVER_URL)) {
      return;
    }
    if (!isDev && url.startsWith("file://")) {
      return;
    }
    event.preventDefault();
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
    }
  });

  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC handlers
ipcMain.handle("shell:openExternal", (_event, url: string) => {
  if (typeof url === "string" && (url.startsWith("http:") || url.startsWith("https:"))) {
    return shell.openExternal(url);
  }
});

ipcMain.handle("app:getSystemTheme", () => {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
});

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Intercept WebSocket requests and set proper Origin header
    // Browser WebSocket uses page origin, but gateway expects origin matching the ws URL
    // Convert ws:// to http:// origin so gateway accepts the connection
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ["ws://*/*", "wss://*/*"] },
      (details, callback) => {
        // Always set Origin based on WebSocket URL
        // This ensures gateway origin check passes regardless of page origin
        const newOrigin = wsUrlToOrigin(details.url);
        details.requestHeaders["Origin"] = newOrigin;
        callback({ requestHeaders: details.requestHeaders });
      },
    );

    createWindow();

    // macOS: re-create window when dock icon is clicked
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

// Quit when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
