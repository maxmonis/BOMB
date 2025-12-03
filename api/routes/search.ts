import { Router } from "express";

import { type ActorPage, type MoviePage } from "../../lib/types";
import { hasChars } from "../../lib/utils";
import { authToken } from "../middleware";

export const searchRoute = Router();

searchRoute.get("/:category", authToken, async (req, res) => {
  const { category } = req.params;
  const { q: term } = req.query;
  try {
    if (!hasChars(term)) res.status(400).json("Invalid request");
    else if (category === "actor") res.json(await searchActors(term));
    else if (category === "movie") res.json(await searchMovies(term));
    else res.status(400).json("Invalid request");
  } catch (error) {
    res.status(500).json(error);
  }
});

function extractYear(lines: Array<string>, regex: RegExp) {
  const max = Math.min(100, lines.length);
  for (let i = 0; i < max; i++) {
    const line = lines[i]!;
    if (regex.test(line) && /^\s*\|.*/.test(line)) {
      const matches = line.match(/\b(19|20)\d{2}\b/);
      return matches ? parseInt(matches[0]) : null;
    }
  }
  return null;
}

function getOccupation(lines: Array<string>) {
  const max = Math.min(100, lines.length);
  for (let i = 0; i < max; i++) {
    let line = lines[i]!;
    if (/occupation/i.test(line)) {
      if (/flat\s?list/i.test(line))
        while (!line.includes("}}")) line += lines[i++];
      return line;
    }
  }
  return null;
}

async function getPageLines(ids: Array<string>) {
  const { query } = await wikipediaRequest<{
    query?: {
      pages: Record<
        string,
        { pageid: number; revisions: Array<{ "*": string }>; title: string }
      >;
    };
  }>({
    pageids: ids.join("|"),
    prop: "revisions",
    rvprop: "content",
  });
  return ids.reduce<Record<string, Array<string>>>((acc, id) => {
    const revisions = query?.pages[id]?.revisions ?? [];
    if (revisions[0]) acc[id] = revisions[0]["*"].split("\n");
    return acc;
  }, {});
}

async function searchActors(term: string) {
  const results = await searchWiki(term.trim() + " (actor)");
  const birthYears: Record<string, number | null> = {};
  const ids = results.map((r) => r.pageid.toString());
  const pageLines = await getPageLines(ids);
  for (const id of ids) {
    const lines = pageLines[id];
    if (!lines) continue;
    const occupation = getOccupation(lines);
    if (!occupation || !/\bact(or|ress)\b/i.test(occupation)) continue;
    birthYears[id] = extractYear(lines, /birth_date/i);
  }
  return results.flatMap<ActorPage>(({ pageid, title }) => {
    return pageid in birthYears
      ? {
          birthYear: birthYears[pageid]!,
          pageid,
          title: title.split(" (")[0]!,
        }
      : [];
  });
}

async function searchMovies(term: string) {
  const results = await searchWiki(term.trim() + " (film)");
  const releaseYears: Record<string, number> = {};
  const pageIds = results.map((r) => r.pageid.toString());
  const pageLines = await getPageLines(pageIds);
  for (const id of pageIds) {
    const lines = pageLines[id];
    if (!lines?.some((line) => /infobox film/i.test(line))) continue;
    const releaseYear = extractYear(lines, /released/i);
    if (releaseYear) releaseYears[id] = releaseYear;
  }
  return results.flatMap<MoviePage>(({ pageid, title }) => {
    const releaseYear = releaseYears[pageid];
    return releaseYear
      ? { pageid, releaseYear, title: title.split(" (")[0]! }
      : [];
  });
}

function searchWiki(term: string) {
  return wikipediaRequest<{
    query: {
      search: Array<{ pageid: number; snippet: string; title: string }>;
    };
  }>({ list: "search", srlimit: "50", srsearch: term }).then(
    ({ query: { search } }) => search,
  );
}

async function wikipediaRequest<T extends object>(
  params: Record<string, string>,
) {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?${new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      ...params,
    })}`,
  );
  const value: T | WikipediaError = await res.json();
  if (!res.ok) throw value;
  if ("error" in value) throw value.error.info;
  return value;
}

interface WikipediaError {
  error: { code: string; info: string; servedby: string };
}
