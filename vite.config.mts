import { defineConfig } from "vite"

export default defineConfig({
  build: { outDir: ".build/app", sourcemap: true },
  server: {
    port: 3000,
    proxy: {
      "/api": { changeOrigin: true, target: "http://localhost:8080" }
    },
    watch: { ignored: ["api/**"] }
  }
})
