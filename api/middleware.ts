import type { NextFunction, Request, Response } from "express"
import rateLimit from "express-rate-limit"
import { hasChars } from "../lib/utils"
import { decrypt } from "./jose"
import { games } from "./ws"

export async function authToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let token = req.header("X-Auth-Token")
  if (!token) {
    res.status(401).json("No token")
    return
  }
  try {
    let { gameId, userId } = await decrypt(token)
    if (!hasChars(gameId) || !hasChars(userId)) throw "Invalid token"
    let game = games.get(gameId)
    if (!game?.started || !game.players.some(p => p.id == userId))
      throw "Invalid token"
    next()
  } catch (error) {
    res.status(401).json("Invalid token")
  }
}

export function maxRequests(limit: number) {
  return rateLimit({
    legacyHeaders: false,
    limit,
    message: "Too many requests",
    standardHeaders: "draft-8",
    windowMs: 900_000
  })
}

export function packageVersion(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.header("X-Package-Version") == process.env.PACKAGE_VERSION) next()
  else res.status(409).json("New version available, please reload page")
}
