import { Router } from "express"
import type { ActorPage, MoviePage } from "../../lib/types"
import { hasChars } from "../../lib/utils"
import { authToken } from "../middleware"

export let searchRoute = Router()

searchRoute.get("/:category", authToken, async (req, res) => {
  let { category } = req.params
  let { q: term } = req.query
  try {
    if (!hasChars(term)) res.status(400).json("Invalid request")
    else if (category == "actor") res.json(await searchActors(term))
    else if (category == "movie") res.json(await searchMovies(term))
    else res.status(400).json("Invalid request")
  } catch (error) {
    res.status(500).json(error)
  }
})

function extractYear(lines: Array<string>, regex: RegExp) {
  let line = lines.find(line => regex.test(line))
  if (!line || !/^\s*\|.*/.test(line)) return null
  let matches = line.match(/\b(19|20)\d{2}\b/)
  return matches ? parseInt(matches[0]) : null
}

function getOccupation(lines: Array<string>) {
  return lines.find(line => /occupation/i.test(line))
}

async function getPageLines(ids: Array<string>) {
  let { query } = await wikipediaRequest<{
    query?: {
      pages: Record<
        string,
        { pageid: number; revisions: Array<{ "*": string }>; title: string }
      >
    }
  }>({
    pageids: ids.join("|"),
    prop: "revisions",
    rvprop: "content"
  })
  return ids.reduce<Record<string, Array<string>>>((acc, id) => {
    let revisions = query?.pages[id]?.revisions ?? []
    if (revisions[0]) acc[id] = revisions[0]["*"].split("\n")
    return acc
  }, {})
}

async function searchActors(term: string) {
  let results = await searchWiki(term.trim() + " (actor)")
  let birthYears: Record<string, number | null> = {}
  let ids = results.map(r => r.pageid.toString())
  let pageLines = await getPageLines(ids)
  for (let id of ids) {
    let lines = pageLines[id]
    if (!lines) continue
    let occupation = getOccupation(lines)
    if (!occupation || !/\bact(or|ress)\b/i.test(occupation)) continue
    birthYears[id] = extractYear(lines, /birth_date/i)
  }
  return results.flatMap<ActorPage>(({ pageid, title }) => {
    return pageid in birthYears
      ? {
          birthYear: birthYears[pageid]!,
          pageid,
          title: title.split(" (")[0]!
        }
      : []
  })
}

async function searchMovies(term: string) {
  let results = await searchWiki(term.trim() + " (film)")
  let releaseYears: Record<string, number> = {}
  let pageIds = results.map(r => r.pageid.toString())
  let pageLines = await getPageLines(pageIds)
  for (let id of pageIds) {
    let lines = pageLines[id]
    if (!lines?.some(line => /infobox film/i.test(line))) continue
    let releaseYear = extractYear(lines, /released/i)
    if (releaseYear) releaseYears[id] = releaseYear
  }
  return results.flatMap<MoviePage>(({ pageid, title }) => {
    let releaseYear = releaseYears[pageid]
    return releaseYear
      ? { pageid, releaseYear, title: title.split(" (")[0]! }
      : []
  })
}

function searchWiki(term: string) {
  return wikipediaRequest<{
    query: { search: Array<{ pageid: number; snippet: string; title: string }> }
  }>({ list: "search", srlimit: "50", srsearch: term }).then(
    ({ query: { search } }) => search
  )
}

async function wikipediaRequest<T extends object>(
  params: Record<string, string>
) {
  let res = await fetch(
    `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      ...params
    })}`
  )
  let value: T | WikipediaError = await res.json()
  if (!res.ok) throw value
  if ("error" in value) throw value.error.info
  return value
}

interface WikipediaError {
  error: { code: string; info: string; servedby: string }
}
