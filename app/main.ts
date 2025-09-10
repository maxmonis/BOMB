import type { SocketResponse } from "../lib/types"
import "../style/global.css"
import { createWebSocket, getUserIdFromToken, localToken } from "./client"
import { renderActiveGame } from "./components/activeGame"
import { renderLobby } from "./components/lobby"
import { renderPendingGame } from "./components/pendingGame"
import { applyDark, toast } from "./ui"

if (location.pathname != "/") location.replace(location.origin)

applyDark()
init()

function init() {
  let token = localToken.get()
  let userId = getUserIdFromToken(token)
  let ws = createWebSocket(token)

  ws.onclose = reset
  ws.onerror = reset

  ws.onmessage = ({ data }) => {
    let res: SocketResponse = JSON.parse(data)

    switch (res.key) {
      case "toast":
        toast.show(res.message)
        break

      case "error":
        toast.show(res.message, { variant: "danger" })
        break

      case "token":
        localToken.set(res.token)
        reset()
        break

      case "invalid_token":
        localToken.remove()
        reset()
        break

      case "available_games":
        renderLobby(ws, res.games)
        break

      case "game_state":
        if (!userId) reset()
        else if (res.game.started) renderActiveGame(ws, res.game, userId)
        else renderPendingGame(ws, res.game, userId)
        break
    }
  }

  function reset() {
    ws.onclose = null
    ws.onerror = null
    if (
      ws.readyState == WebSocket.OPEN ||
      ws.readyState == WebSocket.CONNECTING
    )
      ws.close()
    init()
  }
}
