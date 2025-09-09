import type { IncomingMessage } from "http"
import { WebSocket } from "ws"
import type { Game, Socket, SocketRequest, SocketResponse } from "../lib/types"
import { hasChars } from "../lib/utils"
import { decrypt, encrypt } from "./jose"

export let gameSockets = new Map<string, Socket>()
let lobbySockets = new Set<Socket>()

let games = new Map<string, Game>()

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
    gameSockets.set(userId, ws)
    sendResponse(ws, getGameState(game))
  } else if (token) sendResponse(ws, { key: "invalid_token" })
  else {
    userId = crypto.randomUUID()
    lobbySockets.add(ws)
    sendResponse(ws, getAvailableGames())
  }

  ws.on("close", () => {
    if (gameSockets.has(userId)) gameSockets.delete(userId)
    else lobbySockets.delete(ws)
  })

  ws.on("message", async rawData => {
    let req: SocketRequest = JSON.parse(rawData.toString())

    try {
      // -------------------- Create Game --------------------
      if (req.key == "create_game") {
        player = { id: userId, name: req.name, status: "active" }
        game = { players: [player] }
        gameId = crypto.randomUUID()

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
          pending: true
        }
        game.players.push(player)

        gameId = req.gameId

        let token = await encrypt({ gameId, userId })
        sendResponse(ws, { key: "token", token })

        sendGameState(game)
      }

      // -------------------- Accept Join Request --------------------
      else if (req.key == "accept_join_request") {
        if (!game || !gameId) throw "Game not found"
        if (game.rounds) throw "Game has already started"

        let acceptedPlayer = game.players.find(p => p.id == req.userId)
        if (!acceptedPlayer) throw "Player not found"

        delete acceptedPlayer.message
        delete acceptedPlayer.pending

        if (gameSockets.has(acceptedPlayer.id))
          sendResponse(gameSockets.get(acceptedPlayer.id)!, {
            key: "toast",
            message: "You've been admitted"
          })

        sendGameState(game)
      }

      // -------------------- Deny Join Request --------------------
      else if (req.key == "deny_join_request") {
        if (!game || !gameId) throw "Game not found"
        if (game.rounds) throw "Game has already started"

        let deniedPlayer = game.players.find(p => p.id == req.userId)
        if (!deniedPlayer) throw "Player not found"

        if (gameSockets.has(deniedPlayer.id)) {
          let socket = gameSockets.get(deniedPlayer.id)!
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
        if (!game || !gameId) throw "Game not found"
        if (game.rounds) throw "Game has already started"

        for (let { id, pending } of game.players)
          if (pending && gameSockets.has(id)) {
            let socket = gameSockets.get(id)!
            sendResponse(socket, {
              key: "toast",
              message: "Your join request was denied"
            })
            sendResponse(socket, { key: "invalid_token" })
          }

        game.players = game.players.filter(p => !p.pending)
        game.rounds = [[]]
        sendGameState(game)
      }

      // -------------------- Leave Game --------------------
      else if (req.key == "leave_game") {
        if (!game || !gameId) throw "Game not found"
        if (!player) throw "Player not found"

        sendResponse(ws, { key: "invalid_token" })

        gameSockets.delete(player.id)

        sendToast(game, `${player.name} left the game`)

        if (game.rounds) {
          let activePlayers = game.players.filter(
            p => !p.letters || p.letters < 4
          )

          if (activePlayers.length == 1) {
            games.delete(gameId)
            for (let socket of lobbySockets)
              sendResponse(socket, getAvailableGames())
            return
          }

          player.letters = 4

          for (let p of game.players) if (p.status) p.status = "active"

          if (player.status) activateNextPlayer(game)
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

          for (let socket of lobbySockets)
            sendResponse(socket, getAvailableGames())
        }
      }

      // -------------------- Play Move --------------------
      else if (req.key == "play_move") {
        if (!game || !gameId) throw "Game not found"
        if (!game.rounds?.[0]) throw "Game has not started"

        game.rounds[0].push(req.page)

        activateNextPlayer(game)
        sendGameState(game)
      }

      // -------------------- Challenge --------------------
      else if (req.key == "challenge") {
        if (!game || !gameId) throw "Game not found"
        if (!game.rounds?.[0]) throw "Game has not started"

        let previousPlayer = findPreviousPlayer(game)
        if (!player || !previousPlayer) throw "Player not found"

        for (let p of game.players) delete p.status
        previousPlayer.status = "challenged"

        sendToast(game, `${player.name} has challenged ${previousPlayer.name}!`)

        sendGameState(game)
      }

      // -------------------- Give Up --------------------
      else if (req.key == "give_up") {
        if (!game || !gameId) throw "Game not found"
        if (!game.rounds?.[0]) throw "Game has not started"
        if (!player) throw "Player not found"

        player.letters = player.letters ? player.letters + 1 : 1

        sendToast(
          game,
          `${player.name} gave up and now has ${
            player.letters == 1
              ? "a B"
              : player.letters == 4
                ? "been eliminated"
                : "BOMB".substring(0, player.letters)
          }`
        )

        game.rounds.unshift([])

        for (let p of game.players) if (p.status) p.status = "active"

        activateNextPlayer(game)
        sendGameState(game)
      }

      // -------------------- Mark Answer Correct --------------------
      else if (req.key == "mark_answer_correct") {
        if (!game || !gameId) throw "Game not found"
        if (!game.rounds?.[0]) throw "Game has not started"
        if (!player) throw "Player not found"

        player.letters = player.letters ? player.letters + 1 : 1

        sendToast(
          game,
          `${player.name}'s challenge was unsuccesful.<br />They now have ${
            player.letters == 1
              ? "a B"
              : player.letters == 4
                ? "been eliminated"
                : "BOMB".substring(0, player.letters)
          }`
        )

        game.rounds.unshift([])

        activateNextPlayer(game)
        sendGameState(game)
      }

      // -------------------- Mark Answer Incorrect --------------------
      else if (req.key == "mark_answer_incorrect") {
        if (!game || !gameId) throw "Game not found"
        if (!game.rounds?.[0]) throw "Game has not started"

        let previousPlayer = findPreviousPlayer(game)
        if (!player || !previousPlayer) throw "Player not found"

        previousPlayer.letters = previousPlayer.letters
          ? previousPlayer.letters + 1
          : 1

        sendToast(
          game,
          `${player.name} marked that response as invalid.<br />${
            previousPlayer.name
          } has ${
            previousPlayer.letters == 1
              ? "a B"
              : previousPlayer.letters == 4
                ? "been eliminated"
                : "BOMB".substring(0, previousPlayer.letters)
          }`
        )

        game.rounds.unshift([])

        activateNextPlayer(game)
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

function activateNextPlayer(game: Game) {
  let index = game.players.findIndex(p => p.status)
  if (index == -1) return

  let count = game.players.length
  let nextIndex = (index + 1) % count
  while (game.players[nextIndex]!.letters! > 3)
    nextIndex = (nextIndex + 1) % count

  let nextPlayer = game.players[nextIndex]
  if (!nextPlayer) throw "Player not found"

  let challenged = false
  for (let player of game.players) {
    if (player.status == "challenged") challenged = true
    delete player.status
  }
  nextPlayer.status = challenged ? "reviewing" : "active"
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

function sendToast(game: Game, message: string) {
  for (let { id } of game.players)
    if (gameSockets.has(id))
      sendResponse(gameSockets.get(id)!, { key: "toast", message })
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
