import type { SocketResponse } from "../../lib/types"
import { sendRequest } from "../client"
import { pageContent, pageTitle } from "../elements"
import { createLeaveGameDialog } from "./leaveGameDialog"

export function renderPendingGame(
  ws: WebSocket,
  game: Extract<
    Extract<SocketResponse, { key: "game_state" }>["game"],
    { started: false }
  >,
  userId: string
) {
  let creator = game.players[0]!
  let isCreator = userId == creator.id
  pageTitle.textContent = isCreator ? "Your Game" : `${creator.name}'s Game`

  let waitingRoom = document.createElement("div")
  waitingRoom.classList.add("waiting-room")

  let title = document.createElement("h2")
  waitingRoom.append(title)

  let admittedCount = 0
  let pendingCount = 0

  let playerList = document.createElement("ul")
  playerList.append(
    ...game.players.flatMap(p => {
      let li = document.createElement("li")

      if (p.pending) {
        pendingCount++

        if (!isCreator) return []

        let name = document.createElement("p")
        name.textContent = p.name

        let message = document.createElement("small")
        message.textContent = p.message ?? ""

        let text = document.createElement("div")
        text.append(name, message)

        let rejectButton = document.createElement("button")
        rejectButton.textContent = "Reject"
        rejectButton.classList.add("red-text")
        rejectButton.addEventListener("click", () => {
          sendRequest(ws, { key: "deny_join_request", userId: p.id })
          li.remove()
        })

        let admitButton = document.createElement("button")
        admitButton.textContent = "Admit to Game"
        admitButton.addEventListener("click", () => {
          sendRequest(ws, { key: "accept_join_request", userId: p.id })
          li.remove()
        })

        let buttons = document.createElement("div")
        buttons.append(rejectButton, admitButton)

        li.append(text, buttons)
      } else {
        admittedCount++

        let name = document.createElement("span")
        name.textContent = p.name

        let check = document.createElement("span")
        check.textContent = "✅"
        check.style.fontSize = "1.25rem"

        li.append(name, check)
      }

      return li
    })
  )

  let pendingText = document.createElement("p")

  if (game.players.some(p => p.id == userId && p.pending)) {
    title.textContent = "Awaiting Response..."
    pendingText.textContent =
      "Your join request has been submitted. You'll be notified when the host responds."
    waitingRoom.append(pendingText)
  } else {
    title.textContent = "Players"
    waitingRoom.append(playerList)

    if (isCreator) {
      if (pendingCount) title.textContent += ` (${pendingCount} pending)`

      if (admittedCount > 1) {
        let startButton = document.createElement("button")
        startButton.textContent = "Start Game"
        startButton.classList.add("btn")
        startButton.addEventListener("click", () =>
          sendRequest(ws, { key: "start_game" })
        )
        waitingRoom.append(startButton)
      } else {
        pendingText.textContent = "Waiting for more players..."
        waitingRoom.append(pendingText)
      }
    } else {
      pendingText.textContent = "Waiting for the host to start the game..."
      waitingRoom.append(pendingText)
    }
  }

  waitingRoom.append(createLeaveGameDialog(ws))
  pageContent.innerHTML = ""
  pageContent.append(waitingRoom)
}
