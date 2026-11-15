import "server-only";
import { db } from "@/db";
import { chart } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

// The album's canonical chart: its newest one, or undefined if it has never been charted.
// A database error is logged and also returns undefined, so callers carry on as if the album
// had no chart: the chart route makes a fresh one, and the album page offers to.
export async function findCanonicalChart(mbid: string) {
  try {
    const [savedChart] = await db
      .select()
      .from(chart)
      .where(eq(chart.seedMbid, mbid))
      .orderBy(desc(chart.createdAt))
      .limit(1);

    return savedChart;
  } catch (err) {
    console.error(`Looking up the chart for ${mbid} failed:`, err);
  }
}

export async function findByChartId(id: string) {
  const [savedChart] = await db
    .select()
    .from(chart)
    .where(eq(chart.id, id))
    .limit(1);

  return savedChart;
}
