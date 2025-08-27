import { hasChars } from "../lib/utils"
import { lobbyEmitter } from "./client"

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
  lobbyEmitter.post({ action: "create", name })
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
  let name = nameInput.value
  if (!hasChars(name)) {
    nameInput.value = ""
    nameInput.focus()
    return
  }
  lobbyEmitter.post({
    action: "request",
    message: messageTextarea.value,
    name
  })
})
joinRequestForm.append(nameLabel, messageLabel, nameFormButton)

export let pendingState = document.createElement("div")
pendingState.textContent =
  "Your join request has been submitted and you will be " +
  "notified when the host accepts or rejects your request."
