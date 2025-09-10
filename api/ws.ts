import type { IncomingMessage } from "http"
import { WebSocket } from "ws"
import type { Game, Socket, SocketResponse } from "../lib/types"
import { hasChars } from "../lib/utils"
import { gameSocket } from "./sockets/game"
import { lobbySocket } from "./sockets/lobby"

export let gameSockets = new Map<string, Socket>()
let lobbySockets = new Set<Socket>()

let games = new Map<string, Game>()

export async function onConnection(
  socket: WebSocket,
  { headers, url }: IncomingMessage
) {
  let ws: Socket = Object.assign(socket, { alive: true })

  let { pathname, searchParams } = new URL(url!, `http://${headers.host}`)
  let token = searchParams.get("token")

  try {
    if (token && pathname == "/ws/game")
      await gameSocket(ws, { token, games, gameSockets, lobbySockets })
    else if (pathname == "/ws/lobby")
      await lobbySocket(ws, { games, lobbySockets })
    else throw new Error("Invalid URL")
  } catch (error) {
    let message: SocketResponse = {
      key: "error",
      message: hasChars(error) ? error : "An unexpected error occurred"
    }
    ws.send(JSON.stringify(message))
  }

  ws.on("pong", () => {
    ws.alive = true
  })
}

export function getAvailableGames() {
  return {
    key: "available_games",
    games: Array.from(games.entries()).flatMap(([id, { players, rounds }]) => {
      if (rounds) return []
      let [creator] = players
      return creator ? { creatorName: creator.name, id } : []
    })
  } as const
}

setInterval(() => {
  for (let socket of lobbySockets)
    if (socket.alive) {
      socket.alive = false
      socket.ping()
    } else {
      socket.terminate()
      lobbySockets.delete(socket)
    }

  for (let [id, socket] of gameSockets.entries())
    if (socket)
      if (socket.alive) {
        socket.alive = false
        socket.ping()
      } else {
        socket.terminate()
        gameSockets.delete(id)
      }
}, 30_000)
