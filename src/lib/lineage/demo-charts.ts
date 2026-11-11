import type { AlbumSuggestion } from "./schema";

// A saved chart shown on the home page, which anyone can replay without signing in. It carries
// the album's details too, so the seed panel can show the cover and title before the replay's
// first event, just as it does for an album picked in search.
export type DemoChart = AlbumSuggestion & { chartId: string };

// The 500px cover: the demo grid and the seed panel show it larger than search's thumbnails.
const cover = (mbid: string) =>
  `https://coverartarchive.org/release-group/${mbid}/front-500`;

const demo = (
  chartId: string,
  mbid: string,
  artist: string,
  title: string,
  year: number,
): DemoChart => ({
  chartId,
  mbid,
  artist,
  title,
  year,
  type: "Album",
  coverUrl: cover(mbid),
});

// Pinned by chart id, not album, so each always replays this exact snapshot even if someone
// charts the album again later. Names are spelled as MusicBrainz credits them.
export const DEMO_CHARTS: DemoChart[] = [
  demo(
    "57f92cb8-5ecb-4cad-80a3-ebe16005cefd",
    "0dac7ff9-b4d1-423e-bf6b-7d194abb0e14",
    "Phoebe Bridgers",
    "Stranger in the Alps",
    2017,
  ),
  // Kept partly for its short genres (two picks where verification turned one down), so the
  // demos show that layout too.
  demo(
    "0011682d-3cd2-4b33-99e4-4e6850ec1ca9",
    "17d74d52-c92b-3b8d-9f87-218ab2d1c4a0",
    "Boards of Canada",
    "Music Has the Right to Children",
    1998,
  ),
  demo(
    "d4b51313-4f4e-41ab-8620-7dadc8d4d5de",
    "cb76227e-3ac0-3002-9a10-615a5b73cc59",
    "my bloody valentine",
    "Loveless",
    1991,
  ),
  demo(
    "fc92a780-3ba6-44d3-a0dc-b5e138b0ba13",
    "32cb822c-a14e-49ce-a169-f209c5f31e0f",
    "Kendrick Lamar",
    "GNX",
    2024,
  ),
  demo(
    "eeee7ffe-4bb4-405a-aaff-70aa407b9ced",
    "e0fdb431-0109-420d-8a37-f99eaeb4d671",
    "Charli xcx",
    "BRAT",
    2024,
  ),
  demo(
    "1a992b55-b680-4727-83fa-ca2d646f69e6",
    "48117b90-a16e-34ca-a514-19c702df1158",
    "Daft Punk",
    "Discovery",
    2001,
  ),
];
