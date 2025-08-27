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
  | { action: "challenge" | "give_up" | "start" }
  | { action: "play"; value: Page }

export interface GameResponse {
  creator: User
  currentPlayer: User
  currentRound: Array<Page>
  id: string
  messages: Array<ChatMessage>
  players: Array<Player>
  previousRounds: Array<Array<Page>>
  remainingSeconds: number
  started: boolean
  timeLimit: number
}

export type LobbyRequest =
  | { action: "accept" | "deny" }
  | { action: "create"; name: string }
  | { action: "request"; gameId: string; message: string; name: string }

export type LobbyResponse =
  | Array<string>
  | { action: "accept"; token: string }
  | { action: "deny" }
  | { action: "request"; name: string }
