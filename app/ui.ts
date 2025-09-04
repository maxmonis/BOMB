import { darkChannel, localDark } from "./client"

let defaultDark = window.matchMedia("(prefers-color-scheme: dark)").matches
let dark = localDark.get() ?? defaultDark

let darkToggle = document.createElement("button")
darkToggle.title = "Toggle dark mode"

darkToggle.addEventListener("click", () => {
  dark = !dark
  localDark.set(dark)
  applyDark()
  darkChannel.post(dark)
})

darkChannel.listen(newDark => {
  dark = newDark
  applyDark()
})

export function applyDark() {
  document.body.classList.toggle("dark", dark)
  darkToggle.innerText = dark ? "🌛" : "🌞"
}

let toggleContainer = document.createElement("div")
toggleContainer.classList.add("theme-toggle-container")
toggleContainer.append(darkToggle)

document.querySelector("footer")!.prepend(toggleContainer)

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
