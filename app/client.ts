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
