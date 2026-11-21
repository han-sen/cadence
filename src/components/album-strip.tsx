import Link from "next/link";
import { Cover } from "./cover";

// What the strip needs from each album. The demo charts fit it today; a "most charted" list from
// saved charts can feed it later without changing the strip.
export type StripAlbum = {
  mbid: string;
  title: string;
  artist: string;
  coverUrl: string;
};

// How many copies of the list the track holds. The animation moves it left by exactly one copy
// and then loops, so the copies have to cover a wide screen plus that one copy; three does it
// for six albums at 2560px.
const COPIES = 3;

// A full-width row of record sleeves that drifts slowly left and runs off both edges, each a
// link to its album's chart page. Hovering or focusing pauses it. Only the first copy is real
// to screen readers and the keyboard; the rest are hidden from both but still clickable, since
// after the first pass most sleeves on screen come from them.
// Under reduced motion it doesn't move: it's a single copy you scroll sideways.
export function AlbumStrip({
  albums,
  label,
}: {
  albums: StripAlbum[];
  label: string;
}) {
  return (
    <section
      aria-label={label}
      // Faded at both edges so the sleeves slip in and out rather than being cut off. The
      // vertical padding leaves room for the hover lift and shadows, which would be clipped:
      // the cards' shadows reach about 64px below them, and clipping them sooner leaves a
      // hard line under the row.
      // When a sleeve has keyboard focus the strip stops at its start, so the fade comes off
      // and the row gets a gutter, or the first sleeve would sit faded against the edge.
      // Keyboard focus only (:focus-visible): a mouse press also focuses the link, and if the
      // row jumped then, the release would land somewhere else and the click would be lost.
      className="marquee-mask overflow-hidden pt-6 pb-16 has-[:focus-visible]:mask-none motion-reduce:overflow-x-auto"
    >
      <div
        className="marquee-track flex w-max hover:[animation-play-state:paused] has-[:focus-visible]:animate-none has-[:focus-visible]:pl-4 motion-reduce:animate-none"
        style={{ "--marquee-copies": COPIES } as React.CSSProperties}
      >
        {Array.from({ length: COPIES }, (_, copy) => (
          <ul
            key={copy}
            aria-hidden={copy > 0 || undefined}
            className={`flex ${copy > 0 ? "motion-reduce:hidden" : ""}`}
          >
            {albums.map((album) => (
              // Spaced with right padding, not a flex gap, so every copy is the same width
              // and the loop has no jump.
              <li key={album.mbid} className="w-56 shrink-0 pr-5 sm:w-72 sm:pr-7">
                <Sleeve album={album} isCopy={copy > 0} />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}

// One album as a card: the cover as a sleeve with its record half out on the right, which
// slides further out and turns on hover. The whole card is the link and lifts on hover.
// A copy's link is left out of the tab order (it's also hidden from screen readers), so the
// keyboard only reaches each album once.
function Sleeve({ album, isCopy }: { album: StripAlbum; isCopy: boolean }) {
  return (
    <Link
      tabIndex={isCopy ? -1 : undefined}
      href={`/album/${album.mbid}`}
      className="group depth-card hover:depth-card-raised flex h-full flex-col gap-3 rounded-[28px] bg-white p-3 text-left transition duration-200 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-4"
    >
      <div className="relative pr-[16%]">
        <span
          aria-hidden
          className="record absolute inset-y-[4%] right-[2%] aspect-square transition-transform duration-300 ease-out group-hover:translate-x-[9%] group-hover:rotate-[40deg] motion-reduce:transition-none"
        />
        {/* Solid white behind the cover: its loading placeholder is see-through, and the
            record would show through it. */}
        <div className="relative rounded-md bg-white shadow-[0_1px_1px_rgb(0_0_0/0.2),6px_8px_18px_-6px_rgb(11_11_40/0.45)]">
          <Cover url={album.coverUrl} className="aspect-square w-full" />
        </div>
      </div>
      <span className="flex min-w-0 flex-col break-words">
        <span className="leading-tight font-semibold tracking-tight">
          {album.title}
        </span>
        <span className="text-sm text-(--muted)">{album.artist}</span>
      </span>
    </Link>
  );
}
