import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chart } from "@/db/schema";
import { findByChartId } from "@/db/queries";
import type { RecordedEvent } from "./events";
import { verifyAlbum } from "./musicbrainz";
import { isConfirmed, isUnchecked, type Verification } from "./schema";

// Background re-check of a saved chart's "unchecked" albums: the ones MusicBrainz refused to
// look up while the chart was being made (it rate-limits Render's shared IP). Runs after the
// response has been sent, retries slowly, and writes any new matches back into the saved chart,
// so the next person to open it gets the covers and confirmations.
//
// This only works on a long-running server (Render): a promise left running after the response
// keeps going. On serverless the function could be frozen as soon as the response ends.
//
// Read and write this file top to bottom: each function only uses things defined above it.
//   1. findUnchecked  (pure)  what needs re-checking
//   2. applyChecks    (pure)  put new results back into the events
//   3. recheckChart   (async) the job: load, re-check in rounds, save; uses 1 and 2
//   4. startRecheck   (sync)  fire-and-forget wrapper the route calls; uses 3

// How many passes over the still-unchecked albums, and how long to wait before each one.
// MusicBrainz's refusals tend to pass after a while, so the waits are long on purpose.
const ROUNDS = 3;
const WAIT_BEFORE_ROUND_MS = 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// An album to look up again: the id that links its "album" and "verified" events, plus what to
// search MusicBrainz for.
export type UncheckedAlbum = { id: number; artist: string; title: string };

export function findUnchecked(events: RecordedEvent[]): UncheckedAlbum[] {
  const verifiedUncheckedItems: UncheckedAlbum[] = [];

  for (const item of events) {
    const e = item.event;
    // A check result ("verified" event) for an album MusicBrainz couldn't look up.
    if (e.type === "verified" && isUnchecked(e.check)) {
      const id = e.id;
      const albumEvent = events.find(
        (el) => el.event.type === "album" && el.event.id === id,
      );
      // Rules out "not found" and narrows the event to an album, so `.album` exists.
      if (albumEvent?.event.type === "album") {
        verifiedUncheckedItems.push({
          id,
          artist: albumEvent.event.album.artist,
          title: albumEvent.event.album.title,
        });
      }
    }
  }

  return verifiedUncheckedItems;
}

export function applyChecks(
  events: RecordedEvent[],
  results: Map<number, Verification>,
): RecordedEvent[] {
  const applied = events.map((item) => {
    const e = item.event;
    if (e.type !== "verified") return item;

    const newCheck = results.get(e.id);
    if (!newCheck) return item;

    return {
      ...item,
      event: { ...e, check: newCheck }, // keeps type and id, swaps the check
    };
  });

  return applied;
}

// ── 3 ─────────────────────────────────────────────────────────────────────────────────────────
// The whole job for one chart: load it, re-check what's unchecked over a few rounds, save.
//
// A replay that reads the chart while this runs is harmless: it gets the row as it was when it
// was read, and this writes the whole events list back in one UPDATE at the end, so a reader sees
// either the old list or the new one, never a mix.
export async function recheckChart(chartId: string): Promise<void> {
  const foundChart = await findByChartId(chartId);
  if (!foundChart) return;

  // The to-do list. Albums leave it as soon as MusicBrainz gives a real answer.
  let missingEvents = findUnchecked(foundChart.events);
  if (missingEvents.length === 0) return;
  const total = missingEvents.length;

  // New answers by album id: confirmed, or looked up and not found. Both replace "unchecked".
  const results = new Map<number, Verification>();

  for (let round = 1; round <= ROUNDS && missingEvents.length > 0; round++) {
    await sleep(WAIT_BEFORE_ROUND_MS);

    // One at a time on purpose: verifyAlbum shares the server's one-request-a-second queue with
    // live charts and search, so firing them all at once would only crowd that queue.
    for (const album of missingEvents) {
      const check = await verifyAlbum(album.artist, album.title);
      if (!isUnchecked(check)) results.set(album.id, check);
    }
    missingEvents = missingEvents.filter((album) => !results.has(album.id));
  }

  // Nothing new came back, so there's nothing worth writing.
  if (results.size === 0) {
    console.log(`[recheck] chart ${chartId}: 0 of ${total} albums answered, nothing saved`);
    return;
  }

  const newEvents = applyChecks(foundChart.events, results);
  await db.update(chart).set({ events: newEvents }).where(eq(chart.id, chartId));

  const confirmed = [...results.values()].filter(isConfirmed).length;
  console.log(
    `[recheck] chart ${chartId}: ${results.size} of ${total} albums answered ` +
      `(${confirmed} confirmed), ${missingEvents.length} still unchecked`,
  );
}

// ── 4 ─────────────────────────────────────────────────────────────────────────────────────────
// Charts being re-checked right now, so two visitors replaying the same chart don't start two
// re-checks of it. In memory only: it's empty again after a restart, which is fine.
const running = new Set<string>();

// Starts a re-check without waiting for it. Safe to call from a route handler right before
// returning: it never throws, and does nothing if this chart is already being re-checked.
export function startRecheck(chartId: string): void {
  const hasChartId = running.has(chartId);
  if (hasChartId) return;
  running.add(chartId);

  // Not awaited: the caller's response goes out now and this keeps running after it.
  // The .catch() is required, not tidiness: nothing else is waiting on this promise, so an error
  // with no handler would be an unhandled rejection, which stops the whole Node process.
  void recheckChart(chartId)
    .catch((err) => console.error(`[recheck] chart ${chartId} failed:`, err))
    .finally(() => running.delete(chartId));
}
