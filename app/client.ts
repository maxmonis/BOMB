import type {
  GameRequest,
  GameResponse,
  LobbyRequest,
  LobbyResponse
} from "../lib/types"

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
