import { localToken, sendRequest } from "../client";

export function createLeaveGameDialog(ws: WebSocket) {
  const dialog = document.createElement("dialog");

  const stay = document.createElement("button");
  stay.addEventListener("click", () => {
    dialog.close();
    dialog.remove();
  });
  stay.textContent = "No, stay";

  const leave = document.createElement("button");
  leave.addEventListener("click", () => {
    localToken.remove();

    sendRequest(ws, { key: "leave_game" });

    dialog.close();
    dialog.remove();
  });
  leave.classList.add("red");
  leave.textContent = "Yes, leave";

  const buttons = document.createElement("div");
  buttons.append(stay, leave);
  buttons.classList.add("dialog-button-container");

  const title = document.createElement("h1");
  title.textContent = "Leave Game?";

  const content = document.createElement("div");
  content.append(title, buttons);
  dialog.append(content);

  const button = document.createElement("button");
  button.addEventListener("click", () => {
    document.body.append(dialog);
    dialog.showModal();
  });
  button.classList.add("red");
  button.textContent = "Leave Game";
  return button;
}
