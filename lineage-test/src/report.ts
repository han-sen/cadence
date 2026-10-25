import type { Verification } from "../../src/lib/lineage/musicbrainz";
import type { AlbumPick, LineageChart } from "../../src/lib/lineage/schema";

export type SeedInput = { artist: string; title: string };
export type CheckedAlbum = AlbumPick & { check: Verification };
export type AlbumResult = {
  input: SeedInput;
  chart: LineageChart;
  albums: CheckedAlbum[];
  costUsd: number | null;
  seconds: number;
  servedBy: string;
};

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function renderAlbum(a: CheckedAlbum): string {
  const status = a.check.found
    ? a.check.match === "exact" ? "✓" : `✓ close match: "${a.check.title}"`
    : `✗ not found — ${a.check.reason}`;
  const yearNote =
    a.check.found && a.check.year && a.check.year !== a.year ? ` (MB year ${a.check.year})` : "";
  return [
    `- **${a.artist} — ${a.title}** (${a.year}${yearNote}) ${status}`,
    `  - ${a.why}`,
    `  - traits: ${a.sharedTraits.join(", ") || "—"}`,
    `  - Rating: _ /5  ·  Would listen? _`,
  ].join("\n");
}

export function renderReport(r: AlbumResult): string {
  const { chart } = r;
  const found = r.albums.filter((a) => a.check.found).length;
  const lines = [
    `# ${chart.seed.artist} — ${chart.seed.title} (${chart.seed.year})`,
    "",
    `Model: ${r.servedBy} · ${r.seconds.toFixed(0)}s · ${r.costUsd !== null ? `~$${r.costUsd.toFixed(3)}` : "cost n/a"} · MusicBrainz: ${found}/${r.albums.length} found`,
    "",
    `**Seed traits:** ${chart.seed.traits.join(", ")}`,
    "",
    "## Genre path",
    "",
  ];

  for (const role of ["roots", "seed", "branches"] as const) {
    for (const g of chart.genres.filter((g) => g.role === role)) {
      const parents = g.parentIds
        .map((id) => chart.genres.find((p) => p.id === id)?.name ?? `${id} (missing!)`)
        .join(", ");
      lines.push(`### ${role}: ${g.name} (~${g.emergedYear})${parents ? ` ← ${parents}` : ""}`, "");
      for (const a of r.albums.filter((a) => a.genreId === g.id)) lines.push(renderAlbum(a));
      lines.push("");
    }
  }

  const kindred = r.albums.filter((a) => a.kindred);
  if (kindred.length) lines.push("## Kindred", "", ...kindred.map(renderAlbum), "");

  const orphans = r.albums.filter((a) => !a.kindred && !chart.genres.some((g) => g.id === a.genreId));
  if (orphans.length) lines.push("## ⚠ Albums with an unknown genreId", "", ...orphans.map(renderAlbum), "");

  lines.push("## Overall notes", "", "_Would you trust this chart? What's missing or off?_", "");
  return lines.join("\n");
}

export function renderSummary(title: string, rows: { result: AlbumResult; name: string }[], errors: string[] = []): string {
  const found = rows.reduce((n, r) => n + r.result.albums.filter((a) => a.check.found).length, 0);
  const total = rows.reduce((n, r) => n + r.result.albums.length, 0);
  const cost = rows.reduce((n, r) => n + (r.result.costUsd ?? 0), 0);
  const pct = total ? ((found / total) * 100).toFixed(0) : "0";
  return [
    `# ${title}`,
    "",
    `MusicBrainz found ${found}/${total} recommended albums (${pct}%). Estimated cost: ~$${cost.toFixed(2)}.`,
    "",
    "| Seed | Found | Time | Report |",
    "|---|---|---|---|",
    ...rows.map(({ result: r, name }) =>
      `| ${r.input.artist} — ${r.input.title} | ${r.albums.filter((a) => a.check.found).length}/${r.albums.length} | ${r.seconds.toFixed(0)}s | [report](${name}.md) |`,
    ),
    ...errors,
    "",
  ].join("\n");
}
