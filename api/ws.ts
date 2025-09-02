import type { IncomingMessage } from "http"
import { WebSocket } from "ws"
import { hasChars } from "../lib/utils"
import { decrypt, encrypt } from "./jose"
import { Page } from "./search"

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

  if (gameId && game && player) {
    player.socket = ws
    sendResponse(ws, getGameState(game))
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
      player = { id: userId, name: req.name, socket: ws, status: "active" }
      game = { players: [player] }
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
      game.rounds = [[]]
      sendGameState(game)
    }

    // -------------------- Play Move --------------------
    else if (req.key == "play_move") {
      if (!game) {
        sendResponse(ws, { key: "error", message: "Game not found" })
        return
      }
      game.rounds?.at(-1)!.push(req.page)
      let nextPlayer = findNextActivePlayer(game)
      if (!nextPlayer) return
      for (let player of game.players) {
        if (player.id == nextPlayer.id) player.status = "active"
        else delete player.status
      }
      sendGameState(game)
    }

    // -------------------- Mark Answer Incorrect --------------------
    else if (req.key == "mark_answer_incorrect") {
      if (!game) return

      let activePlayer = game.players.find(p => p.status)
      let previousPlayer = findPreviousActivePlayer(game)
      if (!activePlayer || !previousPlayer) return

      previousPlayer.letters = previousPlayer.letters
        ? previousPlayer.letters + 1
        : 1

      let toastMessage = {
        key: "toast",
        message: `${activePlayer.name} marked that response as invalid.<br />${
          previousPlayer.name
        } has ${
          previousPlayer.letters == 1
            ? "a B"
            : previousPlayer.letters == 4
              ? "been eliminated"
              : "BOMB".substring(0, previousPlayer.letters)
        }`
      } as const

      for (let player of game.players)
        if (player.socket) sendResponse(player.socket, toastMessage)

      game.rounds?.push([])

      let nextPlayer = findNextActivePlayer(game)
      if (!nextPlayer) return

      for (let player of game.players) {
        if (player.id == nextPlayer.id) player.status = "active"
        else delete player.status
      }

      sendGameState(game)
    }
  })

  ws.on("pong", () => {
    ws.alive = true
  })
}

function findNextActivePlayer(game: Game) {
  if (!game) return null
  let index = game.players.findIndex(p => p.status)
  let nextIndex = (index + 1) % game.players.length
  while (game.players[nextIndex]!.letters! > 3)
    nextIndex = (nextIndex + 1) % game.players.length
  return game.players[nextIndex] || null
}

function findPreviousActivePlayer(game: Game) {
  if (!game) return null
  let index = game.players.findIndex(p => p.status)
  let prevIndex = (index - 1 + game.players.length) % game.players.length
  while (game.players[prevIndex]!.letters! > 3)
    prevIndex = (prevIndex - 1 + game.players.length) % game.players.length
  return game.players[prevIndex] || null
}

function getAvailableGames() {
  return {
    key: "available_games",
    games: Array.from(games.entries()).flatMap(([id, { players, rounds }]) => {
      if (rounds) return []
      let creator = players[0]
      return creator ? { creatorName: creator.name, id } : []
    })
  } as const
}

function getGameState({ players, rounds }: Game) {
  if (!rounds)
    return {
      key: "game_state",
      game: {
        players: players.map(({ socket, ...player }) => {
          return { connected: Boolean(socket), ...player }
        }),
        started: false
      }
    } as const

  return {
    key: "game_state",
    game: {
      players: players.map(({ letters = 0, socket, ...player }) => {
        return {
          connected: Boolean(socket),
          letters,
          ...player
        }
      }),
      rounds,
      started: true
    }
  } as const
}

function sendGameState(game: Game) {
  let res = getGameState(game)
  for (let player of game.players)
    if (player.socket) sendResponse(player.socket, res)
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
  rounds?: Array<Array<Page>>
}

type GameResponse = ActiveGameResponse | PendingGameResponse

interface ActiveGameResponse {
  players: Array<ActiveGamePlayer>
  rounds: Array<Array<Page>>
  started: true
}

interface PendingGameResponse {
  players: Array<PendingGamePlayer>
  started: false
}

interface ActiveGamePlayer
  extends Omit<Player, "message" | "pending" | "socket"> {
  connected: boolean
  letters: number
}

interface PendingGamePlayer extends Omit<Player, "socket"> {
  connected: boolean
}

interface Player {
  id: string
  letters?: number
  message?: string
  name: string
  pending?: boolean
  socket?: Socket
  status?: "active" | "challenged"
}

interface Socket extends WebSocket {
  alive: boolean
}

export type SocketRequest =
  | { key: "accept_join_request"; userId: string }
  | { key: "create_game"; name: string }
  | { key: "deny_join_request"; userId: string }
  | { key: "mark_answer_incorrect" }
  | { key: "play_move"; page: Page }
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
  | { key: "toast"; message: string }
  | { key: "token"; token: string }
