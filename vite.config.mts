import { defineConfig } from "vite"
import version from "vite-plugin-package-version"

export default defineConfig(({ command, mode }) => {
  return {
    build: {
      outDir: ".build/app",
      sourcemap: command == "serve" || mode == "development"
    },
    plugins: [version()],
    server: {
      port: 3000,
      proxy: {
        "/api": { changeOrigin: true, target: "http://localhost:8080" },
        "/ws": { changeOrigin: true, target: "ws://localhost:8080", ws: true }
      },
      watch: { ignored: ["api/**"] }
    }
  }
})
