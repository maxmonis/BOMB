import { localAudio, localDark, themeChannel } from "./client"

let audio = localAudio.get()

let defaultDark = window.matchMedia("(prefers-color-scheme: dark)").matches
let dark = localDark.get() ?? defaultDark

let audioToggle = document.createElement("button")
audioToggle.title = "Toggle audio"
let darkToggle = document.createElement("button")
darkToggle.title = "Toggle dark mode"

audioToggle.addEventListener("click", () => {
  audio = !audio
  localAudio.set(audio)
  applyAudio()
  themeChannel.post("audio")
})

function applyAudio() {
  audioToggle.innerText = audio ? "🔊" : "🔇"
}

darkToggle.addEventListener("click", () => {
  dark = !dark
  localDark.set(dark)
  applyDark()
  themeChannel.post("dark")
})

function applyDark() {
  document.body.classList.toggle("dark", dark)
  darkToggle.innerText = dark ? "🌛" : "🌞"
}

themeChannel.listen(data => {
  if (data == "audio") {
    audio = localAudio.get()
    applyAudio()
  } else if (data == "dark") {
    dark = localDark.get() ?? defaultDark
    applyDark()
  }
})

let toggleContainer = document.createElement("div")
toggleContainer.classList.add("theme-toggle-container")
toggleContainer.append(darkToggle, audioToggle)

document.querySelector("footer")!.prepend(toggleContainer)

export function initUI() {
  applyAudio()
  applyDark()
}

let toast = document.createElement("div")
toast.classList.add("toast")
toast.role = "alert"

let toastTimeout: ReturnType<typeof setTimeout>

export function removeToast() {
  if (!document.body.contains(toast)) return
  return new Promise(resolve => {
    clearTimeout(toastTimeout)
    toast.classList.add("exit")
    toastTimeout = setTimeout(() => {
      toast.classList.remove("enter", "exit")
      toast.remove()
      resolve(true)
    }, 250)
  })
}

export async function showToast(message: string, durationMS = 3000) {
  await removeToast()
  toast.innerHTML = message
  document.body.append(toast)
  toastTimeout = setTimeout(() => {
    toast.classList.add("enter")
    toastTimeout = setTimeout(removeToast, durationMS)
  }, 50)
}
