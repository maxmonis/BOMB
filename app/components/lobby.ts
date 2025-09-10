import type { SocketResponse } from "../../lib/types"
import { sendRequest, wrapLabel } from "../client"
import { pageContent, pageTitle } from "../elements"
import { toast } from "../ui"

let gameList: Extract<SocketResponse, { key: "available_games" }>["games"] = []
let pendingGameId: string | null = null

export function renderLobby(ws: WebSocket, games = gameList) {
  gameList = games

  if (pendingGameId)
    if (gameList.some(g => g.id == pendingGameId)) return
    else {
      toast.show("Game was deleted")
      pendingGameId = null
    }

  let lobby = document.createElement("div")
  lobby.append(createGameForm(ws), createGameList(ws))
  lobby.classList.add("lobby")

  pageTitle.textContent = "Lobby"
  pageContent.innerHTML = ""
  pageContent.append(lobby)
}

function createGameForm(ws: WebSocket) {
  let input = document.createElement("input")
  input.maxLength = 20
  input.required = true

  let button = document.createElement("button")
  button.classList.add("btn")
  button.textContent = "Create Game"
  button.type = "submit"

  let form = document.createElement("form")
  form.append(wrapLabel("Your name", input), button)

  form.addEventListener("submit", e => {
    e.preventDefault()

    let name = input.value.trim()

    if (!name) {
      input.value = ""
      input.focus()
      return
    }

    sendRequest(ws, { key: "create_game", name })
  })

  let title = document.createElement("h2")
  title.textContent = "Create New Game"

  let container = document.createElement("div")
  container.append(title, form)
  return container
}

function createGameList(ws: WebSocket) {
  let container = document.createElement("div")

  let title = document.createElement("h2")
  title.textContent = "Available Games"

  if (!gameList.length) {
    let text = document.createElement("p")
    text.textContent = "No available games"

    container.append(title, text)
    return container
  }

  let list = document.createElement("ul")
  list.append(
    ...gameList.map(game => {
      let name = document.createElement("span")
      name.textContent = `${game.creatorName}'s Game`

      let button = document.createElement("button")
      button.addEventListener("click", () => {
        renderJoinRequestForm(ws, game.id, game.creatorName)
      })
      button.textContent = "Request to Join"

      let li = document.createElement("li")
      li.append(name, button)
      return li
    })
  )

  container.append(title, list)
  return container
}

function renderJoinRequestForm(
  ws: WebSocket,
  gameId: string,
  creatorName: string
) {
  pendingGameId = gameId

  let input = document.createElement("input")
  input.autofocus = true
  input.maxLength = 20
  input.required = true

  let textarea = document.createElement("textarea")
  textarea.maxLength = 300

  let submitButton = document.createElement("button")
  submitButton.classList.add("btn")
  submitButton.textContent = "Send Request"
  submitButton.type = "submit"

  let cancelButton = document.createElement("button")
  cancelButton.addEventListener("click", () => {
    pendingGameId = null
    renderLobby(ws)
  })
  cancelButton.classList.add("red")
  cancelButton.textContent = "Cancel"
  cancelButton.type = "button"

  let form = document.createElement("form")
  form.classList.add("request-to-join-form")

  form.append(
    wrapLabel("Your name", input),
    wrapLabel("Message (optional)", textarea),
    submitButton,
    cancelButton
  )

  form.addEventListener("submit", e => {
    e.preventDefault()

    let name = input.value.trim()

    if (!name) {
      input.value = ""
      input.focus()
      return
    }

    pendingGameId = null

    sendRequest(ws, {
      key: "request_to_join",
      gameId,
      name,
      message: textarea.value.trim()
    })
  })

  pageTitle.textContent = `Request to Join ${creatorName}'s Game`
  pageContent.innerHTML = ""
  pageContent.append(form)
}
