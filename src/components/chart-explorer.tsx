"use client";

import { useEffect, useMemo, useState } from "react";
import type { AlbumSuggestion } from "@/lib/lineage/schema";
import {
  type ChartState,
  useChartStream,
} from "@/lib/lineage/use-chart-stream";
import { AlbumCards, isRejected } from "./album-card";
import { AlbumSearch } from "./album-search";
import { LineageFlow, SectionLabel } from "./lineage-flow";
import { SeedLoader, type SeedProgress } from "./seed-loader";
import { ActiveTrait, sameTrait, sharesTrait, TraitList } from "./trait-filter";

// The chart page: search, the seed header, the lineage as an hourglass (roots → nearest
// neighbors → branches), then kindred picks from other genres. Everything fills in as the
// stream arrives.
export function ChartExplorer() {
  const { state, start, cancel } = useChartStream();
  // The album picked in the search box. Shown straight away, so there's something on screen
  // during the ~20s before Claude's first result.
  const [picked, setPicked] = useState<AlbumSuggestion | null>(null);
  const [activeTrait, setActiveTrait] = useState<string | null>(null);
  const isStreaming = state.status === "streaming";

  // Clicking the active trait again clears it.
  const traitContext = useMemo(
    () => ({
      active: activeTrait,
      toggle: (t: string) =>
        setActiveTrait((cur) => (cur && sameTrait(cur, t) ? null : t)),
    }),
    [activeTrait],
  );
  const matching = activeTrait
    ? state.albums.filter(
        (a) => a.check?.found && sharesTrait(a.album, activeTrait),
      ).length
    : 0;
  const kindred = state.albums.filter((a) => a.album.kindred);

  return (
    <ActiveTrait value={traitContext}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Lineage</h1>
          <p className="text-white/60">
            Name an album you love. See where it came from, where it led, and
            what to play next.
          </p>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row">
          <AlbumSearch
            isDisabled={isStreaming}
            onSelect={(album) => {
              setPicked(album);
              setActiveTrait(null);
              start(album.artist, album.title);
            }}
          />
          {isStreaming && (
            <div className="flex items-start sm:pt-6">
              <button
                type="button"
                onClick={cancel}
                className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {picked && state.status !== "idle" && (
          <section aria-label="Seed album" className="flex gap-4 sm:gap-5">
            {/* Keyed by the run, so picking an album again replays the sequence. */}
            <SeedLoader
              key={state.startedAt}
              coverUrl={picked.coverUrl}
              progress={seedProgress(state)}
              className="size-28 sm:size-40"
            />
            {/* Stretches to the cover's height, so the status line can sit level with its bottom edge. */}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2 className="text-3xl font-semibold sm:text-2xl">
                {picked.title}
              </h2>
              <p>
                {" "}
                <span className="font-normal text-white/60">
                  {picked.artist}
                </span>
                <span className="font-mono text-white/40">
                  {picked.year ? `, ${picked.year}` : ""}
                </span>
              </p>

              {state.seed ? (
                <TraitList traits={state.seed.traits} />
              ) : (
                isStreaming && <ListeningLines />
              )}
              {/* Empty most of the time. A negative margin cancels its gap rather than hiding it,
                  because a hidden live region can miss announcing new text. */}
              <p
                aria-live="polite"
                className="text-sm text-white/60 empty:-mt-2"
              >
                {activeTrait && (
                  <>
                    {matching}{" "}
                    {matching === 1 ? "album shares" : "albums share"} “
                    {activeTrait}” ·{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTrait(null)}
                      className="underline underline-offset-2 hover:text-white"
                    >
                      Clear
                    </button>
                  </>
                )}
              </p>
            </div>
          </section>
        )}

        {state.genres.length > 0 && (
          <div className="mt-6">
            <LineageFlow
              genres={state.genres}
              albums={state.albums.filter((a) => !a.album.kindred)}
            />
          </div>
        )}
        {/* Kindred last: the cross-genre picks, "same feel, different genre". After the lineage
            story (roots → nearest neighbors → branches) they're the sideways step, and they sit
            outside the hourglass because they're off the genre path. At the bottom, nothing
            below them moves when they arrive, so they need no reserved space. */}
        {kindred.some((a) => !isRejected(a)) && (
          <section aria-label="Kindred" className="mt-6">
            <SectionLabel label="Kindred" hint="Same feel, different genre" />
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
              <AlbumCards
                albums={kindred}
                coverClass="size-18"
                isStandalone={true}
              />
            </ul>
          </section>
        )}

        {/* At the bottom of the page. Timings are dev info for now; the planned debug panel
            is their real home. */}
        <div className="mt-auto">
          <StatusLine state={state} />
        </div>
      </div>
    </ActiveTrait>
  );
}

function StatusLine({ state }: { state: ChartState }) {
  const confirmed = state.albums.filter((a) => a.check?.found).length;
  const hidden = state.albums.filter(isRejected).length;
  const seconds = (to?: number) =>
    state.startedAt && to ? ((to - state.startedAt) / 1000).toFixed(1) : null;

  let text: string | null = null;
  if (state.status === "streaming") {
    // Before the first event, the seed header's own status lines cover the wait.
    if (state.firstEventAt)
      text = `Mapping… ${state.genres.length} genres, ${confirmed} albums confirmed so far`;
  } else if (state.status === "done") {
    text = `Done in ${seconds(state.finishedAt)}s (first result after ${seconds(state.firstEventAt)}s). ${confirmed} albums confirmed on MusicBrainz`;
    text += hidden
      ? `; ${hidden} couldn't be confirmed and ${hidden === 1 ? "was" : "were"} left out.`
      : ".";
  } else if (state.status === "cancelled") {
    text = "Cancelled.";
  }

  if (state.status === "error") {
    return (
      <p role="alert" className="text-xs font-mono text-red-300">
        {state.error}
      </p>
    );
  }
  return text ? (
    <p aria-live="polite" className="text-xs font-mono text-white/60">
      {text}
    </p>
  ) : null;
}

// Which real events the seed loader has seen. Its loading state ends at the first confirmed
// album, when the lineage below has something to read, or when the stream stops for any reason.
function seedProgress(state: ChartState): SeedProgress {
  return {
    traitsArrived: state.seed !== undefined,
    albumsNamed: state.albums.length > 0,
    finished:
      state.status !== "streaming" || state.albums.some((a) => a.check?.found),
  };
}

// Staged lines next to the seed cover until the traits replace them. They set the mood only:
// the halftone carries the real progress. The last line holds however long the wait is.
const LISTENING = [
  "Listening closely...",
  "Analyzing the album's sound...",
  "Finding what makes it feel the way it does...",
  "Generating mood labels...",
  "Analyzing album lineage...",
  "Finalizing recommendations...",
];
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
      <span key={line} className="animate-[fade-in_.5s_ease-out]">
        {LISTENING[line]}
      </span>
    </p>
  );
}
