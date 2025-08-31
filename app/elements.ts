import { hasChars } from "../lib/utils"
import { gameEmitter } from "./client"

export let footer = document.querySelector("footer")!
export let header = document.querySelector("header")!
export let instructions = document.querySelector<HTMLElement>(".instructions")!
export let main = document.querySelector("main")!
export let pageTitle = document.querySelector("h1")!

export let lobbyContainer = document.createElement("div")

let createGameTitle = document.createElement("h2")
createGameTitle.textContent = "Create New Game"
let createGameForm = document.createElement("form")
createGameForm.classList.add("create-game-form")
let createGameLabel = document.createElement("label")
let createGameInput = document.createElement("input")
createGameInput.required = true
createGameInput.maxLength = 20
let createGameButton = document.createElement("button")
createGameButton.textContent = "Create Game"
createGameLabel.append("Your name", createGameInput, createGameButton)
createGameForm.append(createGameLabel)
createGameForm.addEventListener("submit", e => {
  e.preventDefault()
  let name = createGameInput.value
  if (!hasChars(name)) {
    createGameInput.value = ""
    createGameInput.focus()
    return
  }
  gameEmitter.post({ key: "create_game", name })
})

let availableGamesTitle = document.createElement("h2")
availableGamesTitle.textContent = "Available Games"
export let availableGamesList = document.createElement("ul")
availableGamesList.classList.add("available-games-list")

lobbyContainer.append(
  createGameTitle,
  createGameForm,
  availableGamesTitle,
  availableGamesList
)

export let joinRequestForm = document.createElement("form")
let nameLabel = document.createElement("label")
let nameInput = document.createElement("input")
nameInput.autofocus = true
nameInput.maxLength = 20
nameInput.required = true
nameLabel.append("Your name", nameInput)
let messageLabel = document.createElement("label")
let messageTextarea = document.createElement("textarea")
messageTextarea.maxLength = 300
messageLabel.append("Message (optional)", messageTextarea)
let nameFormButton = document.createElement("button")
nameFormButton.textContent = "Send Request"
joinRequestForm.addEventListener("submit", e => {
  e.preventDefault()
  let name = nameInput.value.trim()
  let message = messageTextarea.value.trim()
  if (!hasChars(name)) {
    nameInput.value = ""
    nameInput.focus()
    return
  }
  nameInput.value = ""
  messageTextarea.value = ""
  gameEmitter.post({
    key: "request_to_join",
    message,
    name
  })
})
joinRequestForm.append(nameLabel, messageLabel, nameFormButton)

export let pendingState = document.createElement("div")

export let waitingRoom = document.createElement("div")
let playerListContainer = document.createElement("div")
let playerListTitle = document.createElement("h2")
playerListTitle.textContent = "Current Players"
export let admittedPlayerList = document.createElement("ul")
playerListContainer.append(playerListTitle, admittedPlayerList)
export let pendingPlayerList = document.createElement("ul")
waitingRoom.append(playerListContainer, pendingPlayerList)

export let startGameButton = document.createElement("button")
startGameButton.textContent = "Start Game"
startGameButton.addEventListener("click", () => {
  gameEmitter.post({ key: "start_game" })
})
