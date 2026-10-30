import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { parse as parsePartialJson } from "partial-json";
import type { ChartEvent } from "./events";
import { verifyAlbum } from "./musicbrainz";
import { EFFORT, MODEL, SYSTEM, userMessage } from "./prompt";
import { AlbumPick, Genre, LineageChart } from "./schema";

const client = new Anthropic();

type Options = { emit: (event: ChartEvent) => void; signal: AbortSignal };

// A failure whose message is written for the user. Any other error is treated as internal.
export class ChartError extends Error {}

// Streams Claude's structured output and turns it into chart events as soon as each
// piece is complete, while checking every album against MusicBrainz in the background.
export async function streamChart(artist: string, title: string, { emit, signal }: Options) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: EFFORT, format: zodOutputFormat(LineageChart) },
    system: SYSTEM,
    messages: [{ role: "user", content: userMessage(artist, title) }],
  });
  signal.addEventListener("abort", () => stream.abort(), { once: true });

  let seedSent = false;
  let genresSent = 0;
  let albumsSent = 0;

  // MusicBrainz checks run one after another (it allows ~1 request/second) while
  // Claude keeps streaming, so the chart fills in and gets verified at the same time.
  let verifications = Promise.resolve();
  const sendAlbum = (album: AlbumPick) => {
    const id = albumsSent++;
    emit({ type: "album", id, album });
    verifications = verifications.then(async () => {
      if (signal.aborted) return;
      emit({ type: "verified", id, check: await verifyAlbum(album.artist, album.title) });
    });
  };

  // An array item is only final once the next one has started or the array has closed,
  // so the last item seen is held back until then. `closed` covers the final flush.
  const sendCompleted = (json: Partial<Record<keyof LineageChart, unknown>>, closed: boolean) => {
    if (!seedSent && (closed || "genres" in json)) {
      const seed = LineageChart.shape.seed.safeParse(json.seed);
      if (seed.success) {
        emit({ type: "seed", seed: seed.data });
        seedSent = true;
      }
    }

    const genres = Array.isArray(json.genres) ? json.genres : [];
    const genresDone = closed || "albums" in json ? genres.length : genres.length - 1;
    for (; genresSent < genresDone; genresSent++) {
      const genre = Genre.safeParse(genres[genresSent]);
      if (genre.success) emit({ type: "genre", genre: genre.data });
    }

    const albums = Array.isArray(json.albums) ? json.albums : [];
    const albumsDone = closed ? albums.length : albums.length - 1;
    while (albumsSent < albumsDone) {
      const album = AlbumPick.safeParse(albums[albumsSent]);
      if (album.success) sendAlbum(album.data);
      else albumsSent++; // skip a malformed item rather than stalling the stream
    }
  };

  let text = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      try {
        sendCompleted(parsePartialJson(text), false);
      } catch {
        // Not parseable yet (e.g. mid-escape sequence); the next delta will catch up.
      }
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") throw new ChartError("The model declined this request.");
  if (final.stop_reason === "max_tokens") throw new ChartError("The chart was cut off before it finished.");

  sendCompleted(JSON.parse(text), true);
  await verifications;

  emit({
    type: "done",
    model: final.model,
    usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens },
  });
}
