import "../style/global.css"
import { lobbyEmitter, localToken, Socket } from "./client"
import {
  admittedPlayerList,
  availableGamesList,
  joinRequestForm,
  lobbyContainer,
  main,
  pageTitle,
  pendingPlayerList,
  pendingState,
  waitingRoom
} from "./elements"
import { initUI, showToast } from "./ui"

if (location.pathname != "/") location.replace(location.origin)

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
    if (data.key == "list") {
      availableGamesList.innerHTML = ""
      if (data.availableGames.length == 0) {
        availableGamesList.innerHTML = "<p>No available games</p>"
        return
      }
      availableGamesList.append(
        ...data.availableGames.map(game => {
          let li = document.createElement("li")
          let button = document.createElement("button")
          button.textContent = "Request to Join"
          button.addEventListener("click", () => {
            lobbyContainer.remove()
            pageTitle.textContent = "Request to Join Game"
            pageTitle.after(joinRequestForm)
            pendingGameId = game[0]!.id
          })
          li.append(`${game[0]!.name}'s Game`, button)
          return li
        })
      )
    } else if (data.key == "game_update") {
      lobbyContainer.remove()
      pageTitle.textContent = "Waiting Room"
      pageTitle.after(waitingRoom)
      admittedPlayerList.innerHTML = ""
      admittedPlayerList.append(
        ...data.players.map(player => {
          let li = document.createElement("li")
          li.textContent = player.name
          return li
        })
      )
    } else if (data.key == "accept") {
      localToken.set(data.token)
      connectToGame(data.token)
    } else if (data.key == "deny") {
      pendingGameId = ""
      pendingState.remove()
      pageTitle.textContent = "Lobby"
      pageTitle.after(lobbyContainer)
      showToast("You have been denied entry 😬")
    } else if (data.key == "request") {
      let li = document.createElement("li")
      let rejectButton = document.createElement("button")
      rejectButton.textContent = "Reject"
      rejectButton.addEventListener("click", () => {
        ws.send({ key: "deny", userId: data.userId })
        li.remove()
      })
      let admitButton = document.createElement("button")
      admitButton.textContent = "Admit"
      admitButton.addEventListener("click", () => {
        ws.send({ key: "accept", name: data.name, userId: data.userId })
        li.remove()
      })
      li.append(data.name, rejectButton, admitButton)
      pendingPlayerList.append(li)
    }
  })
  lobbyEmitter.listen(data => {
    if (data.key == "create") ws.send(data)
    else if (data.key == "request") {
      if (!pendingGameId) return
      ws.send({
        ...data,
        creatorId: pendingGameId
      })
      pageTitle.textContent = "Awaiting Response..."
      joinRequestForm.remove()
      pageTitle.after(pendingState)
    }
  })
}
