import type { Page, SocketResponse } from "../../lib/types"
import { hasChars } from "../../lib/utils"
import { callAPI, sendRequest, wrapLabel } from "../client"
import { pageContent, pageTitle, spinner } from "../elements"
import { createLeaveGameDialog } from "./leaveGameDialog"

export function renderActiveGame(
  ws: WebSocket,
  game: ActiveGame,
  userId: string
) {
  let creator = game.players[0]!
  let isCreator = userId == creator.id

  pageTitle.textContent = isCreator ? "Your Game" : `${creator.name}'s Game`
  pageContent.innerHTML = ""

  let gameSubtitle = document.createElement("h2")
  let scoreContainer = createScoreboard(game)
  pageContent.append(scoreContainer, gameSubtitle)

  let currentRound = game.rounds[0] ?? []
  let previousAnswer = currentRound.at(-1)
  let allAnswers = game.rounds.flatMap(r => r)

  let { status } = game.players.find(p => p.id == userId)!

  let activePlayers = game.players.filter(p => p.letters < 4)
  let winner = activePlayers.length == 1 ? activePlayers[0]! : null

  // -------------------- Game Over --------------------
  if (winner) {
    pageTitle.textContent = "Game Over"
    gameSubtitle.textContent =
      winner.id == userId
        ? "Congratulations, you're the winner!"
        : `${winner.name} wins. Better luck next time!`
  }

  // -------------------- Active or Challenged --------------------
  else if (status == "active" || status == "challenged") {
    gameSubtitle.textContent = `Name ${
      previousAnswer && "releaseYear" in previousAnswer
        ? `an actor from ${previousAnswer.title} (${previousAnswer.releaseYear})`
        : `a movie${previousAnswer ? ` starring ${previousAnswer.title}` : ""}`
    }`

    renderSearchForm(ws, allAnswers, previousAnswer)

    // -------------------- Active --------------------
    if (status == "active") {
      pageTitle.textContent = "It's your turn!"

      renderValidateAnswerDialog(ws, currentRound, false)

      if (previousAnswer) {
        let challengeButton = document.createElement("button")
        challengeButton.textContent = "Challenge Previous Player"
        challengeButton.classList.add("red")
        challengeButton.addEventListener("click", () => {
          sendRequest(ws, { key: "challenge" })
        })
        pageContent.append(challengeButton)
      }

      // -------------------- Challenged --------------------
    } else {
      pageTitle.textContent = "You've been challenged!"

      let giveUpButton = document.createElement("button")
      giveUpButton.textContent = "Give Up"
      giveUpButton.classList.add("red")
      giveUpButton.addEventListener("click", () =>
        sendRequest(ws, { key: "give_up" })
      )
      pageContent.append(giveUpButton)
    }

    // -------------------- Reviewing --------------------
  } else if (status == "reviewing") {
    pageTitle.textContent = "Your challenge was answered!"
    gameSubtitle.textContent = "Is this response correct?"
    renderValidateAnswerDialog(ws, currentRound, true)

    // -------------------- Idle --------------------
  } else {
    let player = game.players.find(p => p.status)!
    gameSubtitle.textContent =
      player.status == "reviewing"
        ? `${player.name} is reviewing the challenge response`
        : player.status == "challenged"
          ? `${player.name} has been challenged!`
          : `It's ${player.name}'s turn`
  }

  pageContent.append(
    createRounds(game.rounds, !winner),
    createLeaveGameDialog(ws)
  )
}

