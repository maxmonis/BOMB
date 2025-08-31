import type { IncomingMessage } from "http"
import { WebSocket } from "ws"
import { hasChars } from "../lib/utils"
import { decrypt, encrypt } from "./jose"
import { Redis } from "./redis"
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

  let gameData: GameData = {}

  if (gameId && game && player) {
    player.socket = ws
    if (game.started) {
      let cachedGameData = await new Redis(`game:${gameId}`).get()
      gameData = cachedGameData ?? {}
    }
    sendResponse(ws, getGameState(game, gameData))
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
      gameData = {}
      sendGameState(game)
    }

    // -------------------- Play Move --------------------
    else if (req.key == "play_move") {
      if (!game || !gameId) {
        sendResponse(ws, { key: "error", message: "Game not found" })
        return
      }
      let dataCache = new Redis(`game:${gameId}`)
      let cachedGameData = await dataCache.get()
      if (cachedGameData) gameData = cachedGameData
      gameData.lastCategory =
        gameData.lastCategory == "movie" ? "actor" : "movie"
      if (!gameData.rounds) gameData.rounds = [[]]
      gameData.rounds.at(-1)!.push(req.page)
      let index = gameData.currentPlayerIndex ?? 0
      let nextIndex = (index + 1) % game.players.length
      let players = game.players.map(({ id, name }) => {
        return {
          id,
          letters: gameData.letters?.[id] ?? 0,
          name
        }
      })
      while (players[nextIndex]!.letters > 3) {
        nextIndex = (nextIndex + 1) % game.players.length
      }
      gameData.currentPlayerIndex = nextIndex
      dataCache.set(gameData)
      sendGameState(game, gameData)
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
      return creator ? { creatorName: creator.name, id } : []
    })
  } as const
}

function getGameState({ players, started }: Game, gameData: GameData = {}) {
  if (!started)
    return {
      key: "game_state",
      game: {
        players: players.map(({ socket, ...player }) => {
          return { connected: Boolean(socket), ...player }
        }),
        started: false
      }
    } as const

  let {
    challenged,
    currentPlayerIndex = 0,
    lastCategory,
    letters,
    rounds,
    ...game
  } = gameData

  return {
    key: "game_state",
    game: {
      ...game,
      category: lastCategory == "movie" ? "actor" : "movie",
      players: players.map(({ socket, ...player }, i) => {
        return {
          connected: Boolean(socket),
          letters: letters?.[player.id] ?? 0,
          status:
            i == currentPlayerIndex
              ? challenged
                ? "challenged"
                : "active"
              : "idle",
          ...player
        } as const
      }),
      rounds: rounds ?? [[]],
      started: true
    }
  } as const
}

function sendGameState(game: Game, gameData?: GameData) {
  let res = getGameState(game, gameData)
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
  started: boolean
}

export interface GameData {
  challenged?: boolean
  currentPlayerIndex?: number
  lastCategory?: "actor" | "movie"
  letters?: Record<string, number>
  rounds?: Array<Array<Page>>
}

type GameResponse = ActiveGameResponse | PendingGameResponse

export interface ActiveGameResponse
  extends Omit<Game, "players" | "started">,
    Omit<
      GameData,
      | "challenged"
      | "currentPlayerIndex"
      | "lastCategory"
      | "letters"
      | "rounds"
    > {
  category: "actor" | "movie"
  players: Array<GameResponsePlayer>
  rounds: Array<Array<Page>>
  started: true
}

interface PendingGameResponse extends Omit<Game, "players" | "started"> {
  players: Array<Omit<GameResponsePlayer, "letters" | "status">>
  started: false
}

interface GameResponsePlayer extends Omit<Player, "socket"> {
  connected: boolean
  letters: number
  status: "active" | "challenged" | "idle"
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
  | { key: "token"; token: string }
