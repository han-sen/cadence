import type { AlbumSuggestion, Verification } from "./schema";

// MusicBrainz asks for an identifying User-Agent and at most 1 request per second.
// https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
const USER_AGENT = `Lineage/0.1 ( ${process.env.MB_CONTACT ?? "lineage-app"} )`;
const MIN_INTERVAL_MS = 1100;
const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "now": someone is waiting on it (search as you type). "background": album checks.
type Priority = "now" | "background";
type Job = { signal?: AbortSignal; send: () => void; drop: () => void };

// Every MusicBrainz request in the server goes through this one queue, one request per slot.
// "now" jobs go ahead of background ones, and a search the user has already typed past is
// dropped without using a slot.
const queues: Record<Priority, Job[]> = { now: [], background: [] };
let nextSlotAt = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function throttledFetch(url: string, priority: Priority, signal?: AbortSignal): Promise<Response> {
  return new Promise((resolve, reject) => {
    queues[priority].push({
      signal,
      send: () =>
        fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal }).then(resolve, reject),
      drop: () => reject(signal?.reason),
    });
    runQueue();
  });
}

function runQueue() {
  if (timer || (!queues.now.length && !queues.background.length)) return;
  timer = setTimeout(() => {
    timer = null;
    const job = queues.now.shift() ?? queues.background.shift();
    if (job?.signal?.aborted) {
      job.drop();
    } else if (job) {
      nextSlotAt = Date.now() + MIN_INTERVAL_MS;
      job.send();
    }
    runQueue();
  }, Math.max(0, nextSlotAt - Date.now()));
}

// 503 means "slow down": back off and retry. Network errors get the same treatment,
// except when the caller cancelled.
async function fetchWithRetry(url: string, priority: Priority, signal?: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await throttledFetch(url, priority, signal);
      if (res.status !== 503 || attempt >= RETRY_DELAYS_MS.length) return res;
    } catch (err) {
      if (signal?.aborted || attempt >= RETRY_DELAYS_MS.length) throw err;
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

// The result type lives in schema.ts so the browser can validate it without importing this
// server-only module.
export type { Verification } from "./schema";

// Lowercase, drop accents, dots and apostrophes ("C.L." → "cl", "Maxwell's" → "maxwells"),
// "&" → "and", a leading "the", and any other punctuation.
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");
}

// "Kode9 & The Spaceape" → ["kode9 and spaceape", "kode9", "spaceape"]
function artistParts(s: string): string[] {
  const whole = normalize(s);
  const parts = s
    .split(/\s*(?:&|\+|,|\band\b|\bfeat\.?|\bwith\b|\bvs\.?)\s*/i)
    .map(normalize)
    .filter((p) => p.length > 1);
  return [whole, ...parts];
}

const compact = (s: string) => s.replace(/ /g, "");
const containsWords = (longer: string, shorter: string) =>
  shorter.length >= 4 && ` ${longer} `.includes(` ${shorter} `);

// exact: same name, ignoring spacing ("Space Ape"/"Spaceape").
// loose: a leader inside a group name either way round: "Horace Silver" / "The Horace Silver
// Quintet", "Dinosaur Jr." / "Dinosaur".
function artistMatch(wanted: string, creditedNames: string[]): "exact" | "loose" | null {
  const want = artistParts(wanted);
  const have = creditedNames.flatMap(artistParts);
  if (want.some((w) => have.some((h) => compact(w) === compact(h)))) return "exact";
  if (want.some((w) => have.some((h) => containsWords(h, w) || containsWords(w, h)))) return "loose";
  return null;
}

const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };
const titleKey = (s: string) => normalize(s).replace(/\b(i{1,3}|iv|vi{0,3}|ix|x)\b/g, (m) => ROMAN[m] ?? m);

// Dice coefficient over character bigrams: 1 = identical, ~0.9 = one or two characters off.
function similarity(a: string, b: string): number {
  const grams = (s: string) => Array.from({ length: Math.max(s.length - 1, 0) }, (_, i) => s.slice(i, i + 2));
  const ga = grams(a);
  const gb = grams(b);
  if (!ga.length || !gb.length) return 0;
  const counts = new Map<string, number>();
  for (const g of gb) counts.set(g, (counts.get(g) ?? 0) + 1);
  let shared = 0;
  for (const g of ga) {
    const n = counts.get(g) ?? 0;
    if (n > 0) {
      shared++;
      counts.set(g, n - 1);
    }
  }
  return (2 * shared) / (ga.length + gb.length);
}

