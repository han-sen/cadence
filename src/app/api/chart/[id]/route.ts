import { z } from "zod";
import { replayChart } from "@/lib/lineage/charts";
import { chartStreamResponse } from "@/lib/lineage/chart-response";
import { findByChartId } from "@/db/queries";

// GET /api/chart/[id] → a saved chart, replayed as the same NDJSON stream POST sends.
// Public, so the demo grid works signed out. No rate limit, since it never calls Claude, and no
// view is recorded, since there may be no user.
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/chart/[id]">,
) {
  const { id } = await ctx.params;
  const parsedId = z.uuid().safeParse(id);

  if (!parsedId.success) {
    return Response.json(
      { error: "That chart doesn't exist." },
      { status: 404 },
    );
  }

  const savedChart = await findByChartId(parsedId.data);
  if (!savedChart) {
    return Response.json({ error: "Chart not found." }, { status: 404 });
  }

  return chartStreamResponse({
    signal: request.signal,
    source: "replay",
    run: (emit) => replayChart(savedChart.events, emit, request.signal),
    onError: (err) => {
      console.error(`Replaying chart ${savedChart.id} failed:`, err);
      return "Something went wrong loading this chart.";
    },
  });
}
