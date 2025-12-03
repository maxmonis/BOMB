import { Confetti } from "htm-elements/confetti";

import { type Page, type SocketResponse } from "../../lib/types";
import { callAPI, sendRequest, wrapLabel } from "../client";
import { pageContent, pageTitle, spinner } from "../elements";

import { createLeaveGameDialog } from "./leaveGameDialog";

export function renderActiveGame(
  ws: WebSocket,
  game: ActiveGame,
  userId: string,
) {
  const creator = game.players[0]!;
  const isCreator = userId === creator.id;

  pageTitle.textContent = isCreator ? "Your Game" : `${creator.name}'s Game`;
  pageContent.innerHTML = "";

  const scoreboard = createScoreboard(game);
  const gameSubtitle = document.createElement("h2");
  pageContent.append(scoreboard, gameSubtitle);

  const currentRound = game.rounds[0] ?? [];
  const previousAnswer = currentRound.at(-1);
  const allAnswers = game.rounds.flatMap((r) => r);

  const { status } = game.players.find((p) => p.id === userId)!;

  const activePlayers = game.players.filter((p) => p.letters < 4);
  const winner = activePlayers.length === 1 ? activePlayers[0]! : null;

  // -------------------- Game Over --------------------
  if (winner) {
    const isWinner = winner.id === userId;
    if (isWinner) new Confetti().start();

    pageTitle.textContent = "Game Over";
    gameSubtitle.textContent = isWinner
      ? "Congratulations, you're the winner!"
      : `${winner.name} wins. Better luck next time!`;
  }

  // -------------------- Active or Challenged --------------------
  else if (status === "active" || status === "challenged") {
    gameSubtitle.textContent = `Name ${
      previousAnswer && "releaseYear" in previousAnswer
        ? `an actor from ${previousAnswer.title} (${previousAnswer.releaseYear})`
        : `a movie${previousAnswer ? ` starring ${previousAnswer.title}` : ""}`
    }`;

    renderSearchForm(ws, allAnswers, previousAnswer);

    // -------------------- Active --------------------
    if (status === "active") {
      pageTitle.textContent = "It's your turn!";

      renderValidateAnswerDialog(ws, currentRound, false);

      if (previousAnswer) {
        const challengeButton = document.createElement("button");
        challengeButton.addEventListener("click", () => {
          sendRequest(ws, { key: "challenge" });
        });
        challengeButton.classList.add("red");
        challengeButton.textContent = "Challenge Previous Player";
        pageContent.append(challengeButton);
      }

      // -------------------- Challenged --------------------
    } else {
      pageTitle.textContent = "You've been challenged!";

      const giveUpButton = document.createElement("button");
      giveUpButton.addEventListener("click", () =>
        sendRequest(ws, { key: "give_up" }),
      );
      giveUpButton.classList.add("red");
      giveUpButton.textContent = "Give Up";
      pageContent.append(giveUpButton);
    }

    // -------------------- Reviewing --------------------
  } else if (status === "reviewing") {
    pageTitle.textContent = "Your challenge was answered!";
    gameSubtitle.textContent = "Is this response correct?";
    renderValidateAnswerDialog(ws, currentRound, true);

    // -------------------- Idle --------------------
  } else {
    const player = game.players.find((p) => p.status)!;
    gameSubtitle.textContent =
      player.status === "reviewing"
        ? `${player.name} is reviewing the challenge response`
        : player.status === "challenged"
          ? `${player.name} has been challenged!`
          : `It's ${player.name}'s turn`;
  }

  pageContent.append(
    createRounds(game.rounds, !winner),
    createLeaveGameDialog(ws),
  );
}

function renderValidateAnswerDialog(
  ws: WebSocket,
  currentRound: Array<Page>,
  reviewingChallengeResponse: boolean,
) {
  const previousAnswer = currentRound.at(-1);
  const priorAnswer = currentRound.at(-2);

  const { actor, movie } =
    priorAnswer && "releaseYear" in priorAnswer
      ? { actor: previousAnswer, movie: priorAnswer }
      : previousAnswer && "releaseYear" in previousAnswer
        ? { actor: priorAnswer, movie: previousAnswer }
        : { actor: null, movie: null };

  if (!actor || !movie) return;

  const dialog = document.createElement("dialog");
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  const valid = document.createElement("button");
  valid.addEventListener("click", () => {
    if (reviewingChallengeResponse)
      sendRequest(ws, { key: "mark_answer_correct" });
    dialog.close();
    dialog.remove();
  });
  valid.autofocus = true;
  valid.textContent = "Yes, correct";

  const invalid = document.createElement("button");
  invalid.addEventListener("click", () => {
    sendRequest(ws, { key: "mark_answer_incorrect" });
    dialog.close();
    dialog.remove();
  });
  invalid.classList.add("red");
  invalid.textContent = "No, incorrect";

  const buttons = document.createElement("div");
  buttons.classList.add("dialog-button-container");
  buttons.append(invalid, valid);

  const query = `was ${actor.title} in ${movie.title} (${movie.releaseYear})?`;

  const title = document.createElement("h1");
  title.textContent = `So, ${query}`;

  const content = document.createElement("div");
  content.append(title, buttons);
  dialog.append(content);

  const link = document.createElement("a");
  link.addEventListener("click", () => {
    document.body.append(dialog);
    dialog.showModal();
  });
  link.textContent = `Search "${query}"`;
  link.setAttribute(
    "href",
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  );
  link.setAttribute("rel", "noopener");
  link.setAttribute("target", "_blank");

  pageContent.append(link);
}

