import type { SocketRequest } from "../lib/types"
import { hasChars } from "../lib/utils"

class Channel<K extends "dark", T extends K extends "dark" ? boolean : never> {
  private readonly channel: BroadcastChannel

  constructor(key: K) {
    this.channel = new BroadcastChannel(key)
  }

  post(data: T) {
    this.channel.postMessage(data)
  }

  listen(callback: (data: T) => void) {
    this.channel.onmessage = e => {
      callback(e.data)
    }
  }
}

export let darkChannel = new Channel("dark")

class LocalStorage<
  K extends "dark" | "token",
  T extends K extends "dark" ? boolean : K extends "token" ? string : never
> {
  private readonly key: K

  constructor(key: K) {
    this.key = key
  }

  get(): T | null {
    let item = localStorage.getItem(this.key)
    return item ? JSON.parse(item) : null
  }

  set(item: T) {
    localStorage.setItem(this.key, JSON.stringify(item))
  }

  remove() {
    localStorage.removeItem(this.key)
  }
}

export let localDark = new LocalStorage("dark")
export let localToken = new LocalStorage("token")

export async function callAPI<T>(
  path: string,
  { headers: headersInit, ...init }: RequestInit = {}
) {
  let token = localToken.get()

  let res = await fetch(`/api/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Package-Version": import.meta.env.PACKAGE_VERSION,
      ...(token && { "X-Auth-Token": token }),
      ...headersInit
    }
  })

  let value: T = await res.json()
  if (res.ok) return value

  if (res.status == 409 && value == "New version available, please reload page")
    window.location.reload()

  throw value
}

export function createWebSocket(token: string | null) {
  return new WebSocket(
    `${location.protocol.replace("http", "ws")}//${location.host}/ws${
      token ? `/game?token=${token}` : "/lobby"
    }`
  )
}

function getTokenPayload(value: unknown): unknown {
  if (!hasChars(value)) return null

  let [header, payload, signature] = value.split(".")
  if (!header || !payload || !hasChars(signature)) return null

  try {
    JSON.parse(atob(header))
    return JSON.parse(atob(payload))
  } catch (error) {
    return null
  }
}

export function getUserIdFromToken(token: unknown) {
  let tokenPayload = getTokenPayload(token)

  return tokenPayload &&
    typeof tokenPayload == "object" &&
    "userId" in tokenPayload &&
    hasChars(tokenPayload.userId)
    ? tokenPayload.userId
    : null
}

export function sendRequest(ws: WebSocket, req: SocketRequest) {
  if (ws.readyState == WebSocket.OPEN) ws.send(JSON.stringify(req))
}

export function wrapLabel(text: string, input: HTMLElement) {
  let label = document.createElement("label")
  label.append(text, input)
  return label
}
