import { type SocketResponse } from "../../lib/types";
import { sendRequest, wrapLabel } from "../client";
import { pageContent, pageTitle } from "../elements";
import { toast } from "../ui";

let gameList: Extract<SocketResponse, { key: "available_games" }>["games"] = [];
let pendingGameId: string | null = null;

export function renderLobby(ws: WebSocket, games = gameList) {
  gameList = games;

  if (pendingGameId)
    if (gameList.some((g) => g.id === pendingGameId)) return;
    else {
      toast.show("Game was deleted");
      pendingGameId = null;
    }

  const lobby = document.createElement("div");
  lobby.append(createGameForm(ws), createGameList(ws));
  lobby.classList.add("lobby");

  pageTitle.textContent = "Lobby";
  pageContent.innerHTML = "";
  pageContent.append(lobby);
}

function createGameForm(ws: WebSocket) {
  const input = document.createElement("input");
  input.maxLength = 20;
  input.required = true;

  const button = document.createElement("button");
  button.classList.add("btn");
  button.textContent = "Create Game";
  button.type = "submit";

  const form = document.createElement("form");
  form.append(wrapLabel("Your name", input), button);

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = input.value.trim();

    if (!name) {
      input.value = "";
      input.focus();
      return;
    }

    sendRequest(ws, { key: "create_game", name });
  });

  const title = document.createElement("h2");
  title.textContent = "Create New Game";

  const container = document.createElement("div");
  container.append(title, form);
  return container;
}

function createGameList(ws: WebSocket) {
  const container = document.createElement("div");

  const title = document.createElement("h2");
  title.textContent = "Available Games";

  if (!gameList.length) {
    const text = document.createElement("p");
    text.textContent = "No available games";

    container.append(title, text);
    return container;
  }

  const list = document.createElement("ul");
  list.append(
    ...gameList.map((game) => {
      const name = document.createElement("span");
      name.textContent = `${game.creatorName}'s Game`;

      const button = document.createElement("button");
      button.addEventListener("click", () => {
        renderJoinRequestForm(ws, game.id, game.creatorName);
      });
      button.textContent = "Request to Join";

      const li = document.createElement("li");
      li.append(name, button);
      return li;
    }),
  );

  container.append(title, list);
  return container;
}

function renderJoinRequestForm(
  ws: WebSocket,
  gameId: string,
  creatorName: string,
) {
  pendingGameId = gameId;

  const input = document.createElement("input");
  input.autofocus = true;
  input.maxLength = 20;
  input.required = true;

  const textarea = document.createElement("textarea");
  textarea.maxLength = 300;

  const submitButton = document.createElement("button");
  submitButton.classList.add("btn");
  submitButton.textContent = "Send Request";
  submitButton.type = "submit";

  const cancelButton = document.createElement("button");
  cancelButton.addEventListener("click", () => {
    pendingGameId = null;
    renderLobby(ws);
  });
  cancelButton.classList.add("red");
  cancelButton.textContent = "Cancel";
  cancelButton.type = "button";

  const form = document.createElement("form");
  form.classList.add("request-to-join-form");

  form.append(
    wrapLabel("Your name", input),
    wrapLabel("Message (optional)", textarea),
    submitButton,
    cancelButton,
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = input.value.trim();

    if (!name) {
      input.value = "";
      input.focus();
      return;
    }

    pendingGameId = null;

    sendRequest(ws, {
      key: "request_to_join",
      gameId,
      name,
      message: textarea.value.trim(),
    });
  });

  pageTitle.textContent = `Request to Join ${creatorName}'s Game`;
  pageContent.innerHTML = "";
  pageContent.append(form);
}
