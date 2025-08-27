import type { IncomingMessage } from "http"
import type { Duplex } from "stream"
import { WebSocket, WebSocketServer } from "ws"
import { hasChars } from "../lib/utils"
import { decrypt } from "./jose"

let wss = new WebSocketServer({ noServer: true })

export async function connectWS(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer<ArrayBufferLike>
) {
  try {
    let url = new URL(request.url!, `http://${request.headers.host}`)
    let token = url.searchParams.get("token")
    if (!token) {
      wss.handleUpgrade(request, socket, head, ws => {
        let lobbyClient: LobbyClient = Object.assign(ws, {
          alive: true,
          userId: crypto.randomUUID()
        })
        wss.emit("lobby", lobbyClient, request)
      })
      return
    }
    let { gameId, userId } = await decrypt(token)
    if (!hasChars(userId) || !hasChars(gameId)) throw "Invalid token"
    wss.handleUpgrade(request, socket, head, ws => {
      let gameClient: GameClient = Object.assign(ws, {
        alive: true,
        gameId,
        userId
      })
      wss.emit("game", gameClient, request)
    })
  } catch (error) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
    socket.destroy()
  }
}

let gameClients = new Set<GameClient>()
let lobbyClients = new Set<LobbyClient>()

wss.on("game", async (gameClient: GameClient) => {
  gameClient.alive = true
  gameClients.add(gameClient)
  gameClient.on("close", () => {
    gameClients.delete(gameClient)
  })
  gameClient.on("ping", () => {
    gameClient.alive = true
  })
})

wss.on("lobby", async (lobbyClient: LobbyClient) => {
  lobbyClient.alive = true
  lobbyClients.add(lobbyClient)
  lobbyClient.on("close", () => {
    lobbyClients.delete(lobbyClient)
  })
  lobbyClient.on("ping", () => {
    lobbyClient.alive = true
  })
})

setInterval(() => {
  for (let client of gameClients) {
    if (!client.alive) {
      client.terminate()
      gameClients.delete(client)
      continue
    }
    client.alive = false
    client.ping()
  }
  for (let client of lobbyClients) {
    if (!client.alive) {
      client.terminate()
      lobbyClients.delete(client)
      continue
    }
    client.alive = false
    client.ping()
  }
}, 30_000)

interface GameClient extends LobbyClient {
  gameId: string
}

interface LobbyClient extends WebSocket {
  alive: boolean
  userId: string
}
