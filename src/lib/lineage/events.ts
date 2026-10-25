import type { Verification } from "./musicbrainz";
import type { AlbumPick, Genre, LineageChart } from "./schema";

// The chart endpoint streams these as newline-delimited JSON, in roughly this order:
// seed → genre… → album… (each album followed later by its "verified") → done.
export type ChartEvent =
  | { type: "seed"; seed: LineageChart["seed"] }
  | { type: "genre"; genre: Genre }
  | { type: "album"; id: number; album: AlbumPick }
  | { type: "verified"; id: number; check: Verification }
  | { type: "done"; usage: { inputTokens: number; outputTokens: number }; model: string }
  | { type: "error"; message: string };
