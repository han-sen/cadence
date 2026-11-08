"use client";

import type { ReactNode } from "react";
import type { Genre } from "@/lib/lineage/schema";
import type { AlbumEntry } from "@/lib/lineage/use-chart-stream";
import { AlbumCards, isRejected } from "./album-card";
import { GenreCables } from "./genre-cables";

// The chart's lineage as an hourglass: the genres it grew out of (roots) flow into its own
// genres (siblings, the middle tier), which fan out into what came after
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
        <Tier label="Siblings" hint="Same scene">
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
    <div className="flex flex-col gap-1.5">
      <span className="meta text-(--muted)">{hint}</span>
      <h2 className="display text-4xl sm:text-5xl">{label}</h2>
    </div>
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
    <div className="flex flex-col gap-4">
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
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-8 my-6">
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
      <div className="meta flex justify-between px-5 pt-5 text-(--muted)">
        <span>Genre</span>
        <span>c. {genre.emergedYear}</span>
      </div>
      <h3 className="display px-5 pt-3 pb-5 text-2xl sm:text-3xl">
        {genre.name}
      </h3>
      {parents.length > 0 && (
        <p className="meta -mt-3 px-5 pb-4 text-(--faint) sm:hidden">
          from {parents.join(" + ")}
        </p>
      )}
    </>
  );
}

const CARD = "overflow-hidden rounded-[28px]";

// Album grids inside a genre card.
// Siblings sit side by side in one wide card, so their albums fill a single row.
const ROW_GRID = "grid-cols-[repeat(auto-fit,minmax(240px,1fr))]";
// Roots and branches stack their genre cards, so each card is narrower: two columns when it
// has room, and an odd last album spans both, so its top line runs the full width (at that
// width the album card lays out side by side).
const STACK_GRID =
  "grid-cols-1 @[420px]:grid-cols-2 [&>li:last-child:nth-child(odd)]:col-span-full";

// A genre with its albums, all open. Every tier uses it; siblings (the hourglass's
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
      className={`${CARD} @container min-w-0 flex-1 ${emphasis ? "surface-blue bg-accent" : "bg-white"}`}
    >
      <GenreHeading genre={genre} genres={genres} />
      <GenreStatus albums={albums} />
      <ul
        className={`grid overflow-hidden ${emphasis ? ROW_GRID : STACK_GRID}`}
      >
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
    return <p className="meta px-5 pb-5 text-(--faint)">Picking albums…</p>;
  if (albums.every(isRejected))
    return (
      <p className="meta px-5 pb-5 text-(--faint)">
        No confirmed albums for this genre.
      </p>
    );
  return null;
}
