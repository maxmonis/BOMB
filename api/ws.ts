import type { IncomingMessage } from "http"
import { WebSocket } from "ws"
import { hasChars } from "../lib/utils"
import { decrypt, encrypt } from "./jose"

let lobby = new Set<Socket>()
export let games = new Map<string, Game>()

export async function onConnection(
  socket: WebSocket,
  { headers, url }: IncomingMessage
) {
  let ws: Socket = Object.assign(socket, { alive: true })

  let token = new URL(url!, `http://${headers.host}`).searchParams.get("token")

  let tokenValues = token ? await decrypt(token) : null
  let gameId = hasChars(tokenValues?.gameId) ? tokenValues.gameId : null
  let userId = hasChars(tokenValues?.userId) ? tokenValues.userId : ""

  if (token && (!gameId || !userId)) sendResponse(ws, { key: "invalid_token" })

  let game = gameId ? games.get(gameId) : null
  if (gameId && !game) sendResponse(ws, { key: "invalid_token" })

  let player = game && userId ? game.players.find(p => p.id == userId) : null

  if (game && player) {
    player.socket = ws
    sendGameState(game)
  } else {
    if (game) sendResponse(ws, { key: "invalid_token" })
    userId = crypto.randomUUID()
    game = null
    gameId = null
    lobby.add(ws)
    sendResponse(ws, getAvailableGames())
  }

  ws.on("close", () => {
    if (player) delete player.socket
    else lobby.delete(ws)
  })

  ws.on("message", async rawData => {
    let req: SocketRequest = JSON.parse(rawData.toString())

    // -------------------- Create Game --------------------
    if (req.key == "create_game") {
      gameId = crypto.randomUUID()
      player = { id: userId, name: req.name, socket: ws }
      game = { players: [player], started: false }
      games.set(gameId, game)
      lobby.delete(ws)
      let token = await encrypt({ gameId, userId })
      sendResponse(ws, { key: "token", token })
      sendGameState(game)
      for (let socket of lobby) sendResponse(socket, getAvailableGames())
    }

    // -------------------- Request to Join --------------------
    else if (req.key == "request_to_join") {
      gameId = req.gameId
      game = games.get(gameId)
      if (!game) {
        gameId = null
        game = null
        sendResponse(ws, { key: "error", message: "Game not found" })
        return
      }
      let token = await encrypt({ gameId, userId })
      sendResponse(ws, { key: "token", token })
      player = {
        id: userId,
        message: req.message,
        name: req.name,
        pending: true,
        socket: ws
      }
      game.players.push(player)
      sendGameState(game)
    }

    // -------------------- Accept Join Request --------------------
    else if (req.key == "accept_join_request") {
      if (!game) {
        sendResponse(ws, { key: "error", message: "Game not found" })
        return
      }
      let acceptedPlayer = game.players.find(p => p.id == req.userId)
      if (!acceptedPlayer) {
        sendResponse(ws, { key: "error", message: "Player not found" })
        return
      }
      delete acceptedPlayer.message
      delete acceptedPlayer.pending
      if (acceptedPlayer.socket)
        sendResponse(acceptedPlayer.socket, { key: "join_request_accepted" })
      sendGameState(game)
    }

    // -------------------- Deny Join Request --------------------
    else if (req.key == "deny_join_request") {
      if (!game) {
        sendResponse(ws, { key: "error", message: "Game not found" })
        return
      }
      let socket = game.players.find(p => p.id == req.userId)?.socket
      if (socket) sendResponse(socket, { key: "join_request_denied" })
      game.players = game.players.filter(p => p.id != req.userId)
      sendGameState(game)
    }

    // -------------------- Start Game --------------------
    else if (req.key == "start_game") {
      if (!game) {
        sendResponse(ws, { key: "error", message: "Game not found" })
        return
      }
      game.players = game.players.filter(p => !p.pending)
      game.started = true
      sendGameState(game)
    }
  })

  ws.on("ping", () => {
    ws.alive = true
  })
}

function getAvailableGames() {
  return {
    key: "available_games",
    games: Array.from(games.entries()).flatMap(([id, { players, started }]) => {
      if (started) return []
      let creator = players[0]
      if (!creator?.socket) {
        games.delete(id)
        return []
      }
      return { creatorName: creator.name, id }
    })
  } as const
}

function sendGameState({ players, ...game }: Game) {
  let playerList = players.map<GameResponsePlayer>(({ socket, ...player }) => {
    return { connected: Boolean(socket?.alive), ...player }
  })
  for (let player of players)
    if (player.socket)
      sendResponse(player.socket, {
        key: "game_state",
        game: { ...game, players: playerList }
      })
}

function sendResponse(ws: Socket, res: SocketResponse) {
  if (ws.readyState == WebSocket.OPEN) ws.send(JSON.stringify(res))
}

setInterval(() => {
  for (let socket of lobby)
    if (socket.alive) {
      socket.alive = false
      socket.ping()
    } else {
      socket.terminate()
      lobby.delete(socket)
    }
  for (let game of games.values())
    for (let player of game.players)
      if (player.socket)
        if (player.socket.alive) {
          player.socket.alive = false
          player.socket.ping()
        } else {
          player.socket.terminate()
          delete player.socket
        }
}, 30_000)

interface Game {
  players: Array<Player>
  started: boolean
}

interface GameResponse extends Omit<Game, "players"> {
  players: Array<GameResponsePlayer>
}

interface GameResponsePlayer extends Omit<Player, "socket"> {
  connected: boolean
}

interface Player {
  id: string
  message?: string
  name: string
  pending?: boolean
  socket?: Socket
}

interface Socket extends WebSocket {
  alive: boolean
}

export type SocketRequest =
  | { key: "accept_join_request"; userId: string }
  | { key: "create_game"; name: string }
  | { key: "deny_join_request"; userId: string }
  | { key: "request_to_join"; gameId: string; message: string; name: string }
  | { key: "start_game" }

export type SocketResponse =
  | {
      key: "available_games"
      games: Array<{ creatorName: string; id: string }>
    }
  | { key: "error"; message: string }
  | { key: "game_state"; game: GameResponse }
  | { key: "invalid_token" }
  | { key: "join_request_accepted" }
  | { key: "join_request_denied" }
  | { key: "token"; token: string }