function titleMatch(wanted: string, found: string): "exact" | "close" | null {
  const w = titleKey(wanted);
  const f = titleKey(found);
  if (w === f) return "exact";
  // Containment only counts on whole words and for titles long enough to be distinctive.
  const shorter = w.length < f.length ? w : f;
  const longer = w.length < f.length ? f : w;
  if (containsWords(longer, shorter)) return "close";
  // Near-identical spellings: "King Tubby Meets..." vs "King Tubbys Meets...".
  if (shorter.length >= 8 && similarity(w, f) >= 0.85) return "close";
  return null;
}

function escapeLucene(s: string): string {
  return s.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");
}

type ReleaseGroup = {
  id: string;
  title: string;
  score: number;
  count?: number; // how many releases (editions, reissues) the group has
  "first-release-date"?: string;
  "primary-type"?: string; // Album, EP, Single, Broadcast, Other
  "secondary-types"?: string[]; // Compilation, Live, Soundtrack, …
  "artist-credit"?: {
    name: string;
    joinphrase?: string;
    artist?: { name: string; "sort-name"?: string };
  }[];
};

const yearOf = (rg: ReleaseGroup) => {
  const date = rg["first-release-date"];
  return date ? Number(date.slice(0, 4)) : null;
};
const coverUrlOf = (rg: ReleaseGroup) => `https://coverartarchive.org/release-group/${rg.id}/front-250`;

const creditedAs = (rg: ReleaseGroup) =>
  (rg["artist-credit"] ?? []).map((c) => c.name + (c.joinphrase ?? "")).join("");

// Every name the release group's artists go by. The sort name covers artists credited in
// another script, e.g. 吉村弘 has sort name "Yoshimura, Hiroshi".
function creditNames(rg: ReleaseGroup): string[] {
  const names = [creditedAs(rg)];
  for (const c of rg["artist-credit"] ?? []) {
    names.push(c.name);
    if (c.artist?.name) names.push(c.artist.name);
    const sort = c.artist?.["sort-name"];
    if (sort) names.push(sort.includes(", ") ? sort.split(", ").reverse().join(" ") : sort);
  }
  return names;
}

async function search(
  query: string,
  limit: number,
  priority: Priority = "background",
  signal?: AbortSignal,
): Promise<ReleaseGroup[]> {
  const url = `https://musicbrainz.org/ws/2/release-group?fmt=json&limit=${limit}&query=${encodeURIComponent(query)}`;
  const res = await fetchWithRetry(url, priority, signal);
  if (!res.ok) throw new Error(`MusicBrainz HTTP ${res.status}`);
  const data = (await res.json()) as { "release-groups"?: ReleaseGroup[] };
  return data["release-groups"] ?? [];
}

// "Teen Dream (Deluxe Edition)" / "Abbey Road - 2019 Remaster" → base title
const EDITION_SUFFIX =
  /\s*(\(|\[|-\s)[^)\]]*\b(deluxe|remaster(ed)?|expanded|anniversary|edition|bonus)\b[^)\]]*[)\]]?\s*$/i;

// A song or broadcast that shares the album's name doesn't confirm the album: "Archangel"
// is a Burial single, not an album. Compilations and live albums still count, since many
// are classic records (jazz live sets, for example).
const NOT_AN_ALBUM = new Set(["Single", "Broadcast"]);

// Results are kept for the life of the server process. Storing the promise rather than the
// result means two charts asking for the same album at once share one lookup.
const CACHE_LIMIT = 5000;
const cache = new Map<string, Promise<Verification>>();

