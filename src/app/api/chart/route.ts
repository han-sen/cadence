import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ChartError, streamChart } from "@/lib/lineage/stream-chart";
import { clientKey, takeChartToken } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import type { ChartEvent, RecordedEvent } from "@/lib/lineage/events";
import type { SaveChartInput } from "@/lib/lineage/charts";
import { db } from "@/db";
import { chart, chartView } from "@/db/schema";

const Body = z.object({
  artist: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  mbid: z.uuid(),
});

// POST { artist, title, mbid } → newline-delimited JSON stream of ChartEvents.
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json(
      { error: "Sign in to make a chart." },
      { status: 401 },
    );
  }

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json(
      { error: "Send an artist and an album title." },
      { status: 400 },
    );
  }

  const limit = takeChartToken(clientKey(request));
  if (!limit.ok) {
    return Response.json(
      { error: "You've hit the hourly limit for new charts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      const recorded: RecordedEvent[] = [];

      const emit = (event: ChartEvent) => {
        recorded.push({ offsetMs: Date.now() - startedAt, event });

        if (!request.signal.aborted)
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await streamChart(body.data.artist, body.data.title, {
          emit,
          signal: request.signal,
        });
        await saveChart({
          ...body.data,
          events: recorded,
          userId: session.user.id,
        });
      } catch (err) {
        if (!request.signal.aborted) {
          console.error(
            `Chart failed for "${body.data.title}" by ${body.data.artist}:`,
            err,
          );
          emit({ type: "error", message: errorMessage(err) });
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
    },
  });
}

// Turns an error into text for the user. Unexpected errors get a generic message so internal
// details never reach the browser; the full error is in the server log.
function errorMessage(err: unknown): string {
  if (err instanceof ChartError) return err.message;
  if (err instanceof Anthropic.RateLimitError)
    return "The model is busy right now. Try again in a minute.";
  if (err instanceof Anthropic.AuthenticationError)
    return "The server's API key isn't configured correctly.";
  if (err instanceof Anthropic.APIError)
    return `The model request failed (${err.status}).`;
  return "Something went wrong while making this chart.";
}

async function saveChart({
  artist,
  title,
  mbid,
  events,
  userId,
}: SaveChartInput): Promise<void> {
  if (events[events.length - 1]?.event.type !== "done") return;

  try {
    const [saved] = await db
      .insert(chart)
      .values({
        seedMbid: mbid,
        title,
        artist,
        events,
        createdBy: userId,
      })
      .returning({ id: chart.id });
    await db.insert(chartView).values({
      userId,
      chartId: saved.id,
    });
  } catch (err) {
    console.error("Saving the chart failed:", err);
  }
}
