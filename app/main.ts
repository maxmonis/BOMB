import { Socket } from "./client"

let token = localStorage.getItem("token")
if (token) connectToGame(token)
else connectToLobby()

function connectToGame(token: string) {
  let ws = new Socket(token)
  ws.onError(() => {
    localStorage.removeItem("token")
    ws.close()
    connectToLobby()
  })
}

function connectToLobby() {
  let ws = new Socket(null)
  ws.onError(() => {
    ws.close()
  })
}
