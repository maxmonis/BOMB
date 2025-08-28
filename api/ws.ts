import type { IncomingMessage } from "http"
import type { Duplex } from "stream"
import { WebSocket, WebSocketServer } from "ws"
import {
  GameRequest,
  GameResponse,
  LobbyRequest,
  LobbyResponse
} from "../lib/types"
import { hasChars } from "../lib/utils"
import { decrypt, encrypt } from "./jose"

let wss = new WebSocketServer({ noServer: true })

let lobbyClients = new Set<LobbyClient>()

let activeGames = new Map<string, Set<GameClient>>()
let pendingGames = new Map<
  string,
  { admitted: Set<GameClient>; requested: Set<GameClient> }
>()

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
    let { gameId, name, userId } = await decrypt(token)
    if (!hasChars(gameId) || !hasChars(name) || !hasChars(userId))
      throw "Invalid token"
    let activeGame = activeGames.get(gameId)
    if (activeGame) {
      let client = Array.from(activeGame).find(c => c.userId == userId)
      if (!client) throw "Invalid token"
      wss.emit("game", client, request)
      return
    }
    if (!pendingGames.has(gameId)) {
      if (gameId != userId) throw "Invalid token"
      wss.handleUpgrade(request, socket, head, ws => {
        let newClient: GameClient = Object.assign(ws, {
          alive: true,
          gameId,
          name,
          userId
        })
        pendingGames.set(gameId, {
          admitted: new Set([newClient]),
          requested: new Set()
        })
        for (let lobbyClient of lobbyClients)
          sendResponse(lobbyClient, getGameList())
        wss.emit("game", newClient, request)
        return
      })
    }
    let pendingGame = pendingGames.get(gameId)!
    let admittedClient = Array.from(pendingGame.admitted).find(
      c => c.userId == userId
    )
    if (admittedClient) {
      wss.emit("game:pending", admittedClient, request)
      return
    }
    let requestedClient = Array.from(pendingGame.requested).find(
      c => c.userId == userId
    )
    if (requestedClient) {
      wss.emit("game:pending", requestedClient, request)
      return
    }
    wss.handleUpgrade(request, socket, head, ws => {
      let newClient: GameClient = Object.assign(ws, {
        alive: true,
        gameId,
        name,
        userId
      })
      pendingGame.requested.add(newClient)
      wss.emit("game:pending", newClient, request)
    })
  } catch (error) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
    socket.destroy()
  }
}

wss.on("game", async (ws: GameClient) => {
  let game = activeGames.get(ws.gameId)!
  console.log("game", game)
  ws.on("close", () => {
    lobbyClients.delete(ws)
  })
})

function getPendingGameRes({
  admitted,
  requested
}: {
  admitted: Set<GameClient>
  requested: Set<GameClient>
}) {
  return {
    key: "pending_game",
    game: {
      admitted: Array.from(admitted).map(c => {
        return { id: c.userId, name: c.name }
      }),
      requested: Array.from(requested).map(c => {
        return { id: c.userId, name: c.name }
      })
    }
  } as const
}

wss.on("game:pending", async (ws: GameClient) => {
  let pendingGame = pendingGames.get(ws.gameId)!
  sendResponse(ws, getPendingGameRes(pendingGame))
  ws.on("message", async rawData => {
    let data: GameRequest = JSON.parse(rawData.toString())
    if (data.key == "accept") {
      let { userId } = data
      let socket = Array.from(pendingGame.requested).find(
        c => c.userId == userId
      )
      if (!socket) return
      pendingGame.requested.delete(socket)
      pendingGame.admitted.add(socket)
      let res = getPendingGameRes(pendingGame)
      for (let client of pendingGame.admitted) sendResponse(client, res)
    }
  })
  ws.on("close", () => {
    lobbyClients.delete(ws)
  })
})

wss.on("lobby", async (ws: LobbyClient) => {
  lobbyClients.add(ws)
  let gameList = getGameList()
  sendResponse(ws, gameList)
  ws.on("close", () => {
    lobbyClients.delete(ws)
  })
  ws.on("message", async rawData => {
    let data: LobbyRequest = JSON.parse(rawData.toString())
    if (data.key == "create_game") {
      let { userId } = ws
      sendResponse(ws, {
        key: "game_created",
        token: await encrypt({ gameId: userId, name: data.name, userId })
      })
      ws.close()
    } else if (data.key == "request_to_join") {
      let { userId } = ws
      let { gameId, message, name } = data
      let game = pendingGames.get(gameId)
      let creator = Array.from(game?.admitted ?? [])[0]
      if (!game || !creator) return
      sendResponse(creator, { key: "join_requested", message, name, userId })
      sendResponse(ws, {
        key: "join_request_pending",
        token: await encrypt({ gameId, name, userId })
      })
      ws.close()
    }
  })
  ws.on("ping", () => {
    ws.alive = true
  })
})

function getGameList() {
  return {
    key: "game_list",
    availableGames: Array.from(pendingGames.values()).map(list => {
      let creator = Array.from(list.admitted)[0]!
      return { name: creator.name, id: creator.userId }
    })
  } as const
}

function sendResponse<
  C extends GameClient | LobbyClient,
  T extends C extends GameClient ? GameResponse : LobbyResponse
>(client: C, data: T) {
  if (client.readyState == WebSocket.OPEN) client.send(JSON.stringify(data))
  else console.warn("Tried to send a message on a closed socket")
}

setInterval(() => {
  pingClients(lobbyClients)
  for (let clients of activeGames.values()) pingClients(clients)
  for (let game of pendingGames.values()) {
    pingClients(game.admitted)
    pingClients(game.requested)
  }
}, 30_000)

function pingClients(clients: Set<GameClient | LobbyClient>) {
  for (let client of clients) {
    if (!client.alive) {
      client.terminate()
      clients.delete(client)
      continue
    }
    client.alive = false
    client.ping()
  }
}

interface GameClient extends Omit<LobbyClient, "gameId"> {
  gameId: string
  name: string
}

interface LobbyClient extends WebSocket {
  alive: boolean
  userId: string
}
