import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    // For GitHub Pages, this is typically "/<repo-name>/".
    // The workflow sets VITE_BASE automatically.
    base: process.env.VITE_BASE ?? "/",
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8787",
          changeOrigin: true,
        },
      },
    },
  };
});
