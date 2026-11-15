import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { artistMatch, getAlbum, normalize, oneEditApart, titleMatch, verifyAlbum } from "./musicbrainz";

describe("normalize", () => {
  it.each([
    ["C.L. Smooth", "cl smooth"],
    ["Maxwell's Urban Hang Suite", "maxwells urban hang suite"],
    ["Simon & Garfunkel", "simon and garfunkel"],
    ["The Beatles", "beatles"],
    ["Björk", "bjork"],
    ["  Untrue!! ", "untrue"],
  ])("%s → %s", (input, expected) => {
    expect(normalize(input)).toBe(expected);
  });
});

describe("artistMatch", () => {
  it("matches the same name exactly, ignoring spacing", () => {
    expect(artistMatch("Kode9 & The Space Ape", ["Kode9 & The Spaceape"])).toBe("exact");
  });

  it("matches one member of a duo exactly", () => {
    expect(artistMatch("Kode9", ["Kode9 & The Spaceape"])).toBe("exact");
  });

  it("matches a leader inside a group name loosely", () => {
    expect(artistMatch("Horace Silver", ["The Horace Silver Quintet"])).toBe("loose");
  });

  it("matches via a sort name, once creditNames has flipped it", () => {
    // creditNames turns "Yoshimura, Hiroshi" into "Hiroshi Yoshimura" before calling this.
    expect(artistMatch("Hiroshi Yoshimura", ["吉村弘", "Hiroshi Yoshimura"])).toBe("exact");
  });

  it("rejects a different artist", () => {
    expect(artistMatch("Burial", ["Four Tet"])).toBeNull();
  });

  it("doesn't loosely match names too short to be distinctive", () => {
    // "air" is under 4 characters, so it can't count as a word inside "Hot Air Balloon".
    expect(artistMatch("Air", ["Hot Air Balloon"])).toBeNull();
  });
});

describe("titleMatch", () => {
  it("is exact for the same title after normalizing", () => {
    expect(titleMatch("Maxwell's Urban Hang Suite", "Maxwells Urban Hang Suite")).toBe("exact");
  });

  it("treats Roman and Arabic numerals as the same", () => {
    expect(titleMatch("Led Zeppelin II", "Led Zeppelin 2")).toBe("exact");
  });

  it("is close when one title contains the other as whole words", () => {
    expect(titleMatch("Selected Ambient Works", "Selected Ambient Works 85-92")).toBe("close");
  });

  it("is close for near-identical long spellings", () => {
    expect(titleMatch("King Tubby Meets Rockers Uptown", "King Tubbys Meets Rockers Uptown")).toBe("close");
  });

  it("is close for a one-letter slip in a short title (Ammnesia)", () => {
    expect(titleMatch("Amnesia", "Ammnesia")).toBe("close");
  });

  it("rejects two letters off in a short title (Amnesty)", () => {
    expect(titleMatch("Amnesia", "Amnesty")).toBeNull();
  });

  it("rejects a one-letter slip when the title is too short to trust", () => {
    expect(titleMatch("Moon", "Mood")).toBeNull();
  });
});

describe("oneEditApart", () => {
  it.each([
    ["amnesia", "ammnesia", true], // insertion
    ["ammnesia", "amnesia", true], // deletion
    ["amnesia", "amnesio", true], // substitution
    ["amnesia", "amnesia", false], // identical is not "one edit"
    ["amnesia", "amnesty", false], // two substitutions
    ["amnesia", "amnesiaaa", false], // length differs by two
  ])("%s / %s → %s", (a, b, expected) => {
    expect(oneEditApart(a, b)).toBe(expected);
  });
});

// verifyAlbum talks to MusicBrainz, so these tests replace fetch with canned search results.
// The request queue waits ~1.1s between requests; fake timers skip the wait.
type Credit = { name: string; artist?: { name: string; "sort-name"?: string } };
const releaseGroup = (title: string, credits: Credit[], primaryType = "Album") => ({
  id: `id-${title}`,
  title,
  score: 100,
  "first-release-date": "2007-11-05",
  "primary-type": primaryType,
  "artist-credit": credits,
});

