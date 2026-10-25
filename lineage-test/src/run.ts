import { mkdir, readFile, writeFile } from "node:fs/promises";
import { EFFORT, generateChart, MODEL } from "./generate.ts";
import { verifyAlbum } from "../../src/lib/lineage/musicbrainz";
import { renderReport, renderSummary, slug, type AlbumResult, type CheckedAlbum, type SeedInput } from "./report.ts";

// Rough per-million-token prices for the cost estimate. Check current pricing before relying on these.
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

async function runOne(input: SeedInput): Promise<AlbumResult> {
  const started = Date.now();
  console.log(`\n▶ ${input.artist} — ${input.title}`);

  const { chart, usage, servedBy } = await generateChart(input.artist, input.title);
  console.log(`  generated ${chart.genres.length} genres, ${chart.albums.length} albums`);

  const albums: CheckedAlbum[] = [];
  for (const album of chart.albums) {
    const check = await verifyAlbum(album.artist, album.title);
    albums.push({ ...album, check });
    console.log(`  ${check.found ? "✓" : "✗"} ${album.artist} — ${album.title}${check.found ? "" : `  (${check.reason})`}`);
  }

  const price = PRICES[MODEL];
  const costUsd = price
    ? (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000
    : null;

  return { input, chart, albums, costUsd, seconds: (Date.now() - started) / 1000, servedBy };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY isn't set. Add it to a .env file in this folder:\n  ANTHROPIC_API_KEY=sk-ant-...");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const inputs: SeedInput[] =
    args.length === 2
      ? [{ artist: args[0], title: args[1] }]
      : JSON.parse(await readFile("albums.json", "utf8"));

  // Each run gets its own folder, e.g. out/2026-10-24_2050_claude-haiku-5-5_medium
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
  const outDir = `out/${stamp}_${MODEL}_${EFFORT}`;
  await mkdir(outDir, { recursive: true });
  const rows: { result: AlbumResult; name: string }[] = [];
  const errors: string[] = [];

  for (const input of inputs) {
    try {
      const result = await runOne(input);
      const name = slug(`${input.artist}-${input.title}`);
      await writeFile(`${outDir}/${name}.json`, JSON.stringify(result, null, 2));
      await writeFile(`${outDir}/${name}.md`, renderReport(result));
      rows.push({ result, name });
    } catch (err) {
      console.error(`  ✗ failed: ${(err as Error).message}`);
      errors.push(`| ${input.artist} — ${input.title} | error: ${(err as Error).message} | | |`);
    }
  }

  const summary = renderSummary(`Lineage test run — ${MODEL}, effort ${EFFORT}`, rows, errors);
  await writeFile(`${outDir}/SUMMARY.md`, summary);
  console.log(`\n${summary.split("\n")[2]}\nSee ${outDir}/SUMMARY.md`);
}

main();
