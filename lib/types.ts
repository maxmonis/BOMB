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
  | { key: "challenge" | "give_up" | "start" }
  | { key: "play"; value: Page }

export type GameResponse = Game

export interface Game {
  creatorId: string
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
  | { key: "accept"; name: string; userId: string }
  | { key: "create"; name: string }
  | { key: "deny"; userId: string }
  | { key: "request"; creatorId: string; message: string; name: string }

export type LobbyResponse =
  | { key: "accept"; token: string }
  | { key: "deny" }
  | {
      key: "game_update"
      players: Array<Omit<Game["players"][number], "letters">>
    }
  | {
      key: "list"
      availableGames: Array<Array<Omit<Game["players"][number], "letters">>>
    }
  | { key: "request"; message: string; name: string; userId: string }
