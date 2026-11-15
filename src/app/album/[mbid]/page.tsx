import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { z } from "zod";
import { ChartView } from "@/components/chart-view";
import { findCanonicalChart } from "@/db/queries";
import { coverUrl, getAlbum } from "@/lib/lineage/musicbrainz";
import type { AlbumSuggestion } from "@/lib/lineage/schema";

// An album's chart page, at /album/<MusicBrainz release group id>. If the album has a saved
// chart, anyone can watch it replay. If not, a signed-in visitor gets one made.

type AlbumPageData = { album: AlbumSuggestion; chartId?: string };

// What the page needs for an album, or null if there's no such album. Wrapped in React's
// cache() so the page and generateMetadata share one lookup per request.
const loadAlbum = cache(async (mbid: string): Promise<AlbumPageData | null> => {
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

  // Never charted: MusicBrainz has the album's details, if the id is a real album.
  const album = await getAlbum(mbid);
  return album ? { album } : null;
});

// The page title, and the cover as the image shown when the link is shared.
export async function generateMetadata({
  params,
}: PageProps<"/album/[mbid]">): Promise<Metadata> {
  const { mbid } = await params;
  const data = await loadAlbum(mbid);
  if (!data) return { title: "Album not found · Cadence" };

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

  // Keyed by album, so going from one chart to another starts a fresh view.
  return <ChartView key={mbid} album={data.album} chartId={data.chartId} />;
}
