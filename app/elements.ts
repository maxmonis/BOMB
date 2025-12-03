import { Spinner } from "htm-elements/spinner";

export const pageTitle = document.querySelector("h1")!;

export const pageContent = document.createElement("div");
pageContent.classList.add("page-content");
pageTitle.after(pageContent);

export const spinner = new Spinner(32);
