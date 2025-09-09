import type { WebSocket } from "ws"

interface ActiveGamePlayer
  extends Omit<Player, "letters" | "message" | "pending"> {
  letters: number
}

interface ActiveGameResponse {
  players: Array<ActiveGamePlayer>
  rounds: Array<Array<Page>>
  started: true
}

export interface ActorPage extends WikiPage {
  birthYear: number
}

export interface Game {
  players: Array<Player>
  rounds?: Array<Array<Page>>
}

export interface MoviePage extends WikiPage {
  releaseYear: number
}

export type Page = ActorPage | MoviePage

interface PendingGameResponse {
  players: Array<Omit<Player, "letters" | "status">>
  started: false
}

interface Player {
  id: string
  letters?: number
  message?: string
  name: string
  pending?: boolean
  status?: "active" | "challenged" | "reviewing"
}

export interface Socket extends WebSocket {
  alive: boolean
}

export type SocketRequest =
  | { key: "accept_join_request"; userId: string }
  | { key: "challenge" }
  | { key: "create_game"; name: string }
  | { key: "deny_join_request"; userId: string }
  | { key: "give_up" }
  | { key: "leave_game" }
  | { key: "mark_answer_correct" }
  | { key: "mark_answer_incorrect" }
  | { key: "play_move"; page: Page }
  | { key: "request_to_join"; gameId: string; message: string; name: string }
  | { key: "start_game" }

export type SocketResponse =
  | {
      key: "available_games"
      games: Array<{ creatorName: string; id: string }>
    }
  | { key: "error"; message: string }
  | { key: "game_state"; game: ActiveGameResponse | PendingGameResponse }
  | { key: "invalid_token" }
  | { key: "join_request_denied" }
  | { key: "toast"; message: string }
  | { key: "token"; token: string }

interface WikiPage {
  pageid: number
  title: string
}
