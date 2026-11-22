import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cache, Suspense } from "react";
import { z } from "zod";
import { ChartView } from "@/components/chart-view";
import { findCanonicalChart } from "@/db/queries";
import { coverUrl, getAlbum } from "@/lib/lineage/musicbrainz";
import type { AlbumSuggestion } from "@/lib/lineage/schema";

// An album's chart page, at /album/<MusicBrainz release group id>. If the album has a saved
// chart, anyone can watch it replay. If not, a signed-in visitor gets one made.

type AlbumPageData = { album: AlbumSuggestion; chartId?: string };

// What the page needs for an album, null if there's no such album, or "unavailable" if
// MusicBrainz couldn't be reached to say. Wrapped in React's cache() so the page and
// generateMetadata share one lookup per request.
const loadAlbum = cache(async (mbid: string): Promise<AlbumPageData | null | "unavailable"> => {
  if (!z.uuid().safeParse(mbid).success) return null;

  // A charted album: its details come from the saved chart, so MusicBrainz isn't asked.
  const chart = await findCanonicalChart(mbid);
  if (chart) {
    // The year isn't a column. It's in the chart's seed event, as Claude gave it.
    const seed = chart.events.find((e) => e.event.type === "seed")?.event;
    return {
      chartId: chart.id,
      album: {
        mbid,
        artist: chart.artist,
        title: chart.title,
        year: seed?.type === "seed" ? seed.seed.year : null,
        type: "Album",
        coverUrl: coverUrl(mbid),
      },
    };
  }

  // Never charted: MusicBrainz has the album's details, if the id is a real album. It's often
  // busy or rate limiting the server, and that shouldn't crash the page.
  try {
    const album = await getAlbum(mbid);
    return album ? { album } : null;
  } catch (err) {
    console.error(`Album page: MusicBrainz lookup for ${mbid} failed:`, err);
    return "unavailable";
  }
});

// The page title, and the cover as the image shown when the link is shared.
export async function generateMetadata({
  params,
}: PageProps<"/album/[mbid]">): Promise<Metadata> {
  const { mbid } = await params;
  const data = await loadAlbum(mbid);
  if (!data) return { title: "Album not found · Cadence" };
  if (data === "unavailable") return { title: "Cadence" };

  const { album } = data;
  const title = `${album.title} by ${album.artist} · Cadence`;
  const description = `Where ${album.title} came from, where it led, and what to play next.`;
  return {
    title,
    description,
    openGraph: { title, description, images: [album.coverUrl] },
  };
}

// Not async: under cacheComponents a route param is request-time data, so it's read inside
// the Suspense boundary below rather than at the top of the page.
export default function AlbumPage({ params }: PageProps<"/album/[mbid]">) {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense>
        <AlbumChart params={params} />
      </Suspense>
    </main>
  );
}

async function AlbumChart({
  params,
}: {
  params: PageProps<"/album/[mbid]">["params"];
}) {
  const { mbid } = await params;
  const data = await loadAlbum(mbid);
  if (!data) notFound();
  if (data === "unavailable") return <AlbumUnavailable />;

  // Keyed by album, so going from one chart to another starts a fresh view.
  return <ChartView key={mbid} album={data.album} chartId={data.chartId} />;
}

// Shown when the album has no saved chart and MusicBrainz couldn't be reached to look it up.
// Usually a passing rate limit, so trying again shortly tends to work.
function AlbumUnavailable() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-6 pb-16 sm:pt-10">
      <div className="depth-card flex flex-col gap-3 rounded-[28px] bg-white p-6 sm:p-10">
        <h2 className="display text-3xl sm:text-4xl">Couldn&apos;t load this album</h2>
        <p className="text-lg leading-snug text-(--muted)">
          MusicBrainz, where Cadence looks up album details, is busy right now. Try again in a
          minute.
        </p>
        <Link href="/" className="meta self-start text-(--muted) hover:text-(--ink)">
          ← Back to Cadence
        </Link>
      </div>
    </div>
  );
}
