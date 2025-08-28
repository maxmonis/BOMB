interface ChatEvent extends User {
  timestamp: number
}

export interface ChatMessage extends ChatEvent {
  text: string
}

export interface ChatStatus extends ChatEvent {
  typing: boolean
}

export interface Player extends User {
  letters: number
}

export interface User {
  name: string
  id: string
}

export interface Page {
  pageid: string
  title: string
  year: number
}

export type GameRequest =
  | { key: "accept"; name: string; userId: string }
  | { key: "challenge" | "give_up" | "start" }
  | { key: "deny"; userId: string }
  | { key: "play"; value: Page }

export type GameResponse =
  | { key: "game_update"; game: Game }
  | { key: "join_requested"; message: string; name: string; userId: string }
  | {
      key: "pending_game"
      game: {
        admitted: Array<{ id: string; name: string }>
        requested: Array<{ id: string; name: string }>
      }
    }

export interface Game {
  currentPlayer: User
  currentRound: Array<Page>
  messages: Array<ChatMessage>
  players: Array<Player>
  previousRounds: Array<Array<Page>>
  remainingSeconds: number
  started: boolean
  timeLimit: number
}

export type LobbyRequest =
  | { key: "create_game"; name: string }
  | { key: "request_to_join"; gameId: string; message: string; name: string }

export type LobbyResponse =
  | { key: "game_created"; token: string }
  | {
      key: "game_list"
      availableGames: Array<Omit<Game["players"][number], "letters">>
    }
  | { key: "join_request_pending"; token: string }
