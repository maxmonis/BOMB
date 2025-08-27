import { lobbyEmitter, localToken, Socket } from "./client"
import {
  availableGamesList,
  joinRequestForm,
  lobbyContainer,
  main,
  pageTitle,
  pendingState
} from "./elements"
import { initUI, showToast } from "./ui"

initUI()

let token = localToken.get()
if (token) connectToGame(token)
else connectToLobby()

function connectToGame(token: string) {
  let ws = new Socket(token)
  ws.onError(() => {
    localToken.remove()
    ws.close()
    connectToLobby()
  })
}

function connectToLobby() {
  let ws = new Socket(null)
  if (!main.contains(lobbyContainer)) pageTitle.after(lobbyContainer)
  let pendingGameId: string | null = null
  ws.onError(() => {
    ws.close()
  })
  ws.onMessage(data => {
    if (Array.isArray(data))
      availableGamesList.append(
        ...data.map(gameId => {
          let li = document.createElement("li")
          let button = document.createElement("button")
          button.textContent = "Request to Join"
          button.addEventListener("click", () => {
            lobbyContainer.remove()
            pageTitle.textContent = "Request to Join Game"
            pageTitle.after(joinRequestForm)
            pendingGameId = gameId
          })
          li.append(gameId, button)
          return li
        })
      )
    else if (data.action == "accept") {
      localToken.set(data.token)
      connectToGame(data.token)
    } else if (data.action == "deny") {
      pendingGameId = ""
      pendingState.remove()
      pageTitle.textContent = "Lobby"
      pageTitle.after(lobbyContainer)
      showToast("You have been denied entry 😬")
    }
  })
  lobbyEmitter.listen(data => {
    if (data.action == "create") ws.send(data)
    else if (data.action == "request") {
      if (!pendingGameId) return
      ws.send({
        ...data,
        gameId: pendingGameId
      })
      pageTitle.textContent = "Awaiting Response..."
      joinRequestForm.remove()
      pageTitle.after(pendingState)
    }
  })
}