export function verifyAlbum(artist: string, rawTitle: string): Promise<Verification> {
  const key = `${normalize(artist)}|${titleKey(rawTitle.replace(EDITION_SUFFIX, ""))}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const result = lookupAlbum(artist, rawTitle).catch((err): Verification => {
    cache.delete(key); // don't remember failures; MusicBrainz may be reachable next time
    return { found: false, reason: (err as Error).message };
  });
  cache.set(key, result);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!); // Maps keep insertion order, so this drops the oldest
  return result;
}

async function lookupAlbum(artist: string, rawTitle: string): Promise<Verification> {
  const title = rawTitle.replace(EDITION_SUFFIX, "").trim();
  const [, firstArtist = normalize(artist)] = artistParts(artist);
  const t = escapeLucene(title);

  // Strictest first; later queries only run if earlier ones find nothing usable.
  const queries: [string, number][] = [
    [`releasegroup:"${t}" AND artist:"${escapeLucene(artist)}"`, 5],
    [`releasegroup:"${t}"`, 15], // artist credited differently, e.g. "Ultramagnetic MC's"
    [`${t} AND artist:(${escapeLucene(firstArtist)})`, 15], // title worded differently
  ];

  // Network and HTTP errors are thrown, so verifyAlbum can tell them apart from "not found".
  let closest: ReleaseGroup | undefined;
  let notAnAlbum: ReleaseGroup | undefined;
  for (const [query, limit] of queries) {
    const candidates = await search(query, limit);
    closest ??= candidates[0];

    let best: { rg: ReleaseGroup; match: "exact" | "close" } | undefined;
    for (const rg of candidates) {
      const artistFit = artistMatch(artist, creditNames(rg));
      const match = titleMatch(title, rg.title);
      // At most one side may be fuzzy. Both together let "Burial" + "Archangel" match
      // "Burial Hex" + "Archangel Invocation".
      if (!artistFit || !match || (artistFit === "loose" && match === "close")) continue;
      if (NOT_AN_ALBUM.has(rg["primary-type"] ?? "")) {
        notAnAlbum ??= rg;
        continue;
      }
      if (match === "exact") {
        best = { rg, match };
        break;
      }
      best ??= { rg, match };
    }

    if (best) {
      const { rg, match } = best;
      return {
        found: true,
        mbid: rg.id,
        artist: creditedAs(rg),
        title: rg.title,
        year: yearOf(rg),
        coverUrl: coverUrlOf(rg),
        match,
      };
    }
  }

  if (notAnAlbum) {
    return { found: false, reason: `only a ${notAnAlbum["primary-type"]?.toLowerCase()} named "${notAnAlbum.title}"` };
  }
  return {
    found: false,
    reason: closest ? `closest: "${closest.title}" (score ${closest.score})` : "no results",
  };
}

// Search as you type, for picking the seed album.
//
// MusicBrainz has no popularity ranking, so "untrue" alone would list a dozen obscure EPs
// before Burial's album. Release count (how many editions and reissues exist) is a decent
// stand-in for popularity, so results are re-ranked by text score plus release count.
const SEARCH_LIMIT = 25;
const SUGGESTIONS = 8;
const SEARCH_CACHE_LIMIT = 2000;
const searchCache = new Map<string, AlbumSuggestion[]>();

export async function searchAlbums(text: string, signal?: AbortSignal): Promise<AlbumSuggestion[]> {
  // Lowercase also stops typed "AND"/"OR" from being read as search operators.
  const key = text.toLowerCase().replace(/\s+/g, " ").trim();
  const cached = searchCache.get(key);
  if (cached) return cached;

  const words = key.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).map(escapeLucene);
  if (!words.length) return [];

  // Each word must appear in the title or the artist. The last word may be half typed, so it
  // also matches as a prefix ("untr" → "untrue"), unless it's a single letter.
  const wordClauses = words.map((w, i) => {
    const term = i === words.length - 1 && w.length >= 2 ? `${w}*` : w;
    return `(releasegroup:${term} OR artist:${term})`;
  });
  const query =
    `(releasegroup:"${escapeLucene(key)}"^4 OR (${wordClauses.join(" AND ")}))` +
    ` AND (primarytype:album OR primarytype:ep) AND NOT secondarytype:(remix OR compilation)`;

  const groups = await search(query, SEARCH_LIMIT, "now", signal);
  const rank = (rg: ReleaseGroup) => rg.score + 12 * Math.log2(rg.count ?? 1);
  const results = groups
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, SUGGESTIONS)
    .map((rg) => ({
      mbid: rg.id,
      artist: creditedAs(rg),
      title: rg.title,
      year: yearOf(rg),
      type: rg["primary-type"] ?? "Album",
      coverUrl: coverUrlOf(rg),
    }));

  searchCache.set(key, results);
  if (searchCache.size > SEARCH_CACHE_LIMIT) searchCache.delete(searchCache.keys().next().value!);
  return results;
}
