// Simple in-memory sliding-window limiters. They reset on restart and aren't shared between
// server instances, which is fine as a first guard; the Console spend limit is the hard cap.
const MINUTE = 60 * 1000;

type Result = { ok: true } | { ok: false; retryAfterSeconds: number };

// Returns a function that allows each key at most `max` requests in any `windowMs` period.
function createLimiter(max: number, windowMs: number): (key: string) => Result {
  const hits = new Map<string, number[]>();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return { ok: false, retryAfterSeconds: Math.ceil((recent[0] + windowMs - now) / 1000) };
    }
    recent.push(now);
    hits.set(key, recent);
    return { ok: true };
  };
}

// Charts cost money (a Claude call each), so they're limited per hour.
export const takeChartToken = createLimiter(Number(process.env.CHART_REQUESTS_PER_HOUR ?? 10), 60 * MINUTE);

// Searches are free but share MusicBrainz's 1 request/second with everyone, so typing is
// limited too. 60 per 10 minutes is far more than picking an album takes.
export const takeSearchToken = createLimiter(60, 10 * MINUTE);

// The client's IP. On Render, public traffic comes through Cloudflare, which sets
// CF-Connecting-IP on every request and overwrites any copy the caller sent, so it can't be
// faked. X-Forwarded-For can: Cloudflare appends to it rather than replacing it, so its first
// entry is whatever the caller wrote. Locally there's no Cloudflare, so everyone is "local".
export const clientKey = (request: Request) =>
  request.headers.get("cf-connecting-ip") ?? "local";
