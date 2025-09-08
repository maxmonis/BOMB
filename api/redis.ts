import { config } from "dotenv"
import { createClient } from "redis"
import { Game } from "../lib/types"

config()

let redis = createClient(
  process.env.REDIS_HOST &&
    process.env.REDIS_PASSWORD &&
    process.env.REDIS_PORT &&
    process.env.REDIS_USERNAME
    ? {
        password: process.env.REDIS_PASSWORD,
        socket: {
          host: process.env.REDIS_HOST,
          port: Number(process.env.REDIS_PORT)
        },
        username: process.env.REDIS_USERNAME
      }
    : { url: "redis://localhost:6379" }
)

export class Redis<
  K extends `game:${string}`,
  T extends K extends `game:${string}` ? Game : never
> {
  private readonly key: K
  constructor(key: K) {
    this.key = key
  }
  async get() {
    let res = await redis.GET(this.key)
    if (res) return JSON.parse(res) as T
  }
  setex(item: T, hours: number) {
    return redis.SETEX(this.key, 3600 * hours, JSON.stringify(item))
  }
  set(item: T) {
    return redis.SET(this.key, JSON.stringify(item))
  }
  delete() {
    return redis.DEL(this.key)
  }
}

export async function connectRedis() {
  try {
    await redis.connect()
    console.log("Redis connected")
  } catch (error) {
    console.error("Failed to connect to Redis:", error)
    process.exit(1)
  }
}

async function disconnectRedis() {
  if (!redis.isOpen) return
  try {
    await redis.destroy()
    console.log("Redis disconnected")
    process.exit(0)
  } catch (error) {
    console.error("Failed to disconnect from Redis:", error)
    process.exit(1)
  }
}

process.on("SIGTERM", disconnectRedis)
process.on("SIGINT", disconnectRedis)
