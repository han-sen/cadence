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
import { GradientBackdrop } from "./gradient-backdrop";
import { AuthButton } from "./auth-button";
import { DuotoneBackdrop } from "./duotone-backdrop";

// The chart page: search, the seed header, the lineage as an hourglass (roots →
// siblings → branches), then kindred picks from other genres. Everything fills in as the
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:gap-5 sm:py-10">
        {/* Bento header: the wordmark and search on a white card, the mark on a blue dot tile. */}
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[2fr_1fr]">
          <header className="flex flex-col gap-6 rounded-[32px] bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <span className="meta text-(--muted)">Genre lineage</span>
              <AuthButton />
            </div>
            <h1 className="display text-6xl sm:text-8xl">Lineage</h1>
            <p className="display max-w-xl text-xl text-(--muted) sm:text-2xl">
              Name an album you love. See where it came from, where it led, and
              what to play next.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <AlbumSearch
                isDisabled={isStreaming}
                onSelect={(album) => {
                  setPicked(album);
                  setActiveTrait(null);
                  start(album.artist, album.title);
                }}
              />
              {isStreaming && (
                <button
                  type="button"
                  onClick={cancel}
                  className="h-14 rounded-full border border-(--line) px-6 text-sm font-semibold uppercase hover:bg-(--chip)"
                >
                  Cancel
                </button>
              )}
            </div>
          </header>
          <ReadingKey />
        </div>

        {picked && state.status !== "idle" && (
          <section
            aria-label="Seed album"
            className="surface-blue relative isolate overflow-hidden rounded-[32px] bg-accent p-6 sm:p-8"
          >
            <DuotoneBackdrop coverUrl={picked.coverUrl} />
            <div className="meta mb-6 flex justify-between text-(--muted)">
              <span>Seed album</span>
              <span>{isStreaming ? "Mapping…" : "Mapped"}</span>
            </div>
            <div className="flex gap-5 sm:gap-8">
              {/* Keyed by the run, so picking an album again replays the sequence. */}
              <SeedLoader
                key={state.startedAt}
                coverUrl={picked.coverUrl}
                progress={seedProgress(state)}
                className="size-32 sm:size-60"
              />
              {/* Stretches to the cover's height, so the status line can sit level with its bottom edge. */}
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <h2 className="display text-3xl break-words sm:text-6xl">
                  {picked.title}
                </h2>
                <p className="text-lg font-medium sm:text-xl">
                  {picked.artist}
                  {picked.year && (
                    <span className="font-normal text-(--muted)">
                      , {picked.year}
                    </span>
                  )}
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
                  className="text-sm text-(--muted) empty:-mt-3"
                >
                  {activeTrait && (
                    <>
                      {matching}{" "}
                      {matching === 1 ? "album shares" : "albums share"} “
                      {activeTrait}” ·{" "}
                      <button
                        type="button"
                        onClick={() => setActiveTrait(null)}
                        className="underline underline-offset-2 hover:text-(--ink)"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
          </section>
        )}

        {state.genres.length > 0 && (
          <div className="mt-8">
            <LineageFlow
              genres={state.genres}
              albums={state.albums.filter((a) => !a.album.kindred)}
            />
          </div>
        )}
        {/* Kindred last: the cross-genre picks, "same feel, different genre". After the lineage
            story (roots → siblings → branches) they're the sideways step, and they sit
            outside the hourglass because they're off the genre path. At the bottom, nothing
            below them moves when they arrive, so they need no reserved space. */}
        {kindred.some((a) => !isRejected(a)) && (
          <section
            aria-label="Kindred"
            className="relative isolate mt-8 flex flex-col gap-5 overflow-hidden rounded-[32px] p-4 sm:p-6"
          >
            <GradientBackdrop />
            <div className="surface-blue self-start py-4">
              <SectionLabel label="Kindred" hint="Same feel, different genre" />
            </div>
            <ul className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
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
        <div className="mt-auto pt-6">
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
      <p role="alert" className="meta text-red-600">
        {state.error}
      </p>
    );
  }
  return text ? (
    <p aria-live="polite" className="meta text-(--muted)">
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
  "Looking at genre connections...",
  "Finalizing recommendations...",
];
const LINE_MS = 5000;

function ListeningLines() {
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (line >= LISTENING.length - 1) return;
    const t = setTimeout(() => setLine(line + 1), LINE_MS);
    return () => clearTimeout(t);
  }, [line]);
  return (
    <p aria-live="polite" className="text-sm text-(--muted)">
      {/* Keyed so each new line fades in. */}
      <span key={line} className="animate-[fade-in_.5s_ease-out]">
        {LISTENING[line]}
      </span>
    </p>
  );
}

// How to read a chart: the page's sections in order, on the blue dot tile next to the header.
// Their names and hints match the section labels further down.
const SECTIONS = [
  ["Roots", "Where it came from"],
  ["Siblings", "Same scene"],
  ["Branches", "Where it led"],
  ["Kindred", "Same feel, different genre"],
];

function ReadingKey() {
  return (
    <aside
      aria-label="How to read a chart"
      className="surface-blue relative isolate hidden flex-col justify-between gap-6 overflow-hidden rounded-[32px] bg-accent p-6 sm:flex sm:p-8"
    >
      <div aria-hidden className="dots absolute inset-0 -z-10" />
      <h2 className="meta text-(--muted)">How to read a chart</h2>
      <ol className="flex flex-col gap-4">
        {SECTIONS.map(([name, hint], i) => (
          <li key={name} className="flex items-baseline gap-4">
            <span className="meta w-5 shrink-0 text-(--faint)">0{i + 1}</span>
            <span>
              <span className="display block text-2xl">{name}</span>
              <span className="text-sm text-(--muted)">{hint}</span>
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
