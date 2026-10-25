// Re-runs only the MusicBrainz step on a saved run, with no Claude calls.
// Writes to a new "<run>_rechecked" folder so ratings in the original reports are kept.
//   npm run recheck -- out/opus-medium-first-run
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { verifyAlbum } from "../../src/lib/lineage/musicbrainz";
import { renderReport, renderSummary, type AlbumResult } from "./report.ts";

async function main() {
  const dir = process.argv[2]?.replace(/\/$/, "");
  if (!dir) {
    console.error("Usage: npm run recheck -- out/<run folder>");
    process.exit(1);
  }

  const outDir = `${dir}_rechecked`;
  await mkdir(outDir, { recursive: true });
  const rows: { result: AlbumResult; name: string }[] = [];
  let fixed = 0;
  let broke = 0;

  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  for (const file of files) {
    const result = JSON.parse(await readFile(`${dir}/${file}`, "utf8")) as AlbumResult;
    console.log(`\n▶ ${result.input.artist} — ${result.input.title}`);

    for (const album of result.albums) {
      const before = album.check;
      album.check = await verifyAlbum(album.artist, album.title);
      const after = album.check;
      if (!before.found && after.found) {
        fixed++;
        console.log(`  ✓ now found: ${album.artist} — ${album.title}  →  "${after.title}" (${after.match})`);
      } else if (before.found && !after.found) {
        broke++;
        console.log(`  ✗ now missing: ${album.artist} — ${album.title}  (${after.reason})`);
      } else if (!after.found) {
        console.log(`  · still missing: ${album.artist} — ${album.title}  (${after.reason})`);
      }
    }

    const name = basename(file, ".json");
    await writeFile(`${outDir}/${name}.json`, JSON.stringify(result, null, 2));
    await writeFile(`${outDir}/${name}.md`, renderReport(result));
    rows.push({ result, name });
  }

  const summary = renderSummary(`Rechecked: ${basename(dir)}`, rows);
  await writeFile(`${outDir}/SUMMARY.md`, summary);
  console.log(`\n${summary.split("\n")[2]}\n${fixed} newly found, ${broke} newly missing. See ${outDir}/SUMMARY.md`);
}

main();
