import { Page } from "../api/search"
import type { SocketRequest, SocketResponse } from "../api/ws"
import { hasChars } from "../lib/utils"
import "../style/global.css"
import { callAPI, gameEmitter, localToken } from "./client"
import {
  admittedPlayerList,
  answerValidator,
  answerValidatorDialog,
  answerValidatorDialogTitle,
  availableGamesList,
  challengeContainer,
  gameStateContainer,
  gameSubtitle,
  giveUpContainer,
  joinRequestForm,
  leaveGameDialogButton,
  lineBreak,
  lobbyContainer,
  main,
  pageTitle,
  pendingPlayerList,
  pendingText,
  roundsContainer,
  scoreContainer,
  searchContainer,
  spinner,
  startGameButton,
  validAnswerButton,
  waitingRoom
} from "./elements"
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

  let pendingGameId: string | null = null

  pageTitle.textContent = "Lobby"
  answerValidator.remove()
  gameStateContainer.remove()
  waitingRoom.remove()

  ws.onerror = () => {
    localToken.remove()
    ws.close()
    init()
  }

  ws.onmessage = event => {
    let res: SocketResponse = JSON.parse(event.data)

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
      lobbyContainer.remove()

      let creator = res.game.players[0]!
      let isCreator = userId == creator.id

      pageTitle.textContent = isCreator ? "Your Game" : `${creator.name}'s Game`

      // -------------------- Active Game --------------------
      if (res.game.started) {
        waitingRoom.remove()
        pendingText.remove()

        if (!main.contains(gameStateContainer))
          pageTitle.after(gameStateContainer)

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

        if (!main.contains(gameSubtitle)) scoreContainer.after(gameSubtitle)

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
          gameStateContainer.append(searchContainer)

          if (previousAnswer)
            gameSubtitle.textContent += ` ${category == "actor" ? "from" : "starring"} ${previousAnswer.title}${"releaseYear" in previousAnswer ? ` (${previousAnswer.releaseYear})` : ""}`
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

            gameStateContainer.append(answerValidator)
          }
        }

        // -------------------- You've Been Challenged --------------------
        else if (status == "challenged") {
          pageTitle.textContent = "You've been challenged!"
          let giveUpButton = document.createElement("button")
          giveUpButton.textContent = "Give Up"
          giveUpButton.classList.add("red-text")
          giveUpButton.addEventListener("click", () => {
            sendRequest(ws, { key: "give_up" })
          })
          giveUpContainer.append("Can't think of anything?", giveUpButton)
          gameStateContainer.append(giveUpContainer)
        }

        // -------------------- You're Reviewing --------------------
        else if (status == "reviewing") {
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

            gameStateContainer.append(answerValidator)
          }
        }

        // -------------------- Someone Else's Turn --------------------
        else if (!status) {
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

        gameStateContainer.append(roundsContainer, leaveGameDialogButton)
      }

      // -------------------- Pending Game --------------------
      else {
        if (!main.contains(waitingRoom)) pageTitle.after(waitingRoom)

        pendingText.remove()

        if (res.game.players.some(p => p.id == userId && p.pending)) {
          pageTitle.textContent = "Awaiting Response..."
          pendingText.textContent =
            "Your join request has been submitted and you will be " +
            "notified when the host accepts or rejects your request."
          waitingRoom.after(pendingText)
        } else if (!isCreator) {
          pendingText.textContent = "Waiting for the host to start the game..."
          waitingRoom.after(pendingText)
        }

        admittedPlayerList.innerHTML = ""
        let admittedPlayers = res.game.players.flatMap(p => {
          if (p.pending) return []
          let li = document.createElement("li")
          li.textContent = p.name
          return li
        })
        admittedPlayerList.append(...admittedPlayers)

        if (!isCreator) return

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
          rejectButton.addEventListener("click", () => {
            sendRequest(ws, { key: "deny_join_request", userId: p.id })
            li.remove()
          })
          let admitButton = document.createElement("button")
          admitButton.textContent = "Admit"
          admitButton.addEventListener("click", () => {
            sendRequest(ws, { key: "accept_join_request", userId: p.id })
            li.remove()
          })
          buttons.append(rejectButton, admitButton)

          li.append(text, buttons)

          return li
        })

        pendingPlayerList.innerHTML = ""
        if (pendingPlayers.length) pendingPlayerList.append(...pendingPlayers)

        pendingPlayerList.after(leaveGameDialogButton)

        if (admittedPlayers.length > 1 && !main.contains(startGameButton))
          pendingPlayerList.after(startGameButton)
      }
    }

    // -------------------- Available Games --------------------
    else if (res.key == "available_games") {
      if (!main.contains(lobbyContainer)) pageTitle.after(lobbyContainer)

      availableGamesList.innerHTML = ""
      if (res.games.length == 0) {
        availableGamesList.innerHTML = "<p>No available games</p>"
        return
      }

      availableGamesList.append(
        ...res.games.map(game => {
          let gameName = `${game.creatorName}'s Game`

          let li = document.createElement("li")

          let button = document.createElement("button")
          button.textContent = "Request to Join"

          button.addEventListener("click", () => {
            lobbyContainer.remove()
            pageTitle.textContent = `Request to Join ${gameName}`
            pageTitle.after(joinRequestForm)
            pendingGameId = game.id
          })

          li.append(gameName, button)
          return li
        })
      )
    }

    // -------------------- Join Request Accepted --------------------
    else if (res.key == "join_request_accepted")
      showToast("You've been admitted 😁")
    // -------------------- Join Request Denied --------------------
    else if (res.key == "join_request_denied") {
      waitingRoom.remove()
      pendingText.remove()
      showToast("Your join request was denied 😔")
      localToken.remove()
      ws.close()
      init()
    }

    // -------------------- Toast --------------------
    else if (res.key == "toast") showToast(res.message)
    // -------------------- Error --------------------
    else if (res.key == "error") showToast(`Error: ${res.message}`)
  }

  gameEmitter.listen(data => {
    if (data.key == "create_game") sendRequest(ws, data)
    else if (data.key == "start_game") sendRequest(ws, data)
    else if (data.key == "mark_answer_incorrect") sendRequest(ws, data)
    else if (data.key == "leave_game") {
      if (userId) sendRequest(ws, { key: "leave_game", userId })
      localToken.remove()
      ws.close()
      init()
    } else if (data.key == "request_to_join") {
      if (pendingGameId) sendRequest(ws, { ...data, gameId: pendingGameId })
    }
  })
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
