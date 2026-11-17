"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AlbumSearch } from "./album-search";
import { DemoGrid } from "./demo-grid";

// The home page: the pitch and search on a white card, the reading key on a blue dot tile,
// then the demo charts. Picking an album, in search or the grid, opens its chart page.
export function HomeView() {
  const router = useRouter();
  // Search needs a session (the API returns 401 without one). While the session is still
  // loading, the box stays disabled too, so it can't be used a moment before it's allowed.
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const signedOut = !sessionPending && !session;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-2 pb-6 sm:gap-5 sm:pt-4 sm:pb-10">
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="depth-card flex flex-col justify-between gap-6 rounded-[32px] bg-white p-6 sm:p-8">
          <h2 className="display max-w-xl text-3xl sm:text-4xl">
            Name an album you love. See where it came from, where it led, and
            what to play next.
          </h2>
          <AlbumSearch
            isDisabled={!session}
            placeholder={signedOut ? "Sign in to pick an album" : undefined}
            onSelect={(album) => router.push(`/album/${album.mbid}`)}
          />
        </div>
        <ReadingKey />
      </div>

      <DemoGrid />
    </div>
  );
}

// How to read a chart: the page's sections in order, on the blue dot tile next to the pitch.
// Their names and hints match the section labels on the chart page.
const SECTIONS = [
  ["Roots", "Where it came from"],
  ["Siblings", "Same scene"],
  ["Branches", "Where it led"],
  ["Kindred", "Same feel, different genre"],
];

function ReadingKey() {
  return (
    <aside
      aria-label="How to read a chart"
      className="surface-blue depth-tile relative isolate hidden flex-col justify-between gap-6 overflow-hidden rounded-[32px] bg-accent p-6 sm:flex sm:p-8"
    >
      <div aria-hidden className="dots absolute inset-0 -z-10" />
      <h2 className="meta text-(--muted)">How to read a chart</h2>
      <ol className="flex flex-col gap-4">
        {SECTIONS.map(([name, hint], i) => (
          <li key={name} className="flex items-baseline gap-4">
            <span className="meta w-5 shrink-0 text-(--faint)">0{i + 1}</span>
            <span>
              <span className="display block text-2xl">{name}</span>
              <span className="text-sm text-(--muted)">{hint}</span>
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
