import { contextBridge, ipcRenderer } from "electron";

/**
 * Expose a minimal, safe API to the renderer process.
 *
 * Usage in renderer:
 *   window.electronAPI.openExternal("https://example.com")
 *   window.electronAPI.getSystemTheme()
 *   window.electronAPI.isElectron  // true
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /** Whether the app is running inside Electron */
  isElectron: true,

  /** Open a URL in the system default browser */
  openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),

  /** Get the current system theme ("dark" | "light") */
  getSystemTheme: () => ipcRenderer.invoke("app:getSystemTheme"),

  /** Get platform info */
  platform: process.platform,
});
