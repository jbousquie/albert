import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    watch: {
      ignored: [
        "**/target/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
      ],
    },
  },
  build: {
    outDir: "dist",
  },
});
