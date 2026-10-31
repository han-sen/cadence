import type { NextRequest } from "next/server";
import { z } from "zod";
import { searchAlbums } from "@/lib/lineage/musicbrainz";
import { clientKey, takeSearchToken } from "@/lib/rate-limit";

const Query = z.string().trim().min(3).max(100);

// GET /api/search?q=… → { results: AlbumSuggestion[] }, for the seed album search box.
export async function GET(request: NextRequest) {
  const q = Query.safeParse(request.nextUrl.searchParams.get("q") ?? "");
  if (!q.success) return Response.json({ results: [] }); // too short to search yet

  const limit = takeSearchToken(clientKey(request));
  if (!limit.ok) {
    return Response.json(
      { error: "Too many searches. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  try {
    // The signal fires when the user types past this search, so it's dropped from the queue.
    const results = await searchAlbums(q.data, request.signal);
    // Lets the browser reuse results when someone deletes back to an earlier query.
    return Response.json({ results }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    if (request.signal.aborted) return new Response(null, { status: 499 }); // nobody is listening
    console.error(`Album search failed for "${q.data}":`, err);
    return Response.json({ error: "Album search isn't available right now." }, { status: 502 });
  }
}