function createScoreboard(game: ActiveGame) {
  const ul = document.createElement("ul");
  ul.classList.add("score-container");

  ul.append(
    ...game.players.map((player) => {
      const name = document.createElement("span");
      name.textContent = player.name;

      const letters = document.createElement("div");
      letters.append(
        ...["B", "O", "M", "B"].map((letter, i) => {
          const span = document.createElement("span");
          span.textContent = letter;
          if (player.letters > i) span.classList.add("red");
          return span;
        }),
      );

      const li = document.createElement("li");
      li.append(name, letters);
      return li;
    }),
  );

  return ul;
}

function createRounds(
  [current = [], ...previous]: Array<Array<Page>>,
  includeCurrent: boolean,
) {
  const container = document.createElement("div");
  container.classList.add("game-rounds");

  if (includeCurrent) container.append(createRound(current, "Current Round"));

  if (previous.length)
    previous.forEach((round, i) => {
      container.append(createRound(round, `Round ${previous.length - i}`));
    });

  return container;
}

function createRound(round: Array<Page>, label: string) {
  const fieldset = document.createElement("fieldset");

  const legend = document.createElement("legend");
  legend.textContent = label;

  if (round.length === 0) {
    const text = document.createElement("p");
    text.textContent = "Waiting for the first movie...";

    fieldset.append(legend, text);
    return fieldset;
  }

  const entries = document.createElement("div");

  for (const { title } of round) {
    const entry = document.createElement("div");
    entry.textContent = title;
    entries.hasChildNodes()
      ? entries.append("→", entry)
      : entries.append(entry);
  }

  fieldset.append(legend, entries);
  return fieldset;
}

function renderSearchForm(
  ws: WebSocket,
  allAnswers: Array<Page>,
  previousAnswer: Page | undefined,
) {
  const category =
    previousAnswer && "releaseYear" in previousAnswer ? "actor" : "movie";

  const container = document.createElement("div");
  container.classList.add("search-container");

  const results = document.createElement("ul");

  let timeout: ReturnType<typeof setTimeout> | null = null;

  const input = document.createElement("input");
  input.addEventListener("input", () => {
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(async () => {
      results.innerHTML = "";

      const query = input.value.trim();
      if (!query) {
        input.value = "";
        input.focus();
        return;
      }

      results.append(spinner);

      const pages = await callAPI<Page[]>(`search/${category}?q=${query}`);

      results.innerHTML = pages.length
        ? ""
        : "<p>No results, please try again</p>";

      results.append(
        ...pages.map((page) => {
          const li = document.createElement("li");

          const title = document.createElement("span");
          title.textContent = page.title.split(" (")[0]!;

          const year = document.createElement("small");
          if ("releaseYear" in page)
            year.textContent = page.releaseYear.toString();
          else if (page.birthYear) year.textContent = page.birthYear.toString();

          const text = document.createElement("div");
          text.append(title, year);

          if (allAnswers.some((a) => a.pageid === page.pageid)) {
            const check = document.createElement("span");
            check.textContent = "✅";

            li.append(text, check);
            return li;
          }

          const button = document.createElement("button");
          button.textContent = "Select";
          button.addEventListener("click", () => {
            sendRequest(ws, { key: "play_move", page });
            container.remove();
          });

          li.append(text, button);
          return li;
        }),
      );
    }, 750);
  });
  input.autofocus = true;

  container.append(wrapLabel(`Search ${category}s`, input), results);
  pageContent.append(container);

  setTimeout(() => {
    input.focus();
  }, 100);
}

type ActiveGame = Extract<
  Extract<SocketResponse, { key: "game_state" }>["game"],
  { started: true }
>;
