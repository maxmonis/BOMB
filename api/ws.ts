import type { IncomingMessage } from "http"
import type { Duplex } from "stream"
import { WebSocket, WebSocketServer } from "ws"
import { Game, LobbyRequest, LobbyResponse } from "../lib/types"
import { hasChars } from "../lib/utils"
import { decrypt } from "./jose"

let wss = new WebSocketServer({ noServer: true })

let gameClients = new Set<GameClient>()
let lobbyClients = new Set<LobbyClient>()

let availableGames = new Map<
  string,
  Array<Omit<Game["players"][number], "letters">>
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

wss.on("game", async (gameClient: GameClient) => {
  gameClients.add(gameClient)
  gameClient.on("close", () => {
    gameClients.delete(gameClient)
  })
  gameClient.on("ping", () => {
    gameClient.alive = true
  })
})

wss.on("lobby", async (lobbyClient: LobbyClient) => {
  lobbyClients.add(lobbyClient)
  let gameList = getGameList()
  lobbyClient.send(JSON.stringify(gameList))
  lobbyClient.on("close", () => {
    lobbyClients.delete(lobbyClient)
    if (lobbyClient.gameId && availableGames.has(lobbyClient.gameId)) {
      let players = availableGames
        .get(lobbyClient.gameId)!
        .filter(p => p.id != lobbyClient.userId)
      availableGames.set(lobbyClient.gameId, players)
      let message: LobbyResponse = { key: "game_update", players }
      for (let client of lobbyClients)
        if (players.some(p => p.id == client.userId))
          client.send(JSON.stringify(message))
    }
    if (availableGames.has(lobbyClient.userId)) {
      availableGames.delete(lobbyClient.userId)
      let gameList = getGameList()
      for (let client of lobbyClients) client.send(JSON.stringify(gameList))
    }
  })
  lobbyClient.on("message", async rawData => {
    let data: LobbyRequest = JSON.parse(rawData.toString())
    if (data.key == "create") {
      let players = [{ id: lobbyClient.userId, name: data.name }]
      availableGames.set(lobbyClient.userId, players)
      let message: LobbyResponse = { key: "game_update", players }
      lobbyClient.send(JSON.stringify(message))
      let gameList = getGameList()
      for (let client of lobbyClients) client.send(JSON.stringify(gameList))
    } else if (data.key == "request") {
      let game = availableGames.get(data.creatorId)
      if (!game) return
      let message: LobbyResponse = {
        key: "request",
        message: data.message,
        name: data.name,
        userId: lobbyClient.userId
      }
      for (let client of lobbyClients)
        if (client.userId == data.creatorId) {
          client.send(JSON.stringify(message))
          return
        }
    } else if (data.key == "accept") {
      let players = availableGames.get(lobbyClient.userId)
      if (!players) return
      players.push({ id: data.userId, name: data.name })
      for (let client of lobbyClients) {
        if (client.userId == data.userId) client.gameId = lobbyClient.userId
        if (players.some(p => p.id == client.userId)) {
          let message: LobbyResponse = { key: "game_update", players }
          client.send(JSON.stringify(message))
        }
      }
    } else if (data.key == "deny") {
    }
  })
  lobbyClient.on("ping", () => {
    lobbyClient.alive = true
  })
})

function getGameList() {
  let gameList: LobbyResponse = {
    key: "list",
    availableGames: Array.from(availableGames.values())
  }
  return gameList
}

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

interface GameClient extends Omit<LobbyClient, "gameId"> {
  gameId: string
}

interface LobbyClient extends WebSocket {
  alive: boolean
  gameId?: string
  userId: string
}
