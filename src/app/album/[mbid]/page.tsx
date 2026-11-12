import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChartView } from "@/components/chart-view";
import { DEMO_CHARTS } from "@/lib/lineage/demo-charts";

// STAND-IN until the real page exists: it only knows the six demo albums, so the home-to-chart
// flow can be tried before the database lookups are written. Any other album is a 404 for now.
//
// The real page replaces the demo lookup below with:
//   1. The album's canonical (newest) saved chart, if it has one. Demo albums are covered by
//      this too: each album only ever has one chart, since the chart route replays an existing
//      chart instead of making a new one.
//   2. Otherwise the album's details from MusicBrainz, with no chart id (signed in, it gets made).
// Plus generateMetadata, for the page title and the cover as the link preview image.

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

async function AlbumChart({ params }: { params: PageProps<"/album/[mbid]">["params"] }) {
  const { mbid } = await params;
  const demo = DEMO_CHARTS.find((d) => d.mbid === mbid);
  if (!demo) notFound();

  const { chartId, ...album } = demo;
  return <ChartView key={mbid} album={album} chartId={chartId} />;
}
