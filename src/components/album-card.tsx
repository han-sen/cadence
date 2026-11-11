"use client";

import type { AlbumPick, Verification } from "@/lib/lineage/schema";
import type { AlbumEntry } from "@/lib/lineage/use-chart-stream";
import { Cover, CoverPlaceholder } from "./cover";
import { TraitList, useDimmed } from "./trait-filter";
import { AlbumLinks } from "./album-links";

// The match details for an album MusicBrainz confirmed. Extract picks the union member
// whose `found` is true.
export type Confirmed = Extract<Verification, { found: true }>;

// Checked and not found: the album may not exist, so it's never shown.
export const isRejected = (a: AlbumEntry) =>
  a.check !== undefined && !a.check.found;

// A close match can be a reissue or a differently named edition, so its year may be wrong.
export const albumYear = (album: AlbumPick, check: Confirmed) =>
  check.match === "exact" && check.year ? check.year : album.year;

// Padding and lines shared by the card and its placeholder, so the swap doesn't shift anything.
// In a genre card, albums sit in a grid: top and left lines only, so neighbors don't double up
// and the last row has no bottom line. The list clips the leftmost line at the card's edge.
// Kindred albums stand alone, so they keep a full border.
const cardFrame = (isStandalone: boolean) =>
  isStandalone
    ? "rounded-3xl bg-white p-5"
    : "-ml-px border-t border-l border-(--line) p-5";

// Full album card: cover and title, then "why", links and shared traits. Stacked in a narrow
// card; once the card is 400px wide (an odd last album spanning its genre card, say) the
// second part moves beside the first. Wider still (a lone album filling a genre card), the
// first part stops growing at 20rem, so "why" sits next to the title instead of past the
// middle. `coverClass` sets the cover size, e.g. "size-18".
const WIDE =
  "@[400px]:grid @[400px]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] @[400px]:gap-x-8 " +
  "@[640px]:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]";
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
      className={`@container ${cardFrame(isStandalone)} transition-opacity duration-200 ${dimmed ? "opacity-30" : ""}`}
    >
      <div className={WIDE}>
        <div className="flex gap-4">
          <Cover url={check.coverUrl} className={coverClass} />
          <div className="flex flex-col justify-between">
            <div>
              <p className="text-lg leading-tight font-semibold tracking-tight">
                {album.title}
              </p>
              <p className="mt-0.5 text-(--muted)">{album.artist}</p>
              <p className="meta mt-1.5 text-(--faint)">
                {albumYear(album, check)}
              </p>
            </div>

            {/* Kindred picks only: the genre outside the chart that makes them kindred. */}
            {/* {album.kindredGenre && (
              <span className="text-white/40"> · {album.kindredGenre}</span>
            )} */}
          </div>
        </div>
        <div>
          <p className="mt-4 max-w-[60ch] text-sm leading-snug text-(--muted) @[400px]:mt-0">
            {album.why}
          </p>
          <AlbumLinks artist={album.artist} title={album.title} />
          <TraitList traits={album.sharedTraits} />
        </div>
      </div>
    </li>
  );
}

// Holds an album's spot while MusicBrainz checks it. Laid out like the real card (cover with
// title and artist, a few lines of "why", the link icons, a row of pills) inside the same frame,
// so swapping in the real card barely moves anything.
// `className` can add a min height where the swap must not move what's below (kindred).
export function AlbumCardPlaceholder({
  coverClass,
  isStandalone,
  className = "",
}: {
  coverClass: string;
  isStandalone: boolean;
  className?: string;
}) {
  return (
    <li
      aria-hidden
      className={`@container animate-pulse ${cardFrame(isStandalone)} ${className}`}
    >
      <div className={WIDE}>
        <div className="flex gap-4">
          <CoverPlaceholder className={coverClass} />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-4 w-2/3 rounded bg-(--chip)" />
            <div className="h-4 w-1/2 rounded bg-(--chip)" />
          </div>
        </div>
        <div>
          <div className="mt-3 mb-3 flex flex-col gap-2 @[400px]:mt-0">
            <div className="h-3 w-full rounded bg-(--chip)" />
            <div className="h-3 w-5/6 rounded bg-(--chip)" />
          </div>
          <div className="flex gap-2">
            <div className="size-7 rounded-full bg-(--chip)" />
            <div className="size-7 rounded-full bg-(--chip)" />
          </div>
          <div className="mt-3 h-6 w-1/3 rounded-full bg-(--chip)" />
        </div>
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
          isStandalone={isStandalone}
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
