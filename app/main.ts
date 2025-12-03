import "../style/global.css";

import { type SocketResponse } from "../lib/types";

import { createWebSocket, getUserIdFromToken, localToken } from "./client";
import { renderActiveGame } from "./components/activeGame";
import { renderLobby } from "./components/lobby";
import { renderPendingGame } from "./components/pendingGame";
import { applyDark, toast } from "./ui";

if (location.pathname !== "/") location.replace(location.origin);

applyDark();
init();

function init() {
  const token = localToken.get();
  const userId = getUserIdFromToken(token);
  let ws = createWebSocket(token);

  let reconnectAttempts = 0;
  let reconnectDelay = 1000;

  initSocket();

  function initSocket() {
    ws.onclose = handleDisconnect;
    ws.onerror = handleDisconnect;

    ws.onmessage = ({ data }) => {
      const res: SocketResponse = JSON.parse(data);

      switch (res.key) {
        case "toast":
          toast.show(res.message);
          break;

        case "error":
          toast.show(res.message, { variant: "danger" });
          break;

        case "token":
          localToken.set(res.token);
          reset();
          break;

        case "invalid_token":
          localToken.remove();
          reset();
          break;

        case "available_games":
          renderLobby(ws, res.games);
          break;

        case "game_state":
          if (!userId) reset();
          else if (res.game.started) renderActiveGame(ws, res.game, userId);
          else renderPendingGame(ws, res.game, userId);
          break;
      }
    };

    ws.onopen = () => {
      reconnectAttempts = 0;
      reconnectDelay = 1000;
    };
  }

  function handleDisconnect() {
    if (reconnectAttempts > 4) {
      toast.show("Connection lost. Please refresh the page.", {
        variant: "danger",
      });
      return;
    }

    setTimeout(() => {
      reconnectAttempts++;
      reconnectDelay *= 2;

      closeSocket();

      ws = createWebSocket(token);
      initSocket();
    }, reconnectDelay);
  }

  function reset() {
    closeSocket();
    init();
  }

  function closeSocket() {
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;

    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    )
      ws.close();
  }
}
