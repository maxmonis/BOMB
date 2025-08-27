import type {
  GameRequest,
  GameResponse,
  LobbyRequest,
  LobbyResponse
} from "../lib/types"

class Channel<
  K extends "theme",
  T extends K extends "theme" ? "audio" | "dark" : never
> {
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

export let themeChannel = new Channel("theme")

class Emitter<
  K extends "lobby",
  T extends K extends "lobby"
    ?
        | { key: "create"; name: string }
        | { key: "request"; message: string; name: string }
    : never
> {
  private readonly key: `CustomEvent:${K}`
  constructor(key: K) {
    this.key = `CustomEvent:${key}`
  }
  post(data: T) {
    document.dispatchEvent(new CustomEvent(this.key, { detail: { data } }))
  }
  listen(callback: (data: T) => void) {
    document.addEventListener(this.key, event => {
      let customEvent = event as CustomEvent
      callback(customEvent.detail.data)
    })
  }
}

export let lobbyEmitter = new Emitter("lobby")

class LocalStorage<
  K extends "audio" | "dark" | "token",
  T extends K extends "audio" | "dark"
    ? boolean
    : K extends "token"
      ? string
      : never
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

export let localAudio = new LocalStorage("audio")
export let localDark = new LocalStorage("dark")
export let localToken = new LocalStorage("token")

export class Socket<
  Token extends string | null,
  Request extends Token extends string ? GameRequest : LobbyRequest,
  Response extends Token extends string ? GameResponse : LobbyResponse
> {
  private readonly ws: WebSocket
  constructor(token: Token) {
    this.ws = new WebSocket(
      `${
        location.protocol == "https:" ? "wss" : "ws"
      }://${location.host}/ws${token ? `?token=${token}` : ""}`
    )
  }
  close() {
    if (this.ws.readyState == WebSocket.OPEN) this.ws.close
  }
  onError(callback: (error: Event) => void) {
    this.ws.onerror = callback
  }
  onMessage(callback: (data: Response) => void) {
    this.ws.onmessage = event => {
      callback(JSON.parse(event.data))
    }
  }
  send(data: Request) {
    this.ws.send(JSON.stringify(data))
  }
}