function mockSearchResults(groups: ReturnType<typeof releaseGroup>[]) {
  const fetchMock = vi.fn(async () => Response.json({ "release-groups": groups }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// Runs the lookup to completion, advancing fake time through the queue's waits.
async function verify(artist: string, title: string) {
  const result = verifyAlbum(artist, title);
  await vi.runAllTimersAsync();
  return result;
}

describe("verifyAlbum", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("finds an album and returns its MusicBrainz details", async () => {
    mockSearchResults([releaseGroup("Untrue", [{ name: "Burial" }])]);

    expect(await verify("Burial", "Untrue")).toEqual({
      found: true,
      mbid: "id-Untrue",
      artist: "Burial",
      title: "Untrue",
      year: 2007,
      coverUrl: "https://coverartarchive.org/release-group/id-Untrue/front-250",
      match: "exact",
    });
  });

  it("finds an artist credited in another script through the sort name (吉村弘)", async () => {
    mockSearchResults([
      releaseGroup("Music for Nine Post Cards", [
        { name: "吉村弘", artist: { name: "吉村弘", "sort-name": "Yoshimura, Hiroshi" } },
      ]),
    ]);

    const result = await verify("Hiroshi Yoshimura", "Music for Nine Post Cards");
    expect(result).toMatchObject({ found: true, artist: "吉村弘" });
  });

  it("strips edition suffixes before matching", async () => {
    mockSearchResults([releaseGroup("Teen Dream", [{ name: "Beach House" }])]);

    expect(await verify("Beach House", "Teen Dream (Deluxe Edition)")).toMatchObject({ found: true, match: "exact" });
  });

  it("doesn't accept a single that shares the album's name (Archangel)", async () => {
    mockSearchResults([releaseGroup("Archangel", [{ name: "Burial" }], "Single")]);

    expect(await verify("Burial", "Archangel")).toEqual({
      found: false,
      reason: 'only a single named "Archangel"',
    });
  });

  it("doesn't accept a loose artist and a close title together (Burial Hex)", async () => {
    mockSearchResults([releaseGroup("Archangel Invocation", [{ name: "Burial Hex" }])]);

    const result = await verify("Burial", "Archangel");
    expect(result.found).toBe(false);
  });

  it("tries all three searches before giving up", async () => {
    const fetchMock = mockSearchResults([]);

    expect(await verify("Nobody", "Nothing At All")).toEqual({ found: false, reason: "no results" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("getAlbum", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // The lookup endpoint returns one release group, not a list of them.
  async function lookUp(mbid: string, response: Response) {
    const fetchMock = vi.fn<typeof fetch>(async () => response);
    vi.stubGlobal("fetch", fetchMock);
    const result = getAlbum(mbid);
    await vi.runAllTimersAsync();
    return { album: await result, fetchMock };
  }

  it("returns the album in the app's shape", async () => {
    const { album, fetchMock } = await lookUp(
      "id-Loveless",
      Response.json(releaseGroup("Loveless", [{ name: "my bloody valentine" }])),
    );

    expect(album).toEqual({
      mbid: "id-Loveless",
      artist: "my bloody valentine",
      title: "Loveless",
      year: 2007, // releaseGroup's fixed test date
      type: "Album",
      coverUrl: "https://coverartarchive.org/release-group/id-Loveless/front-250",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/release-group/id-Loveless?");
  });

  it("returns null when MusicBrainz has no such album", async () => {
    const { album } = await lookUp("missing", new Response("{}", { status: 404 }));
    expect(album).toBeNull();
  });

  it("throws on other failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const result = getAlbum("broken");
    const assertion = expect(result).rejects.toThrow("MusicBrainz HTTP 500");
    await vi.runAllTimersAsync();
    await assertion;
  });
});
