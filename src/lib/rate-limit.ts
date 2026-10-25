// Simple in-memory sliding-window limiter. It resets on restart and isn't shared between
// server instances, which is fine as a first guard; the Console spend limit is the hard cap.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = Number(process.env.CHART_REQUESTS_PER_HOUR ?? 10);

const hits = new Map<string, number[]>();

export function takeToken(key: string): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(key, recent);
    return { ok: false, retryAfterSeconds: Math.ceil((recent[0] + WINDOW_MS - now) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
}
