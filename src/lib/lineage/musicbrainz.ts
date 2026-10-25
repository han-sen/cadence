// MusicBrainz asks for an identifying User-Agent and at most 1 request per second.
// https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
const USER_AGENT = `Lineage/0.1 ( ${process.env.MB_CONTACT ?? "lineage-app"} )`;
const MIN_INTERVAL_MS = 1100;
const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000];

let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function throttledFetch(url: string): Promise<Response> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  return fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
}

// 503 means "slow down": back off and retry. Network errors get the same treatment.
async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await throttledFetch(url);
      if (res.status !== 503 || attempt >= RETRY_DELAYS_MS.length) return res;
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) throw err;
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

export type Verification =
  | {
      found: true;
      mbid: string;
      artist: string;
      title: string;
      year: number | null;
      coverUrl: string;
      // exact: titles match after normalizing. close: one title contains the other,
      // e.g. "Urban Hang Suite" vs "Maxwell's Urban Hang Suite".
      match: "exact" | "close";
    }
  | { found: false; reason: string };

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

// Matches "Space Ape"/"Spaceape", and a leader inside a group name either way round:
// "Horace Silver" / "The Horace Silver Quintet", "Dinosaur Jr." / "Dinosaur".
function artistsMatch(wanted: string, creditedNames: string[]): boolean {
  const want = artistParts(wanted);
  const have = creditedNames.flatMap(artistParts);
  return want.some((w) =>
    have.some((h) => compact(w) === compact(h) || containsWords(h, w) || containsWords(w, h)),
  );
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
  "first-release-date"?: string;
  "artist-credit"?: {
    name: string;
    joinphrase?: string;
    artist?: { name: string; "sort-name"?: string };
  }[];
};

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

async function search(query: string, limit: number): Promise<ReleaseGroup[]> {
  const url = `https://musicbrainz.org/ws/2/release-group?fmt=json&limit=${limit}&query=${encodeURIComponent(query)}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`MusicBrainz HTTP ${res.status}`);
  const data = (await res.json()) as { "release-groups"?: ReleaseGroup[] };
  return data["release-groups"] ?? [];
}

// "Teen Dream (Deluxe Edition)" / "Abbey Road - 2019 Remaster" → base title
const EDITION_SUFFIX =
  /\s*(\(|\[|-\s)[^)\]]*\b(deluxe|remaster(ed)?|expanded|anniversary|edition|bonus)\b[^)\]]*[)\]]?\s*$/i;

export async function verifyAlbum(artist: string, rawTitle: string): Promise<Verification> {
  const title = rawTitle.replace(EDITION_SUFFIX, "").trim();
  const [, firstArtist = normalize(artist)] = artistParts(artist);
  const t = escapeLucene(title);

  // Strictest first; later queries only run if earlier ones find nothing usable.
  const queries: [string, number][] = [
    [`releasegroup:"${t}" AND artist:"${escapeLucene(artist)}"`, 5],
    [`releasegroup:"${t}"`, 15], // artist credited differently, e.g. "Ultramagnetic MC's"
    [`${t} AND artist:(${escapeLucene(firstArtist)})`, 15], // title worded differently
  ];

  let closest: ReleaseGroup | undefined;
  try {
    for (const [query, limit] of queries) {
      const candidates = await search(query, limit);
      closest ??= candidates[0];

      let best: { rg: ReleaseGroup; match: "exact" | "close" } | undefined;
      for (const rg of candidates) {
        if (!artistsMatch(artist, creditNames(rg))) continue;
        const match = titleMatch(title, rg.title);
        if (match === "exact") {
          best = { rg, match };
          break;
        }
        if (match === "close") best ??= { rg, match };
      }

      if (best) {
        const { rg, match } = best;
        const date = rg["first-release-date"];
        return {
          found: true,
          mbid: rg.id,
          artist: creditedAs(rg),
          title: rg.title,
          year: date ? Number(date.slice(0, 4)) : null,
          coverUrl: `https://coverartarchive.org/release-group/${rg.id}/front-250`,
          match,
        };
      }
    }
  } catch (err) {
    return { found: false, reason: (err as Error).message };
  }

  return {
    found: false,
    reason: closest ? `closest: "${closest.title}" (score ${closest.score})` : "no results",
  };
}
