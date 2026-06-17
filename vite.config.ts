import { defineConfig } from "vite";

// The Tauri desktop build loads assets from the local filesystem, so it needs a
// root-relative base ("/"). A GitHub Pages *project* site is served from a
// subpath ("/number-go-up/"), so the web build sets GITHUB_PAGES=true to switch
// the base. Keep these in sync with the repo name if it ever changes.
const isGithubPages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: isGithubPages ? "/number-go-up/" : "/",
  // Tauri expects a fixed dev port and doesn't want Vite clearing the screen.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
