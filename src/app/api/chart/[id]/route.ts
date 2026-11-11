import { z } from "zod";
import { db } from "@/db";
import { chart } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CHART_SOURCE_HEADER, replayChart } from "@/lib/lineage/charts";
import type { ChartEvent } from "@/lib/lineage/events";

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The server holds the response headers until the first chunk. An empty line (which the
      // client skips) sends them now, so the page learns live vs replay before the first event.
      controller.enqueue(encoder.encode("\n"));

      const emit = (event: ChartEvent) => {
        if (!request.signal.aborted)
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        await replayChart(savedChart.events, emit, request.signal);
      } catch (err) {
        if (!request.signal.aborted) {
          console.error(`Replaying chart ${savedChart.id} failed:`, err);
          emit({
            type: "error",
            message: "Something went wrong loading this chart.",
          });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed because the client went away.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      [CHART_SOURCE_HEADER]: "replay",
    },
  });
}

async function findByChartId(id: string) {
  const [savedChart] = await db
    .select()
    .from(chart)
    .where(eq(chart.id, id))
    .limit(1);

  return savedChart;
}
