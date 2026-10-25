"use client";

import { type FormEvent, useState } from "react";
import type { Genre } from "@/lib/lineage/schema";
import { type AlbumEntry, type ChartState, useChartStream } from "@/lib/lineage/use-chart-stream";

// First working version: a plain list view of the streamed chart. The timeline
// (React Flow) replaces the genre sections later; the stream and state stay the same.
export function ChartExplorer() {
  const { state, start, cancel } = useChartStream();
  const [artist, setArtist] = useState("Burial");
  const [title, setTitle] = useState("Untrue");
  const streaming = state.status === "streaming";

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (artist.trim() && title.trim()) start(artist.trim(), title.trim());
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Lineage</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Name an album you love. See where it came from, where it led, and what to play next.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <LabeledInput label="Artist" value={artist} onChange={setArtist} disabled={streaming} />
        <LabeledInput label="Album" value={title} onChange={setTitle} disabled={streaming} />
        <div className="flex items-end">
          {streaming ? (
            // key + preventDefault: React would otherwise reuse this <button> as the submit
            // button below, and the click would submit the form right after cancelling.
            <button
              key="cancel"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                cancel();
              }}
              className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700">
              Cancel
            </button>
          ) : (
            <button key="submit" type="submit" className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              Map it
            </button>
          )}
        </div>
      </form>

      <StatusLine state={state} />

      {state.seed && (
        <section aria-label="Seed album" className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">
            {state.seed.title} <span className="font-normal text-zinc-500">· {state.seed.artist}, {state.seed.year}</span>
          </h2>
          <TraitList traits={state.seed.traits} />
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

      {state.albums.some((a) => a.album.kindred) && (
        <section aria-label="Kindred" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Kindred · same feel, different path</h2>
          <AlbumList albums={state.albums.filter((a) => a.album.kindred)} />
        </section>
      )}
    </div>
  );
}

const ROLE_LABEL = { roots: "Roots", seed: "Where it sits", branches: "Branches" } as const;

function LabeledInput(props: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
      {props.label}
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        className="h-10 rounded-md border border-zinc-300 bg-transparent px-3 font-normal disabled:opacity-60 dark:border-zinc-700"
      />
    </label>
  );
}

function StatusLine({ state }: { state: ChartState }) {
  const checked = state.albums.filter((a) => a.check).length;
  const found = state.albums.filter((a) => a.check?.found).length;
  const seconds = (to?: number) => (state.startedAt && to ? ((to - state.startedAt) / 1000).toFixed(1) : null);

  let text: string | null = null;
  if (state.status === "streaming") {
    text = state.firstEventAt
      ? `Mapping… ${state.genres.length} genres, ${state.albums.length} albums so far, ${checked} checked`
      : "Thinking about where this record comes from…";
  } else if (state.status === "done") {
    text = `Done in ${seconds(state.finishedAt)}s (first result after ${seconds(state.firstEventAt)}s). ${found}/${state.albums.length} albums confirmed on MusicBrainz.`;
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
      {albums.length ? <AlbumList albums={albums} /> : <p className="text-sm text-zinc-400">Picking albums…</p>}
    </div>
  );
}

function AlbumList({ albums }: { albums: AlbumEntry[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {albums.map(({ id, album, check }) => {
        const missing = check && !check.found;
        return (
          <li key={id} className={`flex gap-3 ${missing ? "opacity-40" : ""}`}>
            <CheckBadge check={check} />
            <div className="flex flex-col gap-1">
              <p className="text-sm">
                <span className="font-medium">{album.title}</span> · {album.artist}, {check?.found && check.match === "exact" && check.year ? check.year : album.year}
                {missing && <span className="text-zinc-500"> · couldn&apos;t confirm this album exists</span>}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{album.why}</p>
              <TraitList traits={album.sharedTraits} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CheckBadge({ check }: { check?: AlbumEntry["check"] }) {
  if (!check) return <span title="Checking MusicBrainz…" aria-label="Checking" className="mt-1 size-3 shrink-0 animate-pulse rounded-full bg-zinc-300 dark:bg-zinc-700" />;
  if (check.found) return <span title="Confirmed on MusicBrainz" aria-label="Confirmed" className="mt-1 size-3 shrink-0 rounded-full bg-emerald-500" />;
  return <span title={check.reason} aria-label="Not found" className="mt-1 size-3 shrink-0 rounded-full border border-zinc-400" />;
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
