# Cadence

Name an album you love. Cadence maps where it sits in music history (the genres it grew out of and the ones it led to) and recommends albums along that path, each with a short note on why you'd like it.

## How it works

1. `POST /api/chart` with `{ artist, title }` streams Claude's structured output (Claude Haiku 5.5).
2. As the JSON streams in, the server parses it incrementally and emits each finished piece as an event: the seed album, then each genre, then each album. The format is newline-delimited JSON; see `src/lib/lineage/events.ts`.
3. Every recommended album is looked up in MusicBrainz in the background to catch invented albums. A `verified` event follows each album.
4. The page folds the events into state as they arrive (`useChartStream`), so the chart fills in live.

Key files:
- `src/lib/lineage/prompt.ts`: system prompt and model settings
- `src/lib/lineage/schema.ts`: the chart schema (Zod), used for structured output and validation
- `src/lib/lineage/stream-chart.ts`: streaming, partial-JSON parsing, event emission
- `src/lib/lineage/musicbrainz.ts`: rate-limited album lookup and matching
- `src/app/api/chart/route.ts`: the API route (input validation, rate limiting, error handling)
- `src/components/home-view.tsx` and `src/components/chart-view.tsx`: the home page and an album's chart page

## Setup

1. Create an API key in the Anthropic Console and set a monthly spend limit there.
2. Create `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   Optional: `LINEAGE_MODEL`, `LINEAGE_EFFORT` (`low`/`medium`/`high`), `CHART_REQUESTS_PER_HOUR` (default 10 per IP), `MB_CONTACT` (email or URL for the MusicBrainz User-Agent).
3. `npm install`, then `npm run dev` and open http://localhost:3000.

## Model test script

`lineage-test/` compares recommendation quality and cost across models using the same prompt, schema and matcher as the app. See `lineage-test/README.md`.
