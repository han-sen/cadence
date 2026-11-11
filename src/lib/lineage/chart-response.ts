import { CHART_SOURCE_HEADER } from "./charts";
import type { ChartEvent } from "./events";

type ChartStreamOptions = {
  // The request's abort signal: once the client leaves, nothing more is sent.
  signal: AbortSignal;
  // Sent in the CHART_SOURCE_HEADER, so the page knows whether a chart is being made or replayed.
  source: "live" | "replay";
  // Produces the chart, sending each event through emit.
  run: (emit: (event: ChartEvent) => void) => Promise<void>;
  // Called when run throws: logs the error and returns the message to show the user.
  onError: (err: unknown) => string;
};

// A chart response: ChartEvents as newline-delimited JSON, streamed as run sends them. Shared by
// the route that makes charts and the route that replays them.
export function chartStreamResponse({
  signal,
  source,
  run,
  onError,
}: ChartStreamOptions): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The server holds the response headers until the first chunk. An empty line (which the
      // client skips) sends them now, so the page learns live vs replay before the first event.
      controller.enqueue(encoder.encode("\n"));

      const emit = (event: ChartEvent) => {
        if (!signal.aborted)
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        await run(emit);
      } catch (err) {
        if (!signal.aborted) emit({ type: "error", message: onError(err) });
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
      [CHART_SOURCE_HEADER]: source,
    },
  });
}
