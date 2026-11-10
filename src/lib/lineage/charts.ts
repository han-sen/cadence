import type { ChartEvent, RecordedEvent } from "./events";

const REPLAY_SPEED = 4; // a saved chart fills in 4x faster than it was made
// Most of a live chart's time is the wait for Claude's first result (20-35s). Even at 4x that's
// 5-9s of nothing, so a replay's opening wait is capped at this instead.
const REPLAY_OPENING_MS = 2500;

// Response header that marks a replayed chart, so the page can say so instead of showing the
// live "listening" lines (nothing is being analyzed during a replay).
export const CHART_SOURCE_HEADER = "X-Chart-Source";

// Sends a saved chart's events at their recorded times: the opening wait capped, then the rest
// sped up. Stops if the client leaves.
export async function replayChart(
  events: RecordedEvent[],
  emit: (event: ChartEvent) => void,
  signal: AbortSignal,
) {
  const firstOffset = events[0]?.offsetMs ?? 0;
  const opening = Math.min(firstOffset / REPLAY_SPEED, REPLAY_OPENING_MS);
  const startedAt = Date.now();
  for (const { offsetMs, event } of events) {
    // Each event is timed from the replay's start, not the previous event, so delays can't add up.
    const replayAt = opening + (offsetMs - firstOffset) / REPLAY_SPEED;
    const timeToWait = replayAt - (Date.now() - startedAt);

    if (timeToWait > 0) {
      await new Promise((resolve) => setTimeout(resolve, timeToWait));
    }
    // Checked after the wait, so a client that left during it gets nothing more.
    if (signal.aborted) return;
    emit(event);
  }
}

export type SaveChartInput = {
  artist: string;
  title: string;
  mbid: string;
  events: RecordedEvent[];
  userId: string;
};
