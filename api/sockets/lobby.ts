import type {
  Game,
  Socket,
  SocketRequest,
  SocketResponse
} from "../../lib/types"
import { hasChars } from "../../lib/utils"
import { encrypt } from "../jose"
import { gameSockets, getAvailableGames } from "../ws"

export function lobbySocket(
  ws: Socket,
  {
    games,
    lobbySockets
  }: {
    games: Map<string, Game>
    lobbySockets: Set<Socket>
  }
) {
  let userId = crypto.randomUUID()

  ws.on("close", () => {
    lobbySockets.delete(ws)
  })

  ws.on("message", async rawData => {
    let req: SocketRequest = JSON.parse(rawData.toString())

    try {
      // -------------------- Create Game --------------------
      if (req.key == "create_game") {
        let game: Game = {
          players: [{ id: userId, name: req.name, status: "active" }]
        }
        let gameId = crypto.randomUUID()

        games.set(gameId, game)
        lobbySockets.delete(ws)

        let token = await encrypt({ gameId, userId })
        sendResponse(ws, { key: "token", token })

        sendGameState(game)

        for (let socket of lobbySockets)
          sendResponse(socket, getAvailableGames())
      }

      // -------------------- Request to Join --------------------
      else if (req.key == "request_to_join") {
        if (!games.has(req.gameId)) throw "Game not found"
        let game = games.get(req.gameId)!

        if (game.rounds) throw "Game has already started"

        let player = {
          id: userId,
          message: req.message,
          name: req.name,
          pending: true
        }
        game.players.push(player)

        let gameId = req.gameId

        let token = await encrypt({ gameId, userId })
        sendResponse(ws, { key: "token", token })

        sendGameState(game)
      }
    } catch (error) {
      sendResponse(ws, {
        key: "error",
        message: hasChars(error) ? error : "An unexpected error occurred"
      })
    }
  })

  ws.on("pong", () => {
    ws.alive = true
  })
}

function getGameState({ players, rounds }: Game) {
  return {
    key: "game_state",
    game: rounds
      ? {
          players: players.map(({ letters = 0, ...player }) => {
            return { letters, ...player }
          }),
          rounds,
          started: true as const
        }
      : { players, started: false as const }
  } as const
}

function sendGameState(game: Game) {
  let gameState = getGameState(game)
  for (let { id } of game.players)
    if (gameSockets.has(id)) sendResponse(gameSockets.get(id)!, gameState)
}

function sendResponse(ws: Socket, res: SocketResponse) {
  if (ws.readyState == WebSocket.OPEN) ws.send(JSON.stringify(res))
}
