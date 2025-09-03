import { hasChars } from "../lib/utils"
import { gameEmitter } from "./client"

export let footer = document.querySelector("footer")!
export let header = document.querySelector("header")!
export let instructions = document.querySelector<HTMLElement>(".instructions")!
export let main = document.querySelector("main")!
export let pageTitle = document.querySelector("h1")!

export let lobbyContainer = document.createElement("div")

export let lineBreak = document.createElement("br")

export let spinner = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "svg"
)
spinner.classList.add("spinner")
spinner.setAttribute("height", "40")
spinner.setAttribute("preserveAspectRatio", "xMidYMid")
spinner.setAttribute("viewBox", "0 0 100 100")
spinner.setAttribute("width", "40")
let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
rect.setAttribute("fill", "none")
rect.setAttribute("height", "100")
rect.setAttribute("width", "100")
rect.setAttribute("x", "0")
rect.setAttribute("y", "0")
let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
circle.setAttribute("cx", "50")
circle.setAttribute("cy", "50")
circle.setAttribute("fill", "none")
circle.setAttribute("r", "40")
circle.setAttribute("stroke", "currentColor")
circle.setAttribute("stroke-linecap", "round")
circle.setAttribute("stroke-width", "12")
spinner.append(rect, circle)

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

export let gameSubtitle = document.createElement("h2")
export let waitingRoom = document.createElement("div")
let playerListContainer = document.createElement("div")
gameSubtitle.textContent = "Current Players"
export let admittedPlayerList = document.createElement("ul")
playerListContainer.append(gameSubtitle, admittedPlayerList)
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
export let roundsContainer = document.createElement("ol")

export let searchContainer = document.createElement("div")
searchContainer.classList.add("search-container")
export let challengeContainer = document.createElement("div")
export let answerValidator = document.createElement("div")
export let giveUpContainer = document.createElement("div")

export let answerValidatorDialog = document.createElement("dialog")
answerValidatorDialog.classList.add("validator-dialog")
let answerValidatorDialogContent = document.createElement("div")
export let answerValidatorDialogTitle = document.createElement("h1")
let answerValidatorDialogButtons = document.createElement("div")
answerValidatorDialogButtons.classList.add("dialog-button-container")
export let validAnswerButton = document.createElement("button")
validAnswerButton.textContent = "Yes, it was a valid answer"
validAnswerButton.autofocus = true
validAnswerButton.addEventListener("click", () => {
  answerValidatorDialog.close()
  answerValidatorDialog.remove()
})
let invalidAnswerButton = document.createElement("button")
invalidAnswerButton.classList.add("red-text")
invalidAnswerButton.textContent = "No, give the previous player a letter"
invalidAnswerButton.addEventListener("click", () => {
  gameEmitter.post({ key: "mark_answer_incorrect" })
  answerValidatorDialog.close()
  answerValidatorDialog.remove()
})
answerValidatorDialogButtons.append(validAnswerButton, invalidAnswerButton)
answerValidatorDialog.addEventListener("click", e => {
  if (e.target == answerValidatorDialog) answerValidatorDialog.close()
})
answerValidatorDialogContent.append(
  answerValidatorDialogTitle,
  answerValidatorDialogButtons
)
answerValidatorDialog.append(answerValidatorDialogContent)
