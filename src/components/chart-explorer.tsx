"use client";

import { useState } from "react";
import type { AlbumPick, AlbumSuggestion, Genre, Verification } from "@/lib/lineage/schema";
import { type AlbumEntry, type ChartState, useChartStream } from "@/lib/lineage/use-chart-stream";
import { AlbumSearch } from "./album-search";
import { Cover, CoverPlaceholder } from "./cover";

// First working version: a plain list view of the streamed chart. The timeline
// (React Flow) replaces the genre sections later; the stream and state stay the same.
export function ChartExplorer() {
  const { state, start, cancel } = useChartStream();
  // The album picked in the search box. Shown straight away, so there's something on screen
  // during the ~20s before Claude's first result.
  const [picked, setPicked] = useState<AlbumSuggestion | null>(null);
  const streaming = state.status === "streaming";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Lineage</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Name an album you love. See where it came from, where it led, and what to play next.
        </p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <AlbumSearch
          isDisabled={streaming}
          onSelect={(album) => {
            setPicked(album);
            start(album.artist, album.title);
          }}
        />
        {streaming && (
          <div className="flex items-start sm:pt-6">
            <button type="button" onClick={cancel} className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700">
              Cancel
            </button>
          </div>
        )}
      </div>

      <StatusLine state={state} />

      {picked && state.status !== "idle" && (
        <section aria-label="Seed album" className="flex gap-4">
          <Cover key={picked.mbid} url={picked.coverUrl} className="size-24" />
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">
              {picked.title} <span className="font-normal text-zinc-500">· {picked.artist}{picked.year ? `, ${picked.year}` : ""}</span>
            </h2>
            {state.seed ? <TraitList traits={state.seed.traits} /> : <p className="text-sm text-zinc-400">Listening closely…</p>}
          </div>
        </section>
      )}

      {(["roots", "seed", "branches"] as const).map((role) => {
        const genres = state.genres.filter((g) => g.role === role);
        if (!genres.length) return null;
        return (
          <section key={role} aria-label={ROLE_LABEL[role]} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{ROLE_LABEL[role]}</h2>
            {genres.map((genre) => (
              <GenreSection key={genre.id} genre={genre} allGenres={state.genres} albums={state.albums.filter((a) => a.album.genreId === genre.id)} />
            ))}
          </section>
        );
      })}

      {state.albums.some((a) => a.album.kindred && !isRejected(a)) && (
        <section aria-label="Kindred" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Kindred · same feel, different path</h2>
          <AlbumList albums={state.albums.filter((a) => a.album.kindred)} />
        </section>
      )}
    </div>
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
    text = state.firstEventAt
      ? `Mapping… ${state.genres.length} genres, ${confirmed} albums confirmed so far`
      : "Thinking about where this record comes from…";
  } else if (state.status === "done") {
    text = `Done in ${seconds(state.finishedAt)}s (first result after ${seconds(state.firstEventAt)}s). ${confirmed} albums confirmed on MusicBrainz`;
    text += hidden ? `; ${hidden} couldn't be confirmed and ${hidden === 1 ? "was" : "were"} left out.` : ".";
  } else if (state.status === "cancelled") {
    text = "Cancelled.";
  }

  if (state.status === "error") {
    return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>;
  }
  return text ? <p aria-live="polite" className="text-sm text-zinc-500">{text}</p> : null;
}

function GenreSection({ genre, allGenres, albums }: { genre: Genre; allGenres: Genre[]; albums: AlbumEntry[] }) {
  const parents = genre.parentIds.map((id) => allGenres.find((g) => g.id === id)?.name).filter(Boolean);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="font-medium">
        {genre.name} <span className="font-normal text-zinc-500">· c. {genre.emergedYear}</span>
        {parents.length > 0 && <span className="block text-sm font-normal text-zinc-500">from {parents.join(" + ")}</span>}
      </h3>
      {!albums.length ? (
        <p className="text-sm text-zinc-400">Picking albums…</p>
      ) : albums.every(isRejected) ? (
        <p className="text-sm text-zinc-400">No confirmed albums for this genre.</p>
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
  return (
    <li className="flex gap-3">
      <Cover url={check.coverUrl} className="size-16" />
      <div className="flex flex-col gap-1">
        <p className="text-sm">
          <span className="font-medium">{album.title}</span> · {album.artist}, {year}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{album.why}</p>
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
        <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-5/6 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </li>
  );
}

function TraitList({ traits }: { traits: string[] }) {
  if (!traits.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {traits.map((t) => (
        <li key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{t}</li>
      ))}
    </ul>
  );
}
