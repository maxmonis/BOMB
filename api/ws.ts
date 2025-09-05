import type { IncomingMessage } from "http"
import { WebSocket } from "ws"
import type { Game, Socket, SocketRequest, SocketResponse } from "../lib/types"
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

  let game = gameId ? games.get(gameId) : null
  let player = game && userId ? game.players.find(p => p.id == userId) : null

  if (game && player) {
    player.socket = ws
    sendResponse(ws, getGameState(game))
  } else {
    if (token) sendResponse(ws, { key: "invalid_token" })
    gameId = null
    userId = crypto.randomUUID()
    lobby.add(ws)
    sendResponse(ws, getAvailableGames())
  }

  ws.on("close", () => {
    if (player) delete player.socket
    else lobby.delete(ws)
  })

  ws.on("message", async rawData => {
    let req: SocketRequest = JSON.parse(rawData.toString())

    try {
      // -------------------- Create Game --------------------
      if (req.key == "create_game") {
        player = { id: userId, name: req.name, socket: ws, status: "active" }
        game = { players: [player] }
        gameId = crypto.randomUUID()

        games.set(gameId, game)
        lobby.delete(ws)

        let token = await encrypt({ gameId, userId })
        sendResponse(ws, { key: "token", token })

        sendGameState(game)

        for (let socket of lobby) sendResponse(socket, getAvailableGames())
      }

      // -------------------- Request to Join --------------------
      else if (req.key == "request_to_join") {
        game = games.get(req.gameId)

        if (!game) throw "Game not found"
        if (game.rounds) {
          game = null
          throw "Game has already started"
        }

        player = {
          id: userId,
          message: req.message,
          name: req.name,
          pending: true,
          socket: ws
        }
        game.players.push(player)

        gameId = req.gameId

        let token = await encrypt({ gameId, userId })
        sendResponse(ws, { key: "token", token })

        sendGameState(game)
      }

      // -------------------- Accept Join Request --------------------
      else if (req.key == "accept_join_request") {
        if (!game) throw "Game not found"
        if (game.rounds) throw "Game has already started"

        let acceptedPlayer = game.players.find(p => p.id == req.userId)
        if (!acceptedPlayer) throw "Player not found"

        delete acceptedPlayer.message
        delete acceptedPlayer.pending

        if (acceptedPlayer.socket)
          sendResponse(acceptedPlayer.socket, {
            key: "toast",
            message: "You've been admitted"
          })

        sendGameState(game)
      }

      // -------------------- Deny Join Request --------------------
      else if (req.key == "deny_join_request") {
        if (!game) throw "Game not found"
        if (game.rounds) throw "Game has already started"

        let socket = game.players.find(p => p.id == req.userId)?.socket
        if (socket) {
          sendResponse(socket, {
            key: "toast",
            message: "Your join request was denied"
          })
          sendResponse(socket, { key: "invalid_token" })
        }

        game.players = game.players.filter(p => p.id != req.userId)
        sendGameState(game)
      }

      // -------------------- Start Game --------------------
      else if (req.key == "start_game") {
        if (!game) throw "Game not found"
        if (game.rounds) throw "Game has already started"

        for (let p of game.players)
          if (p.pending && p.socket) {
            sendResponse(p.socket, {
              key: "toast",
              message: "Your join request was denied"
            })
            sendResponse(p.socket, { key: "invalid_token" })
          }

        game.players = game.players.filter(p => !p.pending)
        game.rounds = [[]]
        sendGameState(game)
      }

      // -------------------- Leave Game --------------------
      else if (req.key == "leave_game") {
        if (!game || !gameId) throw "Game not found"
        if (!player) throw "Player not found"

        if (player.socket) sendResponse(player.socket, { key: "invalid_token" })

        delete player.socket

        let toastMessage = {
          key: "toast",
          message: `${player.name} left the game`
        } as const
        for (let p of game.players)
          if (p.socket) sendResponse(p.socket, toastMessage)

        if (game.rounds) {
          let activePlayers = game.players.filter(p => (p.letters ?? 0) < 4)

          if (activePlayers.length == 1) {
            games.delete(gameId)
            for (let socket of lobby) sendResponse(socket, getAvailableGames())
            return
          }

          player.letters = 4

          if (player.status) {
            let nextPlayer = findNextPlayer(game)
            if (nextPlayer) {
              for (let p of game.players) delete p.status
              nextPlayer.status = "active"
            }
          }

          sendGameState(game)
        } else {
          game.players = game.players.filter(p => p.id != userId)

          let newHost = game.players.find(p => !p.pending) ?? game.players[0]

          if (newHost) {
            newHost.status = "active"

            delete newHost.pending
            delete newHost.message

            sendGameState(game)
          } else games.delete(gameId)

          for (let socket of lobby) sendResponse(socket, getAvailableGames())
        }
      }

      // -------------------- Play Move --------------------
      else if (req.key == "play_move") {
        if (!game) throw "Game not found"
        if (!game.rounds?.[0]) throw "Game has not started"

        game.rounds[0].push(req.page)

        let challenged = game.players.some(p => p.status == "challenged")
        let nextPlayer = findNextPlayer(game)

        if (nextPlayer) {
          for (let p of game.players) delete p.status
          nextPlayer.status = challenged ? "reviewing" : "active"
        }

        sendGameState(game)
      }

      // -------------------- Challenge --------------------
      else if (req.key == "challenge") {
        if (!game) throw "Game not found"
        if (!game.rounds?.[0]) throw "Game has not started"

        let previousPlayer = findPreviousPlayer(game)
        if (!player || !previousPlayer) throw "Player not found"

        for (let p of game.players) delete p.status
        previousPlayer.status = "challenged"

        let toastMessage = {
          key: "toast",
          message: `${player.name} has challenged ${previousPlayer.name}!`
        } as const
        for (let p of game.players)
          if (p.socket) sendResponse(p.socket, toastMessage)

        sendGameState(game)
      }

      // -------------------- Give Up --------------------
      else if (req.key == "give_up") {
        if (!game) throw "Game not found"
        if (!game.rounds?.[0]) throw "Game has not started"
        if (!player) throw "Player not found"

        player.letters = player.letters ? player.letters + 1 : 1

        let toastMessage = {
          key: "toast",
          message: `${player.name} gave up and now has ${
            player.letters == 1
              ? "a B"
              : player.letters == 4
                ? "been eliminated"
                : "BOMB".substring(0, player.letters)
          }`
        } as const
        for (let p of game.players)
          if (p.socket) sendResponse(p.socket, toastMessage)

        game.rounds.unshift([])

        let nextPlayer = findNextPlayer(game)
        if (nextPlayer) {
          for (let p of game.players) delete p.status
          nextPlayer.status = "active"
        }

        sendGameState(game)
      }

      // -------------------- Mark Answer Correct --------------------
      else if (req.key == "mark_answer_correct") {
        if (!game) throw "Game not found"
        if (!game.rounds?.[0]) throw "Game has not started"
        if (!player) throw "Player not found"

        player.letters = player.letters ? player.letters + 1 : 1

        let toastMessage = {
          key: "toast",
          message: `${
            player.name
          }'s challenge was unsuccesful.<br />They now have ${
            player.letters == 1
              ? "a B"
              : player.letters == 4
                ? "been eliminated"
                : "BOMB".substring(0, player.letters)
          }`
        } as const
        for (let p of game.players)
          if (p.socket) sendResponse(p.socket, toastMessage)

        game.rounds.unshift([])

        let nextPlayer = findNextPlayer(game)
        if (nextPlayer) {
          for (let p of game.players) delete p.status
          nextPlayer.status = "active"
        }

        sendGameState(game)
      }

      // -------------------- Mark Answer Incorrect --------------------
      else if (req.key == "mark_answer_incorrect") {
        if (!game) throw "Game not found"
        if (!game.rounds?.[0]) throw "Game has not started"

        let previousPlayer = findPreviousPlayer(game)
        if (!player || !previousPlayer) throw "Player not found"

        previousPlayer.letters = previousPlayer.letters
          ? previousPlayer.letters + 1
          : 1

        let toastMessage = {
          key: "toast",
          message: `${player.name} marked that response as invalid.<br />${
            previousPlayer.name
          } has ${
            previousPlayer.letters == 1
              ? "a B"
              : previousPlayer.letters == 4
                ? "been eliminated"
                : "BOMB".substring(0, previousPlayer.letters)
          }`
        } as const
        for (let p of game.players)
          if (p.socket) sendResponse(p.socket, toastMessage)

        game.rounds.unshift([])

        let nextPlayer = findNextPlayer(game)
        if (nextPlayer) {
          for (let p of game.players) delete p.status
          nextPlayer.status = "active"
        }

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

function findNextPlayer(game: Game) {
  let index = game.players.findIndex(p => p.status)
  if (index == -1) return null

  let count = game.players.length
  let nextIndex = (index + 1) % count
  while (game.players[nextIndex]!.letters! > 3)
    nextIndex = (nextIndex + 1) % count

  return game.players[nextIndex] ?? null
}

function findPreviousPlayer(game: Game) {
  let index = game.players.findIndex(p => p.status)
  if (index == -1) return null

  let count = game.players.length
  let previousIndex = (index - 1 + count) % count
  while (game.players[previousIndex]!.letters! > 3)
    previousIndex = (previousIndex - 1 + count) % count

  return game.players[previousIndex] ?? null
}

function getAvailableGames() {
  return {
    key: "available_games",
    games: Array.from(games.entries()).flatMap(([id, { players, rounds }]) => {
      if (rounds) return []
      let [creator] = players
      return creator ? { creatorName: creator.name, id } : []
    })
  } as const
}

function getGameState({ players, rounds }: Game) {
  return {
    key: "game_state",
    game: rounds
      ? {
          players: players.map(({ letters = 0, socket, ...player }) => {
            return { connected: Boolean(socket), letters, ...player }
          }),
          rounds,
          started: true as const
        }
      : {
          players: players.map(({ socket, ...player }) => {
            return { connected: Boolean(socket), ...player }
          }),
          started: false as const
        }
  } as const
}

function sendGameState(game: Game) {
  let gameState = getGameState(game)
  for (let player of game.players)
    if (player.socket) sendResponse(player.socket, gameState)
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
