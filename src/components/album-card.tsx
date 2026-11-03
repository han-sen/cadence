"use client";

import type { AlbumPick, Verification } from "@/lib/lineage/schema";
import type { AlbumEntry } from "@/lib/lineage/use-chart-stream";
import { Cover, CoverPlaceholder } from "./cover";
import { TraitList, useDimmed } from "./trait-filter";

// The match details for an album MusicBrainz confirmed. Extract picks the union member
// whose `found` is true.
export type Confirmed = Extract<Verification, { found: true }>;

// Checked and not found: the album may not exist, so it's never shown.
export const isRejected = (a: AlbumEntry) =>
  a.check !== undefined && !a.check.found;

// A close match can be a reissue or a differently named edition, so its year may be wrong.
export const albumYear = (album: AlbumPick, check: Confirmed) =>
  check.match === "exact" && check.year ? check.year : album.year;

// Full album card: cover, title, "why" and shared traits. The cover floats left so the text
// wraps underneath it instead of leaving a tall empty column; flow-root keeps the float inside.
// `coverClass` sets the cover size, e.g. "size-18".
export function AlbumCard({
  album,
  check,
  coverClass,
  isStandalone = false,
}: {
  album: AlbumPick;
  check: Confirmed;
  coverClass: string;
  isStandalone: boolean;
}) {
  const dimmed = useDimmed(album);
  return (
    <li
      className={`flow-root transition-opacity duration-200 shadow-sm ${isStandalone ? "bg-[linear-gradient(45deg,_rgba(255,_255,_255,_0.145),_transparent)] rounded p-4 animate-[fade-in_.5s_ease-out]" : ""} ${dimmed ? "opacity-30" : ""}`}
    >
      <Cover
        url={check.coverUrl}
        className={`float-left mt-0.5 mr-3 mb-1.5 ${coverClass}`}
      />
      <p className="text-sm">
        <span className="font-semibold">{album.title}</span>{" "}
        <span className="text-white/60">· {album.artist},</span>
        <span className="font-mono text-white/60">
          {" "}
          {albumYear(album, check)}
        </span>
      </p>
      <p className="mt-0.5 mb-2 text-[13px] text-white/60">{album.why}</p>
      <TraitList traits={album.sharedTraits} />
    </li>
  );
}

// Holds an album's spot while MusicBrainz checks it.
// `className` can add a min height where the swap must not move what's below (kindred).
export function AlbumCardPlaceholder({
  coverClass,
  className = "",
}: {
  coverClass: string;
  className?: string;
}) {
  return (
    <li aria-hidden className={`flex animate-pulse gap-3 ${className}`}>
      <CoverPlaceholder className={coverClass} />
      {/* Roughly a real card's height (title, a few lines of "why", a row of pills), so
          swapping in the real card barely moves anything. */}
      <div className="flex flex-1 flex-col gap-2 pt-1">
        <div className="h-3 w-1/2 rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/10" />
        <div className="h-3 w-5/6 rounded bg-white/10" />
        <div className="h-3 w-2/3 rounded bg-white/10" />
        <div className="mt-1 h-4 w-1/3 rounded-full bg-white/10" />
      </div>
    </li>
  );
}

// Only confirmed albums are shown: a placeholder while the check runs, nothing if it fails.
export function AlbumCards({
  albums,
  coverClass,
  placeholderClass,
  isStandalone = false,
}: {
  albums: AlbumEntry[];
  coverClass: string;
  placeholderClass?: string;
  isStandalone: boolean;
}) {
  return albums.map(({ id, album, check }) => {
    if (!check)
      return (
        <AlbumCardPlaceholder
          key={id}
          coverClass={coverClass}
          className={placeholderClass}
        />
      );
    if (!check.found) return null;
    return (
      <AlbumCard
        key={id}
        album={album}
        check={check}
        coverClass={coverClass}
        isStandalone={isStandalone}
      />
    );
  });
}
