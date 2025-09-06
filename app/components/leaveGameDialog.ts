import { localToken, sendRequest } from "../client"

export function createLeaveGameDialog(ws: WebSocket) {
  let dialog = document.createElement("dialog")
  let content = document.createElement("div")

  let title = document.createElement("h1")
  title.textContent = "Leave Game?"

  let buttons = document.createElement("div")
  buttons.classList.add("dialog-button-container")

  let stay = document.createElement("button")
  stay.textContent = "No, stay"
  stay.addEventListener("click", () => {
    dialog.close()
    dialog.remove()
  })

  let leave = document.createElement("button")
  leave.textContent = "Yes, leave"
  leave.classList.add("red")
  leave.addEventListener("click", () => {
    localToken.remove()

    sendRequest(ws, { key: "leave_game" })

    dialog.close()
    dialog.remove()
  })

  buttons.append(stay, leave)
  content.append(title, buttons)
  dialog.append(content)

  let button = document.createElement("button")
  button.textContent = "Leave Game"
  button.classList.add("red")
  button.addEventListener("click", () => {
    document.body.append(dialog)
    dialog.showModal()
  })
  return button
}
