import { describe, expect, it, vi } from "vitest";

// recheck.ts imports the database, which needs a DATABASE_URL and refuses to load outside a
// server. These tests only cover the pure helpers, so the database modules are swapped for stubs.
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/queries", () => ({ findByChartId: vi.fn() }));

import type { RecordedEvent } from "./events";
import { applyChecks, findUnchecked } from "./recheck";
import type { AlbumPick, Verification } from "./schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────────────────

const pick = (artist: string, title: string): AlbumPick => ({
  artist,
  title,
  year: 2000,
  genreId: "g",
  why: "",
  sharedTraits: [],
  kindred: false,
  kindredGenre: null,
});

const albumEvent = (id: number, artist: string, title: string, offsetMs = 0): RecordedEvent => ({
  offsetMs,
  event: { type: "album", id, album: pick(artist, title) },
});

const verifiedEvent = (id: number, check: Verification, offsetMs = 0): RecordedEvent => ({
  offsetMs,
  event: { type: "verified", id, check },
});

const unchecked: Verification = { found: false, unchecked: true, reason: "MusicBrainz HTTP 503" };
const notFound: Verification = { found: false, reason: "no results" };
const confirmed = (title: string): Verification => ({
  found: true,
  mbid: `id-${title}`,
  artist: "Artist",
  title,
  year: 2001,
  coverUrl: `https://coverartarchive.org/release-group/id-${title}/front-250`,
  match: "exact",
});

// ─── findUnchecked ───────────────────────────────────────────────────────────────────────

describe("findUnchecked", () => {
  it("returns only the albums MusicBrainz couldn't check, with what to search for", () => {
    const events = [
      albumEvent(0, "Grimes", "Visions"),
      albumEvent(1, "Robyn", "Body Talk"),
      albumEvent(2, "Nobody", "Made Up"),
      verifiedEvent(0, unchecked),
      verifiedEvent(1, confirmed("Body Talk")),
      verifiedEvent(2, notFound),
    ];

    expect(findUnchecked(events)).toEqual([{ id: 0, artist: "Grimes", title: "Visions" }]);
  });

  it("returns nothing for a chart where every album got an answer", () => {
    const events = [albumEvent(0, "Robyn", "Body Talk"), verifiedEvent(0, confirmed("Body Talk"))];

    expect(findUnchecked(events)).toEqual([]);
  });
});

// ─── applyChecks ─────────────────────────────────────────────────────────────────────────

describe("applyChecks", () => {
  it("swaps in new checks and keeps every event's timing", () => {
    const events = [
      albumEvent(0, "Grimes", "Visions", 1000),
      verifiedEvent(0, unchecked, 5000),
      verifiedEvent(1, unchecked, 6000),
    ];
    const results = new Map([[0, confirmed("Visions")]]);

    const updated = applyChecks(events, results);

    expect(updated[1]).toEqual(verifiedEvent(0, confirmed("Visions"), 5000));
    expect(updated[0]).toBe(events[0]); // untouched events are passed through as they are
    expect(updated[2]).toBe(events[2]); // a check with no new result stays unchecked
  });

  it("doesn't change the events it was given", () => {
    const events = [verifiedEvent(0, unchecked)];
    const before = structuredClone(events);

    applyChecks(events, new Map([[0, confirmed("Visions")]]));

    expect(events).toEqual(before);
  });
});
