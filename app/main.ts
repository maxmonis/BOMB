import type { SocketRequest, SocketResponse } from "../api/ws"
import { hasChars } from "../lib/utils"
import "../style/global.css"
import { gameEmitter, localToken } from "./client"
import {
  admittedPlayerList,
  availableGamesList,
  joinRequestForm,
  lobbyContainer,
  main,
  pageTitle,
  pendingPlayerList,
  pendingText,
  startGameButton,
  waitingRoom
} from "./elements"
import { initUI, showToast } from "./ui"

if (location.pathname != "/") location.replace(location.origin)

initUI()
init()

function init() {
  let token = localToken.get()
  let userId = getUserIdFromToken(token)

  let ws = new WebSocket(
    `${location.protocol.replace(
      "http",
      "ws"
    )}//${location.host}/ws${token ? `?token=${token}` : ""}`
  )

  let pendingGameId: string | null = null

  pageTitle.textContent = "Lobby"

  ws.onerror = () => {
    localToken.remove()
    ws.close()
    init()
  }

  ws.onmessage = event => {
    let res: SocketResponse = JSON.parse(event.data)

    // -------------------- Token --------------------
    if (res.key == "token") {
      localToken.set(res.token)
      ws.close()
      init()
    } else if (res.key == "invalid_token") {
      localToken.remove()
      ws.close()
      init()
    }

    // -------------------- Game State --------------------
    else if (res.key == "game_state") {
      lobbyContainer.remove()

      let creator = res.game.players[0]!
      let isCreator = userId == creator.id

      pageTitle.textContent = isCreator ? "Your Game" : `${creator.name}'s Game`

      // -------------------- Pending Game --------------------
      if (!res.game.started) {
        if (!main.contains(waitingRoom)) pageTitle.after(waitingRoom)

        pendingText.remove()

        if (res.game.players.some(p => p.id == userId && p.pending)) {
          pageTitle.textContent = "Awaiting Response..."
          pendingText.textContent =
            "Your join request has been submitted and you will be " +
            "notified when the host accepts or rejects your request."
          waitingRoom.after(pendingText)
        } else if (!isCreator) {
          pendingText.textContent = "Waiting for the host to start the game..."
          waitingRoom.after(pendingText)
        }

        admittedPlayerList.innerHTML = ""
        let admittedPlayers = res.game.players.flatMap(p => {
          if (p.pending) return []
          let li = document.createElement("li")
          li.textContent = p.name
          return li
        })
        admittedPlayerList.append(...admittedPlayers)

        if (!isCreator) return

        let pendingPlayers = res.game.players.flatMap(p => {
          if (!p.pending) return []

          let li = document.createElement("li")

          let text = document.createElement("div")
          let name = document.createElement("p")
          name.textContent = p.name
          let message = document.createElement("small")
          message.textContent = p.message ?? ""
          text.append(name, message)

          let buttons = document.createElement("div")
          let rejectButton = document.createElement("button")
          rejectButton.textContent = "Reject"
          rejectButton.addEventListener("click", () => {
            sendRequest(ws, { key: "deny_join_request", userId: p.id })
            li.remove()
          })
          let admitButton = document.createElement("button")
          admitButton.textContent = "Admit"
          admitButton.addEventListener("click", () => {
            sendRequest(ws, { key: "accept_join_request", userId: p.id })
            li.remove()
          })
          buttons.append(rejectButton, admitButton)

          li.append(text, buttons)

          return li
        })

        pendingPlayerList.innerHTML = ""
        if (pendingPlayers.length) pendingPlayerList.append(...pendingPlayers)

        if (admittedPlayers.length > 1 && !main.contains(startGameButton))
          pendingPlayerList.after(startGameButton)
      }
    }

    // -------------------- Available Games --------------------
    else if (res.key == "available_games") {
      if (!main.contains(lobbyContainer)) pageTitle.after(lobbyContainer)

      availableGamesList.innerHTML = ""
      if (res.games.length == 0) {
        availableGamesList.innerHTML = "<p>No available games</p>"
        return
      }

      availableGamesList.append(
        ...res.games.map(game => {
          let gameName = `${game.creatorName}'s Game`

          let li = document.createElement("li")

          let button = document.createElement("button")
          button.textContent = "Request to Join"

          button.addEventListener("click", () => {
            lobbyContainer.remove()
            pageTitle.textContent = `Request to Join ${gameName}`
            pageTitle.after(joinRequestForm)
            pendingGameId = game.id
          })

          li.append(gameName, button)
          return li
        })
      )
    }

    // -------------------- Join Request Accepted --------------------
    else if (res.key == "join_request_accepted")
      showToast("You've been admitted 😁")
    // -------------------- Join Request Denied --------------------
    else if (res.key == "join_request_denied") {
      waitingRoom.remove()
      pendingText.remove()
      showToast("Your join request was denied 😔")
      localToken.remove()
      ws.close()
      init()
    }

    // -------------------- Error --------------------
    else if (res.key == "error") showToast(`Error: ${res.message}`)
  }

  gameEmitter.listen(data => {
    if (data.key == "create_game") sendRequest(ws, data)
    else if (data.key == "start_game") sendRequest(ws, data)
    else if (data.key == "request_to_join")
      if (pendingGameId) sendRequest(ws, { ...data, gameId: pendingGameId })
  })
}

function getTokenPayload(value: unknown): unknown {
  if (!hasChars(value)) return null

  let [header, payload, signature] = value.split(".")
  if (!header || !payload || !hasChars(signature)) return null

  try {
    JSON.parse(atob(header))
    return JSON.parse(atob(payload))
  } catch (error) {
    return null
  }
}

function getUserIdFromToken(token: unknown) {
  let tokenPayload = getTokenPayload(token)
  return tokenPayload &&
    typeof tokenPayload == "object" &&
    "userId" in tokenPayload &&
    hasChars(tokenPayload.userId)
    ? tokenPayload.userId
    : null
}

function sendRequest(ws: WebSocket, req: SocketRequest) {
  if (ws.readyState == WebSocket.OPEN) ws.send(JSON.stringify(req))
}
