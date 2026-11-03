"use client";

import type { ReactNode } from "react";
import { skippedParents } from "@/lib/lineage/cables";
import type { AlbumPick, Genre } from "@/lib/lineage/schema";
import type { AlbumEntry } from "@/lib/lineage/use-chart-stream";
import { AlbumCards, albumYear, type Confirmed, isRejected } from "./album-card";
import { Cover, CoverPlaceholder } from "./cover";
import { GenreCables } from "./genre-cables";
import { useDimmed } from "./trait-filter";

// The chart's lineage as an hourglass: the genres it grew out of (roots) flow into its own
// genres (nearest neighbors, the large middle tier), which fan out into what came after
// (branches). Cables follow the real "grew out of" links, so scrolling down reads as moving
// forward in time without a year axis.
export function LineageFlow({ genres, albums }: { genres: Genre[]; albums: AlbumEntry[] }) {
  const tier = (role: Genre["role"]) => genres.filter((g) => g.role === role);
  const albumsOf = (g: Genre) => albums.filter((a) => a.album.genreId === g.id);
  const roots = tier("roots"), seed = tier("seed"), branches = tier("branches");

  return (
    <section aria-label="Lineage" className="relative flex flex-col gap-10 sm:gap-14">
      <GenreCables genres={genres} />
      {roots.length > 0 && (
        <Tier label="Roots" hint="Where it came from">
          <CompactRow>{roots.map((g) => <CompactGenre key={g.id} genre={g} genres={genres} albums={albumsOf(g)} />)}</CompactRow>
        </Tier>
      )}
      {seed.length > 0 && (
        <Tier label="Nearest neighbors" hint="Same scene">
          {/* Side by side on wider screens, so every cable from the roots lands on a top edge
              instead of crossing a card. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
            {seed.map((g) => <LargeGenre key={g.id} genre={g} genres={genres} albums={albumsOf(g)} />)}
          </div>
        </Tier>
      )}
      {branches.length > 0 && (
        <Tier label="Branches" hint="Where it led">
          <CompactRow>{branches.map((g) => <CompactGenre key={g.id} genre={g} genres={genres} albums={albumsOf(g)} />)}</CompactRow>
        </Tier>
      )}
    </section>
  );
}

// Section label with its subtitle on a second line, so it stays narrow and clear of cables.
export function SectionLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <h2 className="mb-3 text-xs font-semibold tracking-wider text-white/60 uppercase">
      {label}
      <span className="mt-0.5 block font-normal tracking-normal text-white/45 normal-case">{hint}</span>
    </h2>
  );
}

function Tier({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div>
      <SectionLabel label={label} hint={hint} />
      {children}
    </div>
  );
}

// Centered row on wider screens; a sideways-scrolling row on phones.
function CompactRow({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
      {children}
    </div>
  );
}

// Genre name and year, plus the parent genres in text where there's no cable to show them:
// all of them on phones (cables are hidden), and only skipped tiers on wider screens.
function GenreHeading({ genre, genres, large }: { genre: Genre; genres: Genre[]; large?: boolean }) {
  const parents = genre.parentIds.map((id) => genres.find((g) => g.id === id)?.name).filter(Boolean);
  const skipped = skippedParents(genre, genres).map((g) => g.name);
  return (
    <>
      <h3 className={`font-semibold ${large ? "text-lg" : "text-[15px]"}`}>
        {genre.name} <span className="font-normal text-white/60">· c. {genre.emergedYear}</span>
      </h3>
      {parents.length > 0 && <p className="text-xs text-white/45 sm:hidden">from {parents.join(" + ")}</p>}
      {skipped.length > 0 && (
        <p className="text-xs text-white/45 max-sm:hidden">
          {/* "also" only when other parents already have cables into this card. */}
          {skipped.length < genre.parentIds.length ? "also " : ""}from {skipped.join(" + ")}
        </p>
      )}
    </>
  );
}

const CARD = "rounded-xl border border-white/15 bg-white/5";

// Roots and branches: name, year and a strip of small covers. Details stay in the big tier.
function CompactGenre({ genre, genres, albums }: { genre: Genre; genres: Genre[]; albums: AlbumEntry[] }) {
  return (
    <div data-genre-id={genre.id} className={`${CARD} w-[78%] shrink-0 snap-start px-3.5 py-3 sm:w-60`}>
      <GenreHeading genre={genre} genres={genres} />
      <GenreStatus albums={albums} />
      <ul className="mt-2.5 flex gap-1.5">
        {albums.map(({ id, album, check }) => {
          if (!check) return <li key={id} aria-hidden><CoverPlaceholder className="size-12 animate-pulse" /></li>;
          if (!check.found) return null;
          return <StripCover key={id} album={album} check={check} />;
        })}
      </ul>
    </div>
  );
}

function StripCover({ album, check }: { album: AlbumPick; check: Confirmed }) {
  const dimmed = useDimmed(album);
  const label = `${album.title} · ${album.artist}, ${albumYear(album, check)}`;
  return (
    <li title={label} className={`transition-opacity duration-200 ${dimmed ? "opacity-30" : ""}`}>
      <Cover url={check.coverUrl} className="size-12" />
      <span className="sr-only">{label}</span>
    </li>
  );
}

// Nearest neighbors: the seed's own genres, large, with full album cards.
function LargeGenre({ genre, genres, albums }: { genre: Genre; genres: Genre[]; albums: AlbumEntry[] }) {
  return (
    <div data-genre-id={genre.id} className={`${CARD} min-w-0 flex-1 border-white/20 bg-white/8 p-4 sm:px-5 sm:py-4.5`}>
      <GenreHeading genre={genre} genres={genres} large />
      <GenreStatus albums={albums} />
      <ul className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-x-6 gap-y-4.5">
        <AlbumCards albums={albums} coverClass="size-16 sm:size-22" />
      </ul>
    </div>
  );
}

// Text for a genre that has no albums to show yet, or none that checked out.
function GenreStatus({ albums }: { albums: AlbumEntry[] }) {
  if (!albums.length) return <p className="mt-2 text-sm text-white/45">Picking albums…</p>;
  if (albums.every(isRejected)) return <p className="mt-2 text-sm text-white/45">No confirmed albums for this genre.</p>;
  return null;
}
