import "htm-elements/styles.css"
import { Toast } from "htm-elements/toast"
import { darkChannel, localDark } from "./client"

export let toast = new Toast({ position: "top-right" })

let defaultDark = window.matchMedia("(prefers-color-scheme: dark)").matches
let dark = localDark.get() ?? defaultDark

let darkToggle = document.createElement("button")
darkToggle.title = "Toggle dark mode"

darkToggle.addEventListener("click", () => {
  dark = !dark
  applyDark()
  localDark.set(dark)
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
