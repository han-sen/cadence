import type { Genre } from "./schema";

// Kindred picks must come from a genre outside the chart, so they add cross-genre albums
// instead of taking ones that belong in the lineage sections. Claude names each pick's genre;
// this catches the ones that are really one of the chart's own.

// "Trip-hop", "trip hop" and "TripHop" all compare equal.
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// The chart genre this kindred pick falls into, if any. Compares against each genre's name
// and its kebab-case id.
export function chartGenreMatching(kindredGenre: string, genres: Genre[]): Genre | undefined {
  const label = normalize(kindredGenre);
  if (!label) return undefined;
  return genres.find((g) => normalize(g.name) === label || normalize(g.id) === label);
}
