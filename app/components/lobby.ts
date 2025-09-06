import type { SocketResponse } from "../../lib/types"
import { sendRequest, wrapLabel } from "../client"
import { pageContent, pageTitle } from "../elements"
import { showToast } from "../ui"

let gameList: Extract<SocketResponse, { key: "available_games" }>["games"] = []
let pendingGameId: string | null = null

export function renderLobby(ws: WebSocket, games = gameList) {
  gameList = games

  if (pendingGameId)
    if (gameList.some(g => g.id == pendingGameId)) return
    else {
      showToast("Game was deleted")
      pendingGameId = null
    }

  let lobby = document.createElement("div")
  lobby.classList.add("lobby")
  lobby.append(createGameForm(ws), createGameList(ws))

  pageTitle.textContent = "Lobby"
  pageContent.innerHTML = ""
  pageContent.append(lobby)
}

function createGameForm(ws: WebSocket) {
  let title = document.createElement("h2")
  title.textContent = "Create New Game"

  let input = document.createElement("input")
  input.maxLength = 20
  input.required = true

  let label = document.createElement("label")
  label.append("Your name", input)

  let button = document.createElement("button")
  button.classList.add("btn")
  button.textContent = "Create Game"
  button.type = "submit"

  let form = document.createElement("form")
  form.append(label, button)

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
      let li = document.createElement("li")
      let name = document.createElement("span")
      name.textContent = `${game.creatorName}'s Game`

      let button = document.createElement("button")
      button.textContent = "Request to Join"
      button.addEventListener("click", () => {
        renderJoinRequestForm(ws, game.id, game.creatorName)
      })

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

  let form = document.createElement("form")
  form.classList.add("request-to-join-form")

  let input = document.createElement("input")
  input.required = true
  input.maxLength = 20
  input.autofocus = true

  let textarea = document.createElement("textarea")
  textarea.maxLength = 300

  let cancelButton = document.createElement("button")
  cancelButton.type = "button"
  cancelButton.textContent = "Cancel"
  cancelButton.classList.add("red")
  cancelButton.addEventListener("click", () => {
    pendingGameId = null
    renderLobby(ws)
  })

  let submitButton = document.createElement("button")
  submitButton.type = "submit"
  submitButton.textContent = "Send Request"
  submitButton.classList.add("btn")

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
      input.focus()
      input.value = ""
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
