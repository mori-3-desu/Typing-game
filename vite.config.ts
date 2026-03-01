import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
  esbuild: {
    // TS先生に「ここはエラーが出るって知ってるから大丈夫だよ」と伝えます
    // @ts-expect-error: 'drop' might not be in the current Vite types but works at runtime
    pure: ['console.log', 'console.info', 'console.debug'],
    drop: ["debugger"],
  },

  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
