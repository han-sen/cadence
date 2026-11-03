"use client";

import { useEffect, useMemo, useState } from "react";
import type { AlbumSuggestion } from "@/lib/lineage/schema";
import { type ChartState, useChartStream } from "@/lib/lineage/use-chart-stream";
import { AlbumCardPlaceholder, AlbumCards, isRejected } from "./album-card";
import { AlbumSearch } from "./album-search";
import { LineageFlow, SectionLabel } from "./lineage-flow";
import { SeedLoader, type SeedProgress } from "./seed-loader";
import { ActiveTrait, sameTrait, sharesTrait, TraitList } from "./trait-filter";

// The chart page: search, the seed header, kindred picks, then the lineage as an hourglass
// (roots → nearest neighbors → branches). Everything fills in as the stream arrives.
export function ChartExplorer() {
  const { state, start, cancel } = useChartStream();
  // The album picked in the search box. Shown straight away, so there's something on screen
  // during the ~20s before Claude's first result.
  const [picked, setPicked] = useState<AlbumSuggestion | null>(null);
  const [activeTrait, setActiveTrait] = useState<string | null>(null);
  const streaming = state.status === "streaming";

  // Clicking the active trait again clears it.
  const traitContext = useMemo(
    () => ({ active: activeTrait, toggle: (t: string) => setActiveTrait((cur) => (cur && sameTrait(cur, t) ? null : t)) }),
    [activeTrait],
  );
  const matching = activeTrait
    ? state.albums.filter((a) => a.check?.found && sharesTrait(a.album, activeTrait)).length
    : 0;
  const kindred = state.albums.filter((a) => a.album.kindred);

  return (
    <ActiveTrait value={traitContext}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Lineage</h1>
          <p className="text-white/60">
            Name an album you love. See where it came from, where it led, and what to play next.
          </p>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row">
          <AlbumSearch
            isDisabled={streaming}
            onSelect={(album) => {
              setPicked(album);
              setActiveTrait(null);
              start(album.artist, album.title);
            }}
          />
          {streaming && (
            <div className="flex items-start sm:pt-6">
              <button type="button" onClick={cancel} className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium hover:bg-white/10">
                Cancel
              </button>
            </div>
          )}
        </div>

        {picked && state.status !== "idle" && (
          <section aria-label="Seed album" className="flex gap-4 sm:gap-5">
            {/* Keyed by the run, so picking an album again replays the sequence. */}
            <SeedLoader key={state.startedAt} coverUrl={picked.coverUrl} progress={seedProgress(state)} className="size-28 sm:size-40" />
            <div className="flex min-w-0 flex-col gap-2">
              <h2 className="text-xl font-semibold sm:text-2xl">
                {picked.title} <span className="font-normal text-white/60">· {picked.artist}{picked.year ? `, ${picked.year}` : ""}</span>
              </h2>
              {state.seed ? <TraitList traits={state.seed.traits} /> : streaming && <ListeningLines />}
              <p aria-live="polite" className="text-sm text-white/60">
                {activeTrait && (
                  <>
                    {matching} {matching === 1 ? "album shares" : "albums share"} “{activeTrait}” ·{" "}
                    <button type="button" onClick={() => setActiveTrait(null)} className="underline underline-offset-2 hover:text-white">
                      Clear
                    </button>
                  </>
                )}
              </p>
            </div>
          </section>
        )}

        {/* Below the seed header, so it doesn't push the loading animation down when it appears.
            Timings are dev info for now; the planned debug panel is their real home. */}
        <StatusLine state={state} />

        {/* Kindred first: the "listen to this next" picks. They sit off the genre path, so they
            live outside the hourglass rather than in it. */}
        {/* The chart lists every genre before any album, so without reserved space the roots
            would render first and get pushed down when kindred arrives. While streaming, hold
            the section open from the first event with placeholders up to the usual 3 picks. */}
        {(kindred.some((a) => !isRejected(a)) || (streaming && state.firstEventAt)) && (
          <section aria-label="Kindred" className="mt-4">
            <SectionLabel label="Kindred" hint="Same feel, different scene" />
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
              <AlbumCards albums={kindred} coverClass="size-18" placeholderClass={KINDRED_PLACEHOLDER} />
              {streaming &&
                Array.from({ length: Math.max(0, KINDRED_COUNT - kindred.filter((a) => !isRejected(a)).length) }, (_, i) => (
                  <AlbumCardPlaceholder key={`reserved-${i}`} coverClass="size-18" className={KINDRED_PLACEHOLDER} />
                ))}
            </ul>
          </section>
        )}

        {state.genres.length > 0 && (
          <div className="mt-6">
            <LineageFlow genres={state.genres} albums={state.albums.filter((a) => !a.album.kindred)} />
          </div>
        )}
      </div>
    </ActiveTrait>
  );
}

// The prompt asks for 3 kindred picks.
const KINDRED_COUNT = 3;
// About a real kindred card's height (~180px), so the roots below don't move when it swaps in.
const KINDRED_PLACEHOLDER = "min-h-45";

function StatusLine({ state }: { state: ChartState }) {
  const confirmed = state.albums.filter((a) => a.check?.found).length;
  const hidden = state.albums.filter(isRejected).length;
  const seconds = (to?: number) => (state.startedAt && to ? ((to - state.startedAt) / 1000).toFixed(1) : null);

  let text: string | null = null;
  if (state.status === "streaming") {
    // Before the first event, the seed header's own status lines cover the wait.
    if (state.firstEventAt) text = `Mapping… ${state.genres.length} genres, ${confirmed} albums confirmed so far`;
  } else if (state.status === "done") {
    text = `Done in ${seconds(state.finishedAt)}s (first result after ${seconds(state.firstEventAt)}s). ${confirmed} albums confirmed on MusicBrainz`;
    text += hidden ? `; ${hidden} couldn't be confirmed and ${hidden === 1 ? "was" : "were"} left out.` : ".";
  } else if (state.status === "cancelled") {
    text = "Cancelled.";
  }

  if (state.status === "error") {
    return <p role="alert" className="text-sm text-red-300">{state.error}</p>;
  }
  return text ? <p aria-live="polite" className="text-sm text-white/60">{text}</p> : null;
}

// Which real events the seed loader has seen. Its loading state ends at the first confirmed
// kindred album (the "listen to this next" row is ready), or when the stream stops for any reason.
function seedProgress(state: ChartState): SeedProgress {
  const kindred = state.albums.filter((a) => a.album.kindred);
  return {
    traitsArrived: state.seed !== undefined,
    kindredNamed: kindred.length > 0,
    finished: state.status !== "streaming" || kindred.some((a) => a.check?.found),
  };
}

// Staged lines next to the seed cover until the traits replace them. They set the mood only:
// the halftone carries the real progress. The last line holds however long the wait is.
const LISTENING = ["Listening closely…", "Picking out its sound…", "Finding what makes it feel the way it does…"];
const LINE_MS = 3500;

function ListeningLines() {
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (line >= LISTENING.length - 1) return;
    const t = setTimeout(() => setLine(line + 1), LINE_MS);
    return () => clearTimeout(t);
  }, [line]);
  return (
    <p aria-live="polite" className="text-sm text-white/60">
      {/* Keyed so each new line fades in. */}
      <span key={line} className="animate-[fade-in_.5s_ease-out]">{LISTENING[line]}</span>
    </p>
  );
}
