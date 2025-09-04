import { Page } from "../api/search"
import type { SocketRequest, SocketResponse } from "../api/ws"
import { hasChars } from "../lib/utils"
import "../style/global.css"
import { callAPI, localToken } from "./client"
import { lineBreak, pageTitle, spinner } from "./elements"
import { initUI, showToast } from "./ui"

if (location.pathname != "/") location.replace(location.origin)

initUI()
init()

function init() {
  let token = localToken.get()
  let userId = getUserIdFromToken(token)

  let ws = new WebSocket(
    `${location.protocol.replace(
      "http",
      "ws"
    )}//${location.host}/ws${token ? `?token=${token}` : ""}`
  )

  let availableGames: Array<{ creatorName: string; id: string }> = []
  let pendingGameId: string | null = null

  let pageContent = document.createElement("div")
  pageTitle.after(pageContent)

  ws.onerror = () => {
    localToken.remove()
    ws.close()
    init()
  }

  ws.onmessage = event => {
    let res: SocketResponse = JSON.parse(event.data)

    pageContent.innerHTML = ""

    // -------------------- Token --------------------
    if (res.key == "token") {
      localToken.set(res.token)
      ws.close()
      init()
    } else if (res.key == "invalid_token") {
      localToken.remove()
      ws.close()
      init()
    }

    // -------------------- Game State --------------------
    else if (res.key == "game_state") {
      let creator = res.game.players[0]!
      let isCreator = userId == creator.id

      pageTitle.textContent = isCreator ? "Your Game" : `${creator.name}'s Game`
      let gameSubtitle = document.createElement("h2")

      // -------------------- Active Game --------------------
      if (res.game.started) {
        let scoreContainer = document.createElement("ul")
        scoreContainer.classList.add("score-container")

        pageContent.append(scoreContainer, gameSubtitle)

        let roundsContainer = document.createElement("ol")

        let searchContainer = document.createElement("div")
        searchContainer.classList.add("search-container")

        let challengeContainer = document.createElement("div")
        let answerValidator = document.createElement("div")
        let giveUpContainer = document.createElement("div")

        let answerValidatorDialog = document.createElement("dialog")
        answerValidatorDialog.classList.add("validator-dialog")
        let answerValidatorDialogContent = document.createElement("div")
        let answerValidatorDialogTitle = document.createElement("h1")
        let answerValidatorDialogButtons = document.createElement("div")
        answerValidatorDialogButtons.classList.add("dialog-button-container")
        let validAnswerButton = document.createElement("button")
        validAnswerButton.textContent = "Yes, it was a valid answer"
        validAnswerButton.autofocus = true
        validAnswerButton.addEventListener("click", () => {
          answerValidatorDialog.close()
          answerValidatorDialog.remove()
        })
        let invalidAnswerButton = document.createElement("button")
        invalidAnswerButton.classList.add("red-text")
        invalidAnswerButton.textContent =
          "No, give the previous player a letter"
        invalidAnswerButton.addEventListener("click", () => {
          sendRequest(ws, { key: "mark_answer_incorrect" })
          answerValidatorDialog.close()
          answerValidatorDialog.remove()
        })
        answerValidatorDialogButtons.append(
          validAnswerButton,
          invalidAnswerButton
        )
        answerValidatorDialog.addEventListener("click", e => {
          if (e.target == answerValidatorDialog) answerValidatorDialog.close()
        })
        answerValidatorDialogContent.append(
          answerValidatorDialogTitle,
          answerValidatorDialogButtons
        )
        answerValidatorDialog.append(answerValidatorDialogContent)

        scoreContainer.innerHTML = ""
        scoreContainer.append(
          ...res.game.players.map(p => {
            let li = document.createElement("li")
            let nameContainer = document.createElement("span")
            nameContainer.innerHTML = p.name
            let lettersContainer = document.createElement("div")
            lettersContainer.append(
              ...["B", "O", "M", "B"].map((letter, i) => {
                let span = document.createElement("span")
                span.innerHTML = letter
                if (p.letters > i) span.classList.add("red-text")
                return span
              })
            )
            li.append(nameContainer, lettersContainer)
            return li
          })
        )

        let player = res.game.players.find(p => p.id == userId)!
        let status = player.status
        let currentRound = res.game.rounds[0]!
        let previousRounds = res.game.rounds.slice(1)
        let previousAnswer = currentRound.at(-1)
        let allAnswers = res.game.rounds.flatMap(r => r)
        let category: "actor" | "movie" =
          previousAnswer && "releaseYear" in previousAnswer ? "actor" : "movie"

        challengeContainer.innerHTML = ""
        challengeContainer.remove()
        searchContainer.innerHTML = ""
        searchContainer.remove()
        giveUpContainer.innerHTML = ""
        giveUpContainer.remove()

        // -------------------- Your Turn --------------------
        if (status) {
          gameSubtitle.textContent = `Name ${category == "actor" ? "an actor" : "a movie"}`

          let searchLabel = document.createElement("label")
          let searchInput = document.createElement("input")
          searchInput.autofocus = true
          let searchResults = document.createElement("ul")
          let searchInputTimeout: null | ReturnType<typeof setTimeout> = null
          searchLabel.append(`Search ${category}s`, searchInput)
          searchInput.addEventListener("input", () => {
            if (searchInputTimeout) clearTimeout(searchInputTimeout)
            searchInputTimeout = setTimeout(async () => {
              let query = searchInput.value.trim()
              searchResults.innerHTML = ""
              if (!hasChars(query, 3)) return
              searchResults.append(spinner)
              let results = await callAPI<Array<Page>>(
                `search/${category}?q=${query}`
              )
              if (results.length == 0) {
                searchResults.innerHTML = "<p>No results, please try again</p>"
                return
              }
              searchResults.innerHTML = ""
              searchResults.append(
                ...results.map(page => {
                  let li = document.createElement("li")
                  let text = document.createElement("div")
                  let title = document.createElement("span")
                  title.textContent = page.title.split(" (")[0]!
                  let year = document.createElement("small")
                  year.textContent =
                    "birthYear" in page
                      ? page.birthYear.toString()
                      : page.releaseYear.toString()
                  text.append(title, year)
                  if (allAnswers.some(a => a.pageid == page.pageid)) {
                    let check = document.createElement("span")
                    check.textContent = "✅"
                    check.style.fontSize = "1.25rem"
                    li.append(text, check)
                    return li
                  }
                  let button = document.createElement("button")
                  button.textContent = "Select"
                  button.addEventListener("click", () => {
                    sendRequest(ws, { key: "play_move", page })
                    searchContainer.remove()
                  })
                  li.append(text, button)
                  return li
                })
              )
            }, 600)
          })
          searchContainer.append(searchLabel, searchResults)
          pageContent.append(searchContainer)

          if (previousAnswer)
            gameSubtitle.textContent += ` ${
              category == "actor" ? "from" : "starring"
            } ${previousAnswer.title}${
              "releaseYear" in previousAnswer
                ? ` (${previousAnswer.releaseYear})`
                : ""
            }`
        }

        // -------------------- Regular Turn --------------------
        if (status == "active") {
          pageTitle.textContent = "It's your turn!"

          if (previousAnswer) {
            let challengeButton = document.createElement("button")
            challengeButton.textContent = "Challenge Previous Player"
            challengeButton.classList.add("red-text")
            challengeButton.addEventListener("click", () => {
              sendRequest(ws, { key: "challenge" })
            })
            challengeContainer.append(
              "Can't think of anything?",
              challengeButton
            )
            searchContainer.after(challengeContainer)
          }

          let priorAnswer = currentRound.at(-2)
          if (previousAnswer && priorAnswer) {
            let { actor, movie } =
              "releaseYear" in previousAnswer
                ? { actor: priorAnswer, movie: previousAnswer }
                : "releaseYear" in priorAnswer
                  ? { actor: previousAnswer, movie: priorAnswer }
                  : { actor: null, movie: null }
            if (!actor || !movie) return
            let query = `was ${actor.title} in ${movie.title} (${movie.releaseYear})?`

            let searchLink = document.createElement("a")
            searchLink.textContent = `Search "${query}"`
            searchLink.setAttribute("target", "_blank")
            searchLink.setAttribute("rel", "noopener")
            searchLink.setAttribute(
              "href",
              `https://www.google.com/search?q=${query}`
            )
            answerValidatorDialogTitle.textContent = `So, ${query}`
            searchLink.addEventListener("click", () => {
              document.body.append(answerValidatorDialog)
              answerValidatorDialog.showModal()
            })

            answerValidator.innerHTML = ""
            answerValidator.append(
              "Think the previous answer was incorrect?",
              searchLink
            )

            pageContent.append(answerValidator)
          }
        }

        // -------------------- You've Been Challenged --------------------
        else if (status == "challenged") {
          answerValidator.remove()
          pageTitle.textContent = "You've been challenged!"
          let giveUpButton = document.createElement("button")
          giveUpButton.textContent = "Give Up"
          giveUpButton.classList.add("red-text")
          giveUpButton.addEventListener("click", () => {
            sendRequest(ws, { key: "give_up" })
          })
          giveUpContainer.append("Can't think of anything?", giveUpButton)
          pageContent.append(giveUpContainer)
        }

        // -------------------- You're Reviewing --------------------
        else if (status == "reviewing") {
          answerValidator.remove()
          pageTitle.textContent = "Your challenge was answered!"
          gameSubtitle.textContent = "Is this response correct?"
          searchContainer.remove()
          let priorAnswer = currentRound.at(-2)
          if (previousAnswer && priorAnswer) {
            let { actor, movie } =
              "releaseYear" in previousAnswer
                ? { actor: priorAnswer, movie: previousAnswer }
                : "releaseYear" in priorAnswer
                  ? { actor: previousAnswer, movie: priorAnswer }
                  : { actor: null, movie: null }
            if (!actor || !movie) return
            let query = `was ${actor.title} in ${movie.title} (${movie.releaseYear})?`

            let searchLink = document.createElement("a")
            searchLink.textContent = `Search "${query}"`
            searchLink.setAttribute("target", "_blank")
            searchLink.setAttribute("rel", "noopener")
            searchLink.setAttribute(
              "href",
              `https://www.google.com/search?q=${query}`
            )
            answerValidatorDialogTitle.textContent = `So, ${query}`
            validAnswerButton.addEventListener("click", () => {
              sendRequest(ws, { key: "mark_answer_correct" })
            })
            searchLink.addEventListener("click", () => {
              document.body.append(answerValidatorDialog)
              answerValidatorDialog.showModal()
            })

            answerValidator.innerHTML = ""
            answerValidator.append(searchLink)

            pageContent.append(answerValidator)
          }
        }

        // -------------------- Someone Else's Turn --------------------
        else if (!status) {
          answerValidator.remove()
          let challengedPlayer = res.game.players.find(
            p => p.status == "challenged"
          )
          gameSubtitle.textContent = challengedPlayer
            ? `${challengedPlayer.name} has been challenged!`
            : `${res.game.players.find(p => p.status == "active")!.name} is thinking...`
        }

        let activePlayers = res.game.players.filter(
          p => !p.letters || p.letters < 4
        )
        let winner = activePlayers.length == 1 ? activePlayers[0] : null

        // -------------------- Game Over --------------------
        if (winner) {
          let isWinner = winner.id == userId
          pageTitle.textContent = "Game Over"
          gameSubtitle.textContent = isWinner
            ? "Congratulations, you're the winner!"
            : `${winner.name} wins, better luck next time!`
          searchContainer.remove()
        }

        roundsContainer.innerHTML = ""

        if (currentRound.length) {
          let currentRoundText = document.createElement("p")
          currentRoundText.innerHTML = currentRound.reduce((acc, p) => {
            return acc ? `${acc} &rarr; ${p.title}` : p.title
          }, "")
          roundsContainer.append("Current round:", lineBreak, currentRoundText)
        }

        let previousRoundContainer = document.createElement("div")
        let previousRoundList = document.createElement("div")
        if (previousRounds.length) {
          previousRoundList.append(
            ...previousRounds.map(round => {
              let text = document.createElement("p")
              text.innerHTML = round.reduce((acc, p) => {
                return acc ? `${acc} &rarr; ${p.title}` : p.title
              }, "")
              return text
            })
          )
          previousRoundContainer.append(
            lineBreak,
            "Previous rounds:",
            lineBreak,
            previousRoundList
          )
          roundsContainer.append(lineBreak, previousRoundContainer)
        }

        pageContent.append(roundsContainer, getLeaveGameButton())
      }

      // -------------------- Pending Game --------------------
      else {
        let waitingRoom = document.createElement("div")
        waitingRoom.classList.add("waiting-room")

        let waitingRoomTitle = document.createElement("h2")
        waitingRoom.append(waitingRoomTitle)

        pageContent.innerHTML = ""
        pageContent.append(waitingRoom)

        let pending = res.game.players.some(p => p.id == userId && p.pending)

        let pendingText = document.createElement("p")

        if (pending) {
          waitingRoomTitle.textContent = "Awaiting Response..."

          pendingText.textContent =
            "Your join request has been submitted and you will be " +
            "notified when the host accepts or rejects your request."

          waitingRoom.append(pendingText)
        } else waitingRoomTitle.textContent = "Players"

        let playerListContainer = document.createElement("div")

        let playerList = document.createElement("ul")
        playerListContainer.append(waitingRoomTitle, playerList)
        if (!pending) waitingRoom.append(playerListContainer)
        if (!pending && !isCreator) {
          pendingText.textContent = "Waiting for the host to start the game..."
          waitingRoom.append(pendingText)
        }

        let admittedPlayers = res.game.players.flatMap(p => {
          if (p.pending) return []
          let li = document.createElement("li")

          let name = document.createElement("span")
          name.textContent = p.name

          let check = document.createElement("span")
          check.textContent = "✅"
          check.style.fontSize = "1.25rem"

          li.append(name, check)

          return li
        })
        playerList.append(...admittedPlayers)

        let pendingPlayers = res.game.players.flatMap(p => {
          if (!p.pending) return []

          let li = document.createElement("li")

          let text = document.createElement("div")
          let name = document.createElement("p")
          name.textContent = p.name
          let message = document.createElement("small")
          message.textContent = p.message ?? ""
          text.append(name, message)

          let buttons = document.createElement("div")
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
          buttons.append(rejectButton, admitButton)

          li.append(text, buttons)

          return li
        })

        playerList.append(...pendingPlayers)

        if (isCreator) {
          if (pendingPlayers.length)
            waitingRoomTitle.textContent += ` (${pendingPlayers.length} pending)`

          if (admittedPlayers.length > 1) {
            let startGameButton = document.createElement("button")
            startGameButton.classList.add("btn")
            startGameButton.textContent = "Start Game"
            startGameButton.addEventListener("click", () => {
              sendRequest(ws, { key: "start_game" })
            })
            waitingRoom.append(startGameButton)
          } else {
            pendingText.textContent =
              "Waiting for more players to be admitted..."
            waitingRoom.append(pendingText)
          }
        }

        waitingRoom.append(getLeaveGameButton())
      }
    }

    // -------------------- Available Games --------------------
    else if (res.key == "available_games") {
      availableGames = res.games

      if (!pendingGameId) renderLobby()
    }

    // -------------------- Join Request Denied --------------------
    else if (res.key == "join_request_denied") {
      showToast("Your join request was denied")
      localToken.remove()
      ws.close()
      init()
    }

    // -------------------- Toast --------------------
    else if (res.key == "toast") showToast(res.message)
    // -------------------- Error --------------------
    else if (res.key == "error") showToast(`Error: ${res.message}`)
  }

  function getLeaveGameButton() {
    let leaveGameDialog = document.createElement("dialog")
    let leaveGameDialogContent = document.createElement("div")

    let leaveGameDialogTitle = document.createElement("h1")
    leaveGameDialogTitle.textContent = "Leave Game?"

    let leaveGameDialogButtons = document.createElement("div")
    leaveGameDialogButtons.classList.add("dialog-button-container")

    let stayInGameButton = document.createElement("button")
    stayInGameButton.textContent = "No, stay in game"
    stayInGameButton.type = "button"
    stayInGameButton.autofocus = true
    stayInGameButton.addEventListener("click", () => {
      leaveGameDialog.close()
      leaveGameDialog.remove()
    })

    let leaveGameButton = document.createElement("button")
    leaveGameButton.classList.add("red-text")
    leaveGameButton.textContent = "Yes, permanently leave"
    leaveGameButton.type = "button"
    leaveGameButton.addEventListener("click", () => {
      pageContent.innerHTML = ""
      pendingGameId = null
      localToken.remove()

      sendRequest(ws, { key: "leave_game" })
      ws.close()
      init()

      leaveGameDialog.close()
      leaveGameDialog.remove()
    })

    leaveGameDialogButtons.append(stayInGameButton, leaveGameButton)

    leaveGameDialog.addEventListener("click", e => {
      if (e.target == leaveGameDialog) leaveGameDialog.close()
    })

    leaveGameDialogContent.append(leaveGameDialogTitle, leaveGameDialogButtons)

    leaveGameDialog.append(leaveGameDialogContent)

    let leaveGameDialogButton = document.createElement("button")
    leaveGameDialogButton.textContent = "Leave Game"
    leaveGameDialogButton.classList.add("red-text")
    leaveGameDialogButton.addEventListener("click", () => {
      document.body.append(leaveGameDialog)
      leaveGameDialog.showModal()
    })

    return leaveGameDialogButton
  }

  function renderLobby() {
    pageTitle.textContent = "Lobby"

    let lobby = document.createElement("div")
    lobby.classList.add("lobby")

    let createGameTitle = document.createElement("h2")
    createGameTitle.textContent = "Create New Game"

    let createGameForm = document.createElement("form")

    let createGameInput = document.createElement("input")
    createGameInput.required = true
    createGameInput.maxLength = 20

    let createGameLabel = document.createElement("label")
    createGameLabel.append("Your name", createGameInput)

    let createGameButton = document.createElement("button")
    createGameButton.classList.add("btn")
    createGameButton.textContent = "Create Game"
    createGameButton.type = "submit"

    createGameForm.append(createGameLabel, createGameButton)

    createGameForm.addEventListener("submit", e => {
      e.preventDefault()

      let name = createGameInput.value.trim()

      if (!name) {
        createGameInput.value = ""
        createGameInput.focus()
        return
      }

      sendRequest(ws, { key: "create_game", name })

      createGameForm.remove()
    })

    let availableGamesTitle = document.createElement("h2")
    availableGamesTitle.textContent = "Available Games"

    let availableGamesList = document.createElement("ul")

    let emptyGamesText = document.createElement("p")
    emptyGamesText.textContent = "No available games"

    availableGamesList.append(
      ...availableGames.map(game => {
        let gameName = `${game.creatorName}'s Game`

        let li = document.createElement("li")

        let gameTitle = document.createElement("span")
        gameTitle.textContent = gameName

        let button = document.createElement("button")
        button.textContent = "Request to Join"

        button.addEventListener("click", () => {
          pageTitle.textContent = `Request to Join ${gameName}`
          pageContent.innerHTML = ""

          let form = document.createElement("form")
          form.classList.add("request-to-join-form")

          let nameInput = document.createElement("input")
          nameInput.autofocus = true
          nameInput.maxLength = 20
          nameInput.required = true

          let nameLabel = document.createElement("label")
          nameLabel.append("Your name", nameInput)

          let messageTextarea = document.createElement("textarea")
          messageTextarea.maxLength = 300

          let messageLabel = document.createElement("label")
          messageLabel.append("Message (optional)", messageTextarea)

          let cancelButton = document.createElement("button")
          cancelButton.textContent = "Cancel"
          cancelButton.classList.add("red-text")
          cancelButton.type = "button"
          cancelButton.addEventListener("click", () => {
            pendingGameId = null
            renderLobby()
          })

          let submitButton = document.createElement("button")
          submitButton.classList.add("btn")
          submitButton.textContent = "Send Request"
          submitButton.type = "submit"

          form.addEventListener("submit", e => {
            e.preventDefault()

            if (
              !pendingGameId ||
              !availableGames.some(g => g.id == pendingGameId)
            ) {
              showToast("Unable to connect to game")
              renderLobby()
              return
            }

            let name = nameInput.value.trim()

            if (!name) {
              nameInput.value = ""
              nameInput.focus()
              return
            }

            let message = messageTextarea.value.trim()

            nameInput.value = ""
            messageTextarea.value = ""

            sendRequest(ws, {
              key: "request_to_join",
              gameId: pendingGameId,
              message,
              name
            })

            form.remove()
          })

          form.append(nameLabel, messageLabel, submitButton, cancelButton)

          pageContent.append(form)
          pendingGameId = game.id
        })

        li.append(gameTitle, button)

        return li
      })
    )

    lobby.append(
      createGameTitle,
      createGameForm,
      availableGamesTitle,
      availableGames.length ? availableGamesList : emptyGamesText
    )

    pageContent.innerHTML = ""
    pageContent.append(lobby)
  }
}

function getTokenPayload(value: unknown): unknown {
  if (!hasChars(value)) return null

  let [header, payload, signature] = value.split(".")
  if (!header || !payload || !hasChars(signature)) return null

  try {
    JSON.parse(atob(header))
    return JSON.parse(atob(payload))
  } catch (error) {
    return null
  }
}

function getUserIdFromToken(token: unknown) {
  let tokenPayload = getTokenPayload(token)
  return tokenPayload &&
    typeof tokenPayload == "object" &&
    "userId" in tokenPayload &&
    hasChars(tokenPayload.userId)
    ? tokenPayload.userId
    : null
}

function sendRequest(ws: WebSocket, req: SocketRequest) {
  if (ws.readyState == WebSocket.OPEN) ws.send(JSON.stringify(req))
}
