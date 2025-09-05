import { build } from "esbuild"
import { readFileSync, rmSync } from "fs"

let { version } = JSON.parse(readFileSync("package.json", "utf8"))
let production = process.env.NODE_ENV == "production"

rmSync(".build/api", { force: true, recursive: true })

build({
  bundle: true,
  define: { "process.env.PACKAGE_VERSION": JSON.stringify(version) },
  entryPoints: ["api/server.ts"],
  format: "cjs",
  minify: false,
  outfile: ".build/api/server.js",
  platform: "node",
  sourcemap: !production,
  target: "node22.17.0",
  tsconfig: production ? "tsconfig.prod.json" : "tsconfig.json"
}).catch(() => {
  process.exit(1)
})