function renderValidateAnswerDialog(
  ws: WebSocket,
  currentRound: Array<Page>,
  reviewingChallengeResponse: boolean
) {
  let previousAnswer = currentRound.at(-1)
  let priorAnswer = currentRound.at(-2)

  let { actor, movie } =
    priorAnswer && "releaseYear" in priorAnswer
      ? { actor: previousAnswer, movie: priorAnswer }
      : previousAnswer && "releaseYear" in previousAnswer
        ? { actor: priorAnswer, movie: previousAnswer }
        : { actor: null, movie: null }

  if (!actor || !movie) return

  let dialog = document.createElement("dialog")
  dialog.addEventListener("click", e => {
    if (e.target == dialog) dialog.close()
  })

  let query = `was ${actor.title} in ${movie.title} (${movie.releaseYear})?`

  let title = document.createElement("h1")
  title.textContent = `So, ${query}`

  let valid = document.createElement("button")
  valid.textContent = "Yes, correct"
  valid.autofocus = true
  valid.addEventListener("click", () => {
    if (reviewingChallengeResponse)
      sendRequest(ws, { key: "mark_answer_correct" })
    dialog.close()
    dialog.remove()
  })

  let invalid = document.createElement("button")
  invalid.classList.add("red")
  invalid.textContent = "No, incorrect"
  invalid.addEventListener("click", () => {
    sendRequest(ws, { key: "mark_answer_incorrect" })
    dialog.close()
    dialog.remove()
  })

  let buttons = document.createElement("div")
  buttons.classList.add("dialog-button-container")
  buttons.append(invalid, valid)

  let content = document.createElement("div")
  content.append(title, buttons)
  dialog.append(content)

  let link = document.createElement("a")
  link.textContent = `Search "${query}"`
  link.setAttribute("target", "_blank")
  link.setAttribute("rel", "noopener")
  link.setAttribute(
    "href",
    `https://www.google.com/search?q=${encodeURIComponent(query)}`
  )
  link.addEventListener("click", () => {
    document.body.append(dialog)
    dialog.showModal()
  })

  pageContent.append(link)
}

function createScoreboard(game: ActiveGame) {
  let ul = document.createElement("ul")
  ul.classList.add("score-container")

  ul.append(
    ...game.players.map(p => {
      let li = document.createElement("li")
      let name = document.createElement("span")
      name.textContent = p.name

      let letters = document.createElement("div")
      letters.append(
        ..."BOMB".split("").map((letter, i) => {
          let span = document.createElement("span")
          span.textContent = letter
          if (p.letters > i) span.classList.add("red")
          return span
        })
      )

      li.append(name, letters)
      return li
    })
  )

  return ul
}

function createRounds(
  [current = [], ...previous]: Array<Array<Page>>,
  includeCurrent: boolean
) {
  let container = document.createElement("div")
  container.classList.add("game-rounds")

  if (includeCurrent) container.append(createRound(current, "Current Round"))

  if (previous.length)
    previous.forEach((round, i) => {
      container.append(createRound(round, `Round ${previous.length - i}`))
    })

  return container
}

function createRound(round: Array<Page>, label: string) {
  let fieldSet = document.createElement("fieldset")
  fieldSet.classList.add("round-box")

  let heading = document.createElement("legend")
  heading.textContent = label

  if (round.length == 0) {
    let text = document.createElement("p")
    text.textContent = "Waiting for the first movie..."
    fieldSet.append(heading, text)
    return fieldSet
  }

  let entries = document.createElement("div")
  entries.classList.add("round-entries")

  for (let { title } of round) {
    let entry = document.createElement("div")
    entry.classList.add("round-entry")
    entry.textContent = title
    entries.hasChildNodes() ? entries.append("→", entry) : entries.append(entry)
  }

  fieldSet.append(heading, entries)
  return fieldSet
}

function renderSearchForm(
  ws: WebSocket,
  allAnswers: Array<Page>,
  previousAnswer: Page | undefined
) {
  let container = document.createElement("div")
  container.classList.add("search-container")

  let input = document.createElement("input")
  input.autofocus = true

  let results = document.createElement("ul")
  let timeout: ReturnType<typeof setTimeout> | null = null

  let category =
    previousAnswer && "releaseYear" in previousAnswer ? "actor" : "movie"

  input.addEventListener("input", () => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(async () => {
      let query = input.value.trim()
      results.innerHTML = ""
      if (!hasChars(query, 3)) return
      results.append(spinner)

      let pages = await callAPI<Page[]>(`search/${category}?q=${query}`)

      results.innerHTML = pages.length
        ? ""
        : "<p>No results, please try again</p>"

      results.append(
        ...pages.map(page => {
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
            li.append(text, check)
            return li
          }

          let button = document.createElement("button")
          button.textContent = "Select"
          button.addEventListener("click", () => {
            sendRequest(ws, { key: "play_move", page })
            container.remove()
          })

          li.append(text, button)
          return li
        })
      )
    }, 750)
  })

  container.append(wrapLabel(`Search ${category}s`, input), results)
  pageContent.append(container)

  setTimeout(() => {
    input.focus()
  }, 100)
}

type ActiveGame = Extract<
  Extract<SocketResponse, { key: "game_state" }>["game"],
  { started: true }
>
