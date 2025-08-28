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
import { initUI } from "./ui"

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
  ws.onMessage(data => {
    console.log(data)
    if (data.key == "pending_game") {
      lobbyContainer.remove()
      pageTitle.textContent = "Pending Game"
      pageTitle.after(waitingRoom)
      admittedPlayerList.innerHTML = ""
      admittedPlayerList.append(
        ...data.game.admitted.map(p => {
          let li = document.createElement("li")
          li.textContent = p.name
          return li
        })
      )
    } else if (data.key == "join_requested") {
      let li = document.createElement("li")
      let text = document.createElement("div")
      let name = document.createElement("p")
      name.textContent = data.name
      let message = document.createElement("p")
      message.textContent = data.message
      text.append(name, message)
      let buttons = document.createElement("div")
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
      buttons.append(rejectButton, admitButton)
      li.append(text, buttons)
      pendingPlayerList.append(li)
    }
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
    if (data.key == "game_list") {
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
            pendingGameId = game.id
          })
          li.append(`${game.name}'s Game`, button)
          return li
        })
      )
    } else {
      localToken.set(data.token)
      connectToGame(data.token)
    }
  })
  lobbyEmitter.listen(data => {
    if (data.key == "create_game") ws.send(data)
    else if (data.key == "request_to_join") {
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
