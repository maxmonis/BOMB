import { Spinner } from "htm-elements/spinner"

export let pageTitle = document.querySelector("h1")!

export let pageContent = document.createElement("div")
pageContent.classList.add("page-content")
pageTitle.after(pageContent)

export let spinner = new Spinner(32)
