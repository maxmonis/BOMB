import { hasChars } from "../lib/utils"
import { gameEmitter } from "./client"

export let footer = document.querySelector("footer")!
export let header = document.querySelector("header")!
export let instructions = document.querySelector<HTMLElement>(".instructions")!
export let main = document.querySelector("main")!
export let pageTitle = document.querySelector("h1")!

export let lobbyContainer = document.createElement("div")
export let pageSubtitle = document.createElement("h2")

export let spinner = `
<svg
  class="spinner"
  height="40"
  preserveAspectRatio="xMidYMid"
  viewBox="0 0 100 100"
  width="40"
>
  <rect fill="none" height="100" width="100" x="0" y="0"></rect>
  <circle
    cx="50"
    cy="50"
    fill="none"
    r="40"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-width="12"
  ></circle>
</svg>`

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
  joinRequestForm.remove()
})
joinRequestForm.append(nameLabel, messageLabel, nameFormButton)

export let pendingText = document.createElement("p")

export let waitingRoom = document.createElement("div")
let playerListContainer = document.createElement("div")
pageSubtitle.textContent = "Current Players"
export let admittedPlayerList = document.createElement("ul")
playerListContainer.append(pageSubtitle, admittedPlayerList)
export let pendingPlayerList = document.createElement("ul")
waitingRoom.append(playerListContainer, pendingPlayerList)

export let startGameButton = document.createElement("button")
startGameButton.textContent = "Start Game"
startGameButton.addEventListener("click", () => {
  gameEmitter.post({ key: "start_game" })
})

export let gameStateContainer = document.createElement("div")
export let scoreContainer = document.createElement("ul")
scoreContainer.classList.add("score-container")
gameStateContainer.append(scoreContainer)
export let searchContainer = document.createElement("div")
searchContainer.classList.add("search-container")
export let searchLabel = document.createElement("label")
export let searchInput = document.createElement("input")
export let searchResults = document.createElement("ul")
searchContainer.append(searchLabel, searchResults)
export let roundsContainer = document.createElement("ol")
export let currentRoundText = document.createElement("p")
roundsContainer.append(currentRoundText)
