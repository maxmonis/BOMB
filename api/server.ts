import compression from "compression"
import cors from "cors"
import { config } from "dotenv"
import express from "express"
import helmet from "helmet"
import { createServer } from "http"
import { WebSocketServer } from "ws"
import { maxRequests, packageVersion } from "./middleware"
import { connectRedis } from "./redis"
import { searchRoute } from "./routes/search"
import { onConnection } from "./ws"

config()

connectRedis()

let app = express()

app.set("trust proxy", 1)

app.use((req, res, next) => {
  if (req.hostname == "www.bomb.maxmonis.com")
    return res.redirect(301, `https://bomb.maxmonis.com${req.originalUrl}`)
  next()
})

app.use(maxRequests(500))

app.get("/api/health", (_req, res) => {
  res.send({ status: "ok" })
})

app.use(
  "/api/",
  helmet(),
  cors(),
  maxRequests(100),
  packageVersion,
  express.json({ limit: "20mb" }),
  express.urlencoded({ extended: true }),
  compression()
)

app.use("/api/search/", searchRoute)

if (process.env.NODE_ENV == "production") {
  app.use(express.static("./.build/app"))
  app.get("*", (_req, res) => {
    res.sendFile("index.html", { root: "./.build/app" })
  })
}

let port = process.env.PORT ?? 8080
let server = createServer(app)

server.listen(port, () => {
  console.log(`Server started on port ${port}`)
})

let wss = new WebSocketServer({ server })
wss.on("connection", onConnection)
