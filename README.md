# Cadence

Name an album you love. Cadence maps where it sits in music history (the genres it grew out of and the ones it led to) and recommends albums along that path, each with a short note on why you'd like it.

## How it works

1. You pick an album on the home page and land on its page, `/album/<MusicBrainz id>`.
2. If the album already has a saved chart, the page replays it, for anyone. If not, a signed-in visitor gets a new one: `POST /api/chart` streams Claude's structured output (Claude Haiku 5.5).
3. As the JSON streams in, the server parses it incrementally and emits each finished piece as an event: the seed album, then each genre, then each album. The format is newline-delimited JSON; see `src/lib/lineage/events.ts`.
4. Every recommended album is looked up in MusicBrainz in the background to catch invented albums. A `verified` event follows each album.
5. The page folds the events into state as they arrive (`useChartStream`), so the chart fills in live.
6. A finished chart is saved to Postgres with the time each event arrived, so a replay plays back the same way, only faster.

Key files:
- `src/lib/lineage/prompt.ts`: system prompt and model settings
- `src/lib/lineage/schema.ts`: the chart schema (Zod), used for structured output and validation
- `src/lib/lineage/stream-chart.ts`: streaming, partial-JSON parsing, event emission
- `src/lib/lineage/musicbrainz.ts`: rate-limited album lookup and matching
- `src/lib/lineage/use-chart-stream.ts`: the client hook that reads the event stream into state
- `src/app/api/chart/route.ts`: makes a chart, or replays the album's saved one (sign-in, rate limiting, saving)
- `src/app/api/chart/[id]/route.ts`: replays a saved chart by id, signed in or not
- `src/app/album/[mbid]/page.tsx`: an album's chart page
- `src/db/`: the Postgres schema (Drizzle) and the saved-chart queries
- `src/components/home-view.tsx` and `src/components/chart-view.tsx`: the home page and the chart page UI

## Setup

You need Node, Docker (for the local Postgres), an Anthropic API key and a Google OAuth client.

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in. The comments in the file say where each value comes from.
3. Start the database: `docker compose up -d`
4. Create the tables: `npx drizzle-kit migrate`
5. `npm run dev` and open http://localhost:3000.

Sign in with Google to search for an album and chart it. The six albums on the home page are charts saved in the original database; on a fresh one, each is charted the first time a signed-in visitor opens it.

## Deploying

Cadence runs on Render as one web service with Render Postgres.

- Build command: `npm ci && npm run build`
- Start command: `npm run db:migrate && npm start`

`db:migrate` applies any new migrations before the app starts (the free plan has no pre-deploy step). If a migration fails, the app doesn't start and Render keeps the previous version running. Don't set `NODE_ENV` yourself: Render sets it when the app runs, and setting it by hand also skips dev dependencies during the build.

## Tests

`npm test` runs the unit tests (Vitest) and reruns them on every save; `npm run test:run` runs them once.

## Model test script

`lineage-test/` compares recommendation quality and cost across models using the same prompt, schema and matcher as the app. See `lineage-test/README.md`.
