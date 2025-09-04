class Channel<
  K extends "theme",
  T extends K extends "theme" ? "audio" | "dark" : never
> {
  private readonly channel: BroadcastChannel
  constructor(key: K) {
    this.channel = new BroadcastChannel(key)
  }
  post(data: T) {
    this.channel.postMessage(data)
  }
  listen(callback: (data: T) => void) {
    this.channel.onmessage = e => {
      callback(e.data)
    }
  }
}

export let themeChannel = new Channel("theme")

class Emitter<
  K extends "game",
  T extends K extends "game"
    ?
        | { key: "leave_game" }
        | { key: "mark_answer_incorrect" }
        | { key: "start_game" }
    : never
> {
  private readonly key: `CustomEvent:${K}`
  constructor(key: K) {
    this.key = `CustomEvent:${key}`
  }
  post(data: T) {
    document.dispatchEvent(new CustomEvent(this.key, { detail: { data } }))
  }
  listen(callback: (data: T) => void) {
    document.addEventListener(this.key, event => {
      let customEvent = event as CustomEvent
      callback(customEvent.detail.data)
    })
  }
}

export let gameEmitter = new Emitter("game")

class LocalStorage<
  K extends "audio" | "dark" | "token",
  T extends K extends "audio" | "dark"
    ? boolean
    : K extends "token"
      ? string
      : never
> {
  private readonly key: K
  constructor(key: K) {
    this.key = key
  }
  get(): T | null {
    let item = localStorage.getItem(this.key)
    return item ? JSON.parse(item) : null
  }
  set(item: T) {
    localStorage.setItem(this.key, JSON.stringify(item))
  }
  remove() {
    localStorage.removeItem(this.key)
  }
}

export let localAudio = new LocalStorage("audio")
export let localDark = new LocalStorage("dark")
export let localToken = new LocalStorage("token")

export async function callAPI<T>(
  path: string,
  { headers: headersInit, ...init }: RequestInit = {}
) {
  let token = localToken.get()
  let res = await fetch(`/api/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Package-Version": import.meta.env.PACKAGE_VERSION,
      ...(token && { "X-Auth-Token": token }),
      ...headersInit
    }
  })
  let value: T = await res.json()
  if (res.ok) return value
  if (res.status == 409 && value == "New version available, please reload page")
    window.location.reload()
  throw value
}
