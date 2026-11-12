"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AlbumSuggestion } from "@/lib/lineage/schema";
import {
  type ChartState,
  useChartStream,
} from "@/lib/lineage/use-chart-stream";
import { AlbumCards, isRejected } from "./album-card";
import { LineageFlow, SectionLabel } from "./lineage-flow";
import { SeedLoader, type SeedProgress } from "./seed-loader";
import { ActiveTrait, sameTrait, sharesTrait, TraitList } from "./trait-filter";
import { GradientBackdrop } from "./gradient-backdrop";
import { DuotoneBackdrop } from "./duotone-backdrop";
import { authClient } from "@/lib/auth-client";

// One album's chart page: the seed header, the lineage as an hourglass (roots → siblings →
// branches), then kindred picks from other genres. Everything fills in as the stream arrives.
// With a `chartId`, it replays that saved chart, for anyone. Without one, it makes the chart
// fresh, which needs sign-in.
export function ChartView({
  album,
  chartId,
}: {
  album: AlbumSuggestion;
  chartId?: string;
}) {
  const { state, start, play, cancel } = useChartStream();
  const [activeTrait, setActiveTrait] = useState<string | null>(null);
  const isStreaming = state.status === "streaming";
  const { data: session, isPending: sessionPending } = authClient.useSession();

  // What the page can do. A replay doesn't depend on the session, so a session that finishes
  // loading (or refreshes) mid-replay can't restart it.
  const mode = chartId
    ? "replay"
    : session
      ? "make"
      : sessionPending
        ? "waiting"
        : "signed-out";
  const { artist, title, mbid } = album;

  useEffect(() => {
    if (mode === "replay" && chartId) play(chartId);
    else if (mode === "make") start(artist, title, mbid);
  }, [mode, chartId, artist, title, mbid, play, start]);

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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-2 pb-6 sm:gap-5 sm:pt-4 sm:pb-10">
        <Link
          href="/"
          className="meta self-start text-(--muted) hover:text-(--ink)"
        >
          ← Chart another album
        </Link>

        <section
          aria-label="Seed album"
          className="surface-blue relative isolate animate-[fade-in_.4s_ease-out] overflow-hidden rounded-[32px] bg-accent p-6 motion-reduce:animate-none sm:p-8"
        >
          <DuotoneBackdrop coverUrl={album.coverUrl} />
          <div className="meta mb-6 flex justify-between gap-4 text-(--muted)">
            <span>Seed album</span>
            {isStreaming ? (
              <span>
                Mapping… ·{" "}
                <button
                  type="button"
                  onClick={cancel}
                  className="underline underline-offset-2 hover:text-(--ink)"
                >
                  Cancel
                </button>
              </span>
            ) : (
              state.status === "done" && <span>Mapped</span>
            )}
          </div>
          <div className="flex gap-5 sm:gap-8">
            {/* Keyed by the run, so a new run of the chart restarts the sequence. */}
            <SeedLoader
              key={state.startedAt}
              coverUrl={album.coverUrl}
              progress={seedProgress(state)}
              className="size-32 sm:size-60"
            />
            {/* Stretches to the cover's height, so the status line can sit level with its bottom edge. */}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <h2 className="display text-3xl break-words sm:text-6xl">
                {album.title}
              </h2>
              <p className="text-lg font-medium sm:text-xl">
                {album.artist}
                {album.year && (
                  <span className="font-normal text-(--muted)">
                    , {album.year}
                  </span>
                )}
              </p>

              {state.seed ? (
                <TraitList traits={state.seed.traits} />
              ) : mode === "signed-out" ? (
                <p className="text-sm text-(--muted)">
                  This album hasn&apos;t been charted yet. Sign in to chart it.
                </p>
              ) : (
                isStreaming && <WaitingLine isReplay={state.isReplay} />
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

// What shows next to the seed cover until the traits arrive. Nothing until the server says
// whether this is a new chart or a replay, so the wrong text never flashes up first.
function WaitingLine({ isReplay }: { isReplay?: boolean }) {
  if (isReplay === undefined) return null;
  return isReplay ? <ReplayLine /> : <ListeningLines />;
}

// A replay only reads a saved chart, so it says that instead of the listening lines.
function ReplayLine() {
  return (
    <p aria-live="polite" className="text-sm text-(--muted)">
      <span className="animate-[fade-in_.5s_ease-out]">
        Mapped before. Replaying the chart…
      </span>
    </p>
  );
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
