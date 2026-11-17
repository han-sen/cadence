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
        <Tier number="01" label="Roots" hint="Where it came from" count={tierCount(roots)}>
          <GenreRow genres={roots} all={genres} albumsOf={albumsOf} />
        </Tier>
      )}
      {seed.length > 0 && (
        <Tier number="02" label="Siblings" hint="Same scene" count={tierCount(seed)}>
          <GenreRow genres={seed} all={genres} albumsOf={albumsOf} emphasis />
        </Tier>
      )}
      {branches.length > 0 && (
        <Tier number="03" label="Branches" hint="Where it led" count={tierCount(branches)}>
          <GenreRow genres={branches} all={genres} albumsOf={albumsOf} />
        </Tier>
      )}
    </section>
  );
}

// Section label with its subtitle on a line above. A numbered label is one of a chart's four
// sections: the number matches the home page's reading key, and `count` says what the section
// holds, set small at the far right, level with the title's baseline. Nothing joins the two,
// so cables can pass between them.
export function SectionLabel({
  label,
  hint,
  number,
  count,
}: {
  label: string;
  hint: string;
  number?: string;
  count?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="meta text-(--muted)">{hint}</span>
        <h2 className="display text-4xl sm:text-5xl">
          {number && (
            <span aria-hidden className="mr-[0.28em] text-(--faint)">
              {number}
            </span>
          )}
          {label}
        </h2>
      </div>
      {count && (
        <span className="meta mb-1.5 whitespace-nowrap text-(--muted)">
          {count}
        </span>
      )}
    </div>
  );
}

// "2 genres · 1978–1985": how many genres a tier has and when they emerged.
function tierCount(genres: Genre[]) {
  const years = genres.map((g) => g.emergedYear);
  const first = Math.min(...years);
  const last = Math.max(...years);
  const span = first === last ? `c. ${first}` : `${first}–${last}`;
  return `${genres.length} ${genres.length === 1 ? "genre" : "genres"} · ${span}`;
}

function Tier({
  number,
  label,
  hint,
  count,
  children,
}: {
  number: string;
  label: string;
  hint: string;
  count: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SectionLabel label={label} hint={hint} number={number} count={count} />
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

// Album grid inside a genre card, sized by the card's width: one row of three once the card
// has room (a genre alone in its tier, usually), two columns when narrower (genres side by
// side, tablets) with an odd last album spanning both, so its top line runs the full width
// (at that width the album card lays out side by side), and one column on phones.
const ALBUM_GRID =
  "grid-cols-1 @[420px]:grid-cols-2 [&>li:last-child:nth-child(odd)]:col-span-full " +
  "@[760px]:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] @[760px]:[&>li:last-child:nth-child(odd)]:col-span-1";

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
      className={`${CARD} @container flex min-w-0 flex-1 flex-col ${emphasis ? "surface-blue depth-tile-low bg-accent" : "depth-card-low bg-(--tile-floor)"}`}
    >
      <GenreHeading genre={genre} genres={genres} />
      <GenreStatus albums={albums} />
      {/* A card can be stretched to match a taller one beside it. The list fills the extra
          height and its rows stretch with it, so the album tiles reach the bottom of the card
          instead of stopping short. */}
      <ul className={`grid flex-1 gap-2 px-2.5 pb-2.5 ${ALBUM_GRID}`}>
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
