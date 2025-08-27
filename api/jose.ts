import { config } from "dotenv"
import { type JWTPayload, type ProduceJWT, SignJWT, jwtVerify } from "jose"

config()

export async function decrypt(jwt: string) {
  let { payload } = await jwtVerify(jwt, key, { algorithms: ["HS256"] })
  return payload
}

export function encrypt(
  payload: JWTPayload,
  expiration: Parameters<ProduceJWT["setExpirationTime"]>[0]
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(key)
}

let key = new TextEncoder().encode(process.env.JWT_SECRET)
