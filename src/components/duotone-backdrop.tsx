"use client";

import { useState } from "react";
import { largeCover } from "./seed-loader";

// The seed panel's backdrop: the whole seed cover, printed large in the two blues (shadows
// deep blue, highlights electric blue). It's anchored to the panel's right edge and fades out
// to the left, so the title and pills sit on plain blue. Kept square (not object-cover across
// the panel), since a wide panel would crop the cover to an unrecognizable strip.
// How the blues work: on an accent-blue base, a grayscale cover set to `multiply` maps white
// to accent and black to black; a deep-blue layer set to `lighten` then lifts the blacks to
// deep blue. If the cover fails to load, the plain accent base shows.
// Fills its nearest positioned parent, behind the content (the parent needs `isolate`).

// An eased fade across the cover's whole width: it starts very gently, so there's no visible
// edge where the image begins.
const FADE =
  "linear-gradient(to right, transparent 0%, rgb(0 0 0 / .04) 12%, rgb(0 0 0 / .14) 25%, rgb(0 0 0 / .3) 38%, rgb(0 0 0 / .5) 50%, rgb(0 0 0 / .7) 62%, rgb(0 0 0 / .86) 75%, rgb(0 0 0 / .96) 88%, #000 100%)";

export function DuotoneBackdrop({ coverUrl }: { coverUrl: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      aria-hidden
      className="absolute inset-0 -z-10 isolate overflow-hidden bg-accent"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={largeCover(coverUrl)}
        alt=""
        onLoad={() => setLoaded(true)}
        style={{ maskImage: FADE }}
        className={`absolute top-1/2 right-0 aspect-square h-[170%] max-w-none -translate-y-1/2 object-cover blur-[3px] grayscale contrast-125 mix-blend-multiply transition-opacity duration-700 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      <div className="absolute inset-0 bg-accent-deep mix-blend-lighten" />
    </div>
  );
}
