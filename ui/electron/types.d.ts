/** Type declarations for the Electron preload bridge exposed via contextBridge. */

interface ElectronAPI {
  /** Whether the app is running inside Electron */
  isElectron: boolean;
  /** Open a URL in the system default browser */
  openExternal: (url: string) => Promise<void>;
  /** Get the current system theme ("dark" | "light") */
  getSystemTheme: () => Promise<"dark" | "light">;
  /** Current platform */
  platform: NodeJS.Platform;
}

interface Window {
  electronAPI?: ElectronAPI;
}
