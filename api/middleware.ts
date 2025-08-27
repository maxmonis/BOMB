import type { NextFunction, Request, Response } from "express"
import rateLimit from "express-rate-limit"

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
