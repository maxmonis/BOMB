export let pageTitle = document.querySelector("h1")!

export let lineBreak = document.createElement("br")
export let spinner = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "svg"
)
spinner.classList.add("spinner")
spinner.setAttribute("height", "40")
spinner.setAttribute("preserveAspectRatio", "xMidYMid")
spinner.setAttribute("viewBox", "0 0 100 100")
spinner.setAttribute("width", "40")
let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
rect.setAttribute("fill", "none")
rect.setAttribute("height", "100")
rect.setAttribute("width", "100")
rect.setAttribute("x", "0")
rect.setAttribute("y", "0")
let circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
circle.setAttribute("cx", "50")
circle.setAttribute("cy", "50")
circle.setAttribute("fill", "none")
circle.setAttribute("r", "40")
circle.setAttribute("stroke", "currentColor")
circle.setAttribute("stroke-linecap", "round")
circle.setAttribute("stroke-width", "12")
spinner.append(rect, circle)
