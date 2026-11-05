"use client";

import type { ReactNode } from "react";
import type { Genre } from "@/lib/lineage/schema";
import type { AlbumEntry } from "@/lib/lineage/use-chart-stream";
import { AlbumCards, isRejected } from "./album-card";
import { GenreCables } from "./genre-cables";

// The chart's lineage as an hourglass: the genres it grew out of (roots) flow into its own
// genres (nearest neighbors, the middle tier), which fan out into what came after
// (branches). Cables follow the real "grew out of" links, so scrolling down reads as moving
// forward in time without a year axis.
export function LineageFlow({
  genres,
  albums,
}: {
  genres: Genre[];
  albums: AlbumEntry[];
}) {
  const tier = (role: Genre["role"]) => genres.filter((g) => g.role === role);
  const albumsOf = (g: Genre) => albums.filter((a) => a.album.genreId === g.id);
  const roots = tier("roots"),
    seed = tier("seed"),
    branches = tier("branches");

  return (
    <section
      aria-label="Lineage"
      className="relative flex flex-col gap-10 sm:gap-14"
    >
      <GenreCables genres={genres} />
      {roots.length > 0 && (
        <Tier label="Roots" hint="Where it came from">
          <GenreRow genres={roots} all={genres} albumsOf={albumsOf} />
        </Tier>
      )}
      {seed.length > 0 && (
        <Tier label="Nearest neighbors" hint="Same scene">
          <GenreRow genres={seed} all={genres} albumsOf={albumsOf} emphasis />
        </Tier>
      )}
      {branches.length > 0 && (
        <Tier label="Branches" hint="Where it led">
          <GenreRow genres={branches} all={genres} albumsOf={albumsOf} />
        </Tier>
      )}
    </section>
  );
}

// Section label with its subtitle on a second line, so it stays narrow and clear of cables.
export function SectionLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <h2 className="mb-3 text-lg font-semibold tracking-wider text-white/60 uppercase">
      {label}
      <span className="mt-0.5 block font-normal font-mono tracking-normal text-white/45 normal-case">
        {hint}
      </span>
    </h2>
  );
}

function Tier({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div>
      <SectionLabel label={label} hint={hint} />
      {children}
    </div>
  );
}

// One tier: its genre cards side by side on wider screens (so every cable lands on a top
// edge instead of crossing a card), stacked on phones.
function GenreRow({
  genres,
  all,
  albumsOf,
  emphasis,
}: {
  genres: Genre[];
  all: Genre[];
  albumsOf: (g: Genre) => AlbumEntry[];
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
      {genres.map((g) => (
        <GenreCard
          key={g.id}
          genre={g}
          genres={all}
          albums={albumsOf(g)}
          emphasis={emphasis}
        />
      ))}
    </div>
  );
}

// Genre name and year. On phones, where cables are hidden, the parent genres follow as text.
function GenreHeading({ genre, genres }: { genre: Genre; genres: Genre[] }) {
  const parents = genre.parentIds
    .map((id) => genres.find((g) => g.id === id)?.name)
    .filter(Boolean);
  return (
    <>
      <h3 className="text-lg font-semibold p-4">
        <span className="pr-4">{genre.name}</span>

        <span className="font-mono text-md text-white/60">
          c. {genre.emergedYear}
        </span>
      </h3>
      {parents.length > 0 && (
        <p className="text-xs text-white/45 sm:hidden">
          from {parents.join(" + ")}
        </p>
      )}
    </>
  );
}

const CARD = "rounded-xl border border-white/15 bg-white/5";

// A genre with its albums, all open. Every tier uses it; nearest neighbors (the hourglass's
// waist) gets a slightly brighter fill via `emphasis`.
function GenreCard({
  genre,
  genres,
  albums,
  emphasis,
}: {
  genre: Genre;
  genres: Genre[];
  albums: AlbumEntry[];
  emphasis?: boolean;
}) {
  return (
    <div
      data-genre-id={genre.id}
      className={`${CARD} min-w-0 flex-1 p-0 ${emphasis ? "border-white/20 bg-white/8" : ""}`}
    >
      <GenreHeading genre={genre} genres={genres} />
      <GenreStatus albums={albums} />
      <ul className="mt-0 grid overflow-hidden grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-0">
        <AlbumCards
          albums={albums}
          coverClass="size-16 sm:size-22"
          isStandalone={false}
        />
      </ul>
    </div>
  );
}

// Text for a genre that has no albums to show yet, or none that checked out.
function GenreStatus({ albums }: { albums: AlbumEntry[] }) {
  if (!albums.length)
    return <p className="mt-2 text-sm text-white/45">Picking albums…</p>;
  if (albums.every(isRejected))
    return (
      <p className="mt-2 text-sm text-white/45">
        No confirmed albums for this genre.
      </p>
    );
  return null;
}
