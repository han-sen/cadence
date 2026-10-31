import { z } from "zod";

// Where a genre sits relative to the seed album.
// roots: genres the seed's genres grew out of
// seed: the seed album's own genres
// branches: genres that grew out of the seed's genres
export const GenreRole = z.enum(["roots", "seed", "branches"]);

export const Genre = z.object({
  id: z.string().describe("Short kebab-case id, e.g. 'post-punk'"),
  name: z.string(),
  role: GenreRole,
  emergedYear: z.number().int().describe("Approximate year the genre emerged"),
  parentIds: z
    .array(z.string())
    .describe("Ids of genres in this list that this genre grew out of"),
});

export const AlbumPick = z.object({
  artist: z.string().describe("Artist name exactly as officially credited"),
  title: z.string().describe("Official album title, no edition suffixes"),
  year: z.number().int().describe("Original release year"),
  genreId: z
    .string()
    .nullable()
    .describe("Genre lane this album sits in; null for kindred picks"),
  kindred: z
    .boolean()
    .describe("True for contemporaries that share traits but aren't on the genre path"),
  why: z.string().describe("One or two sentences on why a fan of the seed would like it"),
  sharedTraits: z.array(z.string()).describe("Traits from seed.traits this album shares"),
});

export const LineageChart = z.object({
  seed: z.object({
    artist: z.string(),
    title: z.string(),
    year: z.number().int(),
    genreIds: z.array(z.string()),
    traits: z
      .array(z.string())
      .describe("Short sound/mood/scene traits, e.g. 'motorik drums', 'Manchester 1979'"),
  }),
  genres: z.array(Genre),
  albums: z.array(AlbumPick),
});

// Result of checking an album against MusicBrainz (see musicbrainz.ts).
export const Verification = z.discriminatedUnion("found", [
  z.object({
    found: z.literal(true),
    mbid: z.string(),
    artist: z.string(),
    title: z.string(),
    year: z.number().int().nullable(),
    coverUrl: z.string(),
    // exact: titles match after normalizing. close: one title contains the other,
    // e.g. "Urban Hang Suite" vs "Maxwell's Urban Hang Suite".
    match: z.enum(["exact", "close"]),
  }),
  z.object({ found: z.literal(false), reason: z.string() }),
]);

// One album in the seed search dropdown (GET /api/search).
export const AlbumSuggestion = z.object({
  mbid: z.string(),
  artist: z.string(),
  title: z.string(),
  year: z.number().int().nullable(),
  type: z.string(), // "Album" or "EP"
  coverUrl: z.string(),
});
export const SearchResponse = z.object({ results: z.array(AlbumSuggestion) });

export type LineageChart = z.infer<typeof LineageChart>;
export type AlbumSuggestion = z.infer<typeof AlbumSuggestion>;
export type AlbumPick = z.infer<typeof AlbumPick>;
export type Genre = z.infer<typeof Genre>;
export type Verification = z.infer<typeof Verification>;
