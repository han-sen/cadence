# Lineage test script

Checks whether Claude's lineage charts are worth building a UI for. For each seed album it:

1. Asks Claude for a chart: the seed album's traits, a genre path (roots → seed → branches), 3 picks per genre, and 3 "kindred" picks.
2. Looks each pick up in MusicBrainz to catch invented albums and get the real year and cover art.
3. Writes a report you can grade.

## Setup

It uses the app's dependencies and API key, so from the repo root: run `npm install` and create `.env.local` from `.env.example` (see the root README; the script only needs `ANTHROPIC_API_KEY`).

The prompt, schema and MusicBrainz matcher live in `../src/lib/lineage/` and are shared with the app.

## Run

```bash
npm run test-albums                                      # everything in albums.json
npm run test-albums -- "Joy Division" "Unknown Pleasures"  # one album
npm run recheck -- out/<run folder>                     # redo only the MusicBrainz step (free)
```

Replace `albums.json` with about 10 albums you know well, including a couple of obscure ones.

Optional environment variables:
- `LINEAGE_MODEL`: defaults to `claude-haiku-5-5`. Try `claude-opus-5-5` or `claude-sonnet-5-5` to compare quality against cost.
- `LINEAGE_EFFORT`: `low`, `medium` (default) or `high`.
- `MB_CONTACT`: an email or URL for the MusicBrainz User-Agent, which MusicBrainz asks for.

MusicBrainz allows about one request per second, so each album takes about 1–1.5 minutes (roughly 15 minutes for a full run).

## Output

Each run writes to its own folder, `out/<date>_<time>_<model>_<effort>/`, so runs never overwrite each other and you can compare models side by side:

- `SUMMARY.md`: how many recommendations MusicBrainz found, plus estimated cost per album
- `<album>.md`: the chart, with a rating line under each pick for you to fill in
- `<album>.json`: the raw result, which can become demo-mode data later

## What to judge

- Would you actually listen to these? Are the "why" lines convincing, or generic?
- Does the genre path make sense, and are the roots and branches the right ones?
- How many picks did MusicBrainz miss? Open the ✗ entries. A miss can mean an invented album, or just a spelling the lookup didn't match.
