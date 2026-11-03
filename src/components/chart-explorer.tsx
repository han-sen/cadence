"use client";

import { createContext, use, useEffect, useMemo, useState } from "react";
import type { AlbumPick, AlbumSuggestion, Genre, Verification } from "@/lib/lineage/schema";
import { type AlbumEntry, type ChartState, useChartStream } from "@/lib/lineage/use-chart-stream";
import { AlbumSearch } from "./album-search";
import { Cover, CoverPlaceholder } from "./cover";
import { SeedLoader, type SeedProgress } from "./seed-loader";

// The trait the user clicked, if any. Shared through context because trait pills and album
// rows sit several components deep (genre section → album list → row → pills).
const ActiveTrait = createContext<{ active: string | null; toggle: (trait: string) => void }>({
  active: null,
  toggle: () => {},
});

// Claude copies traits from the seed's list, but compare loosely in case the casing drifts.
const sameTrait = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const sharesTrait = (album: AlbumPick, trait: string) => album.sharedTraits.some((t) => sameTrait(t, trait));

// First working version: a plain list view of the streamed chart. The timeline
// (React Flow) replaces the genre sections later; the stream and state stay the same.
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

  return (
    <ActiveTrait value={traitContext}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
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
          <section aria-label="Seed album" className="flex gap-4">
            {/* Keyed by the run, so picking an album again replays the sequence. */}
            <SeedLoader key={state.startedAt} coverUrl={picked.coverUrl} progress={seedProgress(state)} className="size-32 sm:size-40" />
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">
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

        {/* Kindred picks come first: they're the "listen to this next" recommendations. */}
        {state.albums.some((a) => a.album.kindred && !isRejected(a)) && (
          <section aria-label="Kindred" className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">Kindred · same feel, different path</h2>
            <AlbumList albums={state.albums.filter((a) => a.album.kindred)} />
          </section>
        )}

        {(["roots", "seed", "branches"] as const).map((role) => {
          const genres = state.genres.filter((g) => g.role === role);
          if (!genres.length) return null;
          return (
            <section key={role} aria-label={ROLE_LABEL[role]} className="flex flex-col gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">{ROLE_LABEL[role]}</h2>
              {genres.map((genre) => (
                <GenreSection key={genre.id} genre={genre} allGenres={state.genres} albums={state.albums.filter((a) => a.album.genreId === genre.id)} />
              ))}
            </section>
          );
        })}
      </div>
    </ActiveTrait>
  );
}

const ROLE_LABEL = { roots: "Roots", seed: "Where it sits", branches: "Branches" } as const;

// The match details for an album MusicBrainz confirmed. Extract picks the union member
// whose `found` is true.
type Confirmed = Extract<Verification, { found: true }>;

// Checked and not found: the album may not exist, so it's never shown.
const isRejected = (a: AlbumEntry) => a.check !== undefined && !a.check.found;

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

function GenreSection({ genre, allGenres, albums }: { genre: Genre; allGenres: Genre[]; albums: AlbumEntry[] }) {
  const parents = genre.parentIds.map((id) => allGenres.find((g) => g.id === id)?.name).filter(Boolean);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/15 p-4">
      <h3 className="font-medium">
        {genre.name} <span className="font-normal text-white/60">· c. {genre.emergedYear}</span>
        {parents.length > 0 && <span className="block text-sm font-normal text-white/60">from {parents.join(" + ")}</span>}
      </h3>
      {!albums.length ? (
        <p className="text-sm text-white/45">Picking albums…</p>
      ) : albums.every(isRejected) ? (
        <p className="text-sm text-white/45">No confirmed albums for this genre.</p>
      ) : (
        <AlbumList albums={albums} />
      )}
    </div>
  );
}

// Only confirmed albums are shown. While MusicBrainz is still checking one, a placeholder
// holds its spot; if the check fails, the album is left out.
function AlbumList({ albums }: { albums: AlbumEntry[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {albums.map(({ id, album, check }) => {
        if (!check) return <AlbumPlaceholder key={id} />;
        if (!check.found) return null;
        return <AlbumRow key={id} album={album} check={check} />;
      })}
    </ul>
  );
}

function AlbumRow({ album, check }: { album: AlbumPick; check: Confirmed }) {
  // A close match can be a reissue or a differently named edition, so its year may be wrong.
  const year = check.match === "exact" && check.year ? check.year : album.year;
  const { active } = use(ActiveTrait);
  const dimmed = active !== null && !sharesTrait(album, active);
  return (
    <li className={`flex gap-3 transition-opacity duration-200 ${dimmed ? "opacity-30" : ""}`}>
      <Cover url={check.coverUrl} className="size-16" />
      <div className="flex flex-col gap-1">
        <p className="text-sm">
          <span className="font-medium">{album.title}</span> · {album.artist}, {year}
        </p>
        <p className="text-sm text-white/60">{album.why}</p>
        <TraitList traits={album.sharedTraits} />
      </div>
    </li>
  );
}

function AlbumPlaceholder() {
  return (
    <li aria-hidden className="flex animate-pulse gap-3">
      <CoverPlaceholder className="size-16" />
      <div className="flex flex-1 flex-col gap-2 pt-1">
        <div className="h-3 w-1/2 rounded bg-white/10" />
        <div className="h-3 w-5/6 rounded bg-white/10" />
      </div>
    </li>
  );
}

// Each pill is a toggle button: clicking it fades every album that doesn't share the trait.
function TraitList({ traits }: { traits: string[] }) {
  const { active, toggle } = use(ActiveTrait);
  if (!traits.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {traits.map((t) => {
        const pressed = active !== null && sameTrait(active, t);
        return (
          <li key={t}>
            <button
              type="button"
              aria-pressed={pressed}
              onClick={() => toggle(t)}
              className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                pressed
                  ? "bg-white text-zinc-950"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {t}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
