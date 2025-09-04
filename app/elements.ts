import { gameEmitter } from "./client"

export let main = document.querySelector("main")!
export let pageTitle = document.querySelector("h1")!

// -------------------- Utilities --------------------
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

// -------------------- Active Game --------------------
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
