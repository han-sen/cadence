import { z } from "zod";
import { AlbumPick, Genre, LineageChart, Verification } from "./schema";

// The chart endpoint streams these as newline-delimited JSON, in roughly this order:
// seed → genre… → album… (each album followed later by its "verified") → done.
// The server builds events against this schema and the client validates every line with it,
// so both sides enforce the same contract.
export const ChartEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("seed"), seed: LineageChart.shape.seed }),
  z.object({ type: z.literal("genre"), genre: Genre }),
  z.object({
    type: z.literal("album"),
    id: z.number().int(),
    album: AlbumPick,
  }),
  z.object({
    type: z.literal("verified"),
    id: z.number().int(),
    check: Verification,
  }),
  z.object({
    type: z.literal("done"),
    model: z.string(),
    usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export type ChartEvent = z.infer<typeof ChartEvent>;

// One event from a saved chart, with when it arrived: ms after the chart started.
// Replays (saved and demo charts) schedule each event at that offset, scaled for speed.
export type RecordedEvent = { offsetMs: number; event: ChartEvent };
