import type { Genre } from "./schema";

// Geometry for the "grew out of" cables between genre cards, styled after a node editor:
// each cable runs from an output socket on the parent card to an input socket on the child.
// Pure: give it the genres and where each card sits, get SVG path data back.

export type Box = { l: number; r: number; t: number; b: number };
export type Socket = { x: number; y: number };
export type CableDrawing = { cables: string[]; sockets: Socket[] };

const TIER = { roots: 0, seed: 1, branches: 2 } as const;
const SOCKET_SPREAD = 32; // px between sockets sharing one card edge

const tierOf = (genres: Genre[], id: string) => {
  const g = genres.find((x) => x.id === id);
  return g ? TIER[g.role] : undefined;
};

// Parents two tiers up (a root feeding a branch directly). These get no cable: routing one
// around the middle row looked unnatural, so the card names them in text instead.
export function skippedParents(genre: Genre, genres: Genre[]): Genre[] {
  return genre.parentIds
    .map((id) => genres.find((g) => g.id === id))
    .filter((p): p is Genre => p !== undefined && TIER[genre.role] - TIER[p.role] === 2);
}

export function cablePaths(genres: Genre[], boxes: Map<string, Box>): CableDrawing {
  const cables: string[] = [];
  const sockets: Socket[] = [];
  const cx = (b: Box) => (b.l + b.r) / 2;

  for (const child of genres) {
    const c = boxes.get(child.id);
    if (!c) continue;
    for (const parentId of child.parentIds) {
      const p = boxes.get(parentId);
      const parentTier = tierOf(genres, parentId);
      if (!p || parentTier === undefined) continue; // parent not on screen yet
      const gap = TIER[child.role] - parentTier;

      if (gap === 1) {
        // Down one tier: bottom edge of the parent to the top edge of the child. Several cables on
        // one edge get their own sockets, spread along it, so they don't all meet at one point.
        const outs = genres.filter((g) => g.parentIds.includes(parentId) && TIER[g.role] === parentTier + 1);
        const ins = child.parentIds.filter((id) => tierOf(genres, id) === TIER[child.role] - 1);
        const ox = cx(p) + (outs.indexOf(child) - (outs.length - 1) / 2) * SOCKET_SPREAD;
        const ix = cx(c) + (ins.indexOf(parentId) - (ins.length - 1) / 2) * SOCKET_SPREAD;
        // The cable leaves and enters straight before it bends, like a plugged-in lead.
        const pull = Math.max(30, (c.t - p.b) * 0.6);
        cables.push(`M${ox} ${p.b} C${ox} ${p.b + pull} ${ix} ${c.t - pull} ${ix} ${c.t}`);
        sockets.push({ x: ox, y: p.b }, { x: ix, y: c.t });
      } else if (gap === 0) {
        // Same tier, side by side: a short straight cable across the gap between facing edges.
        const y = Math.min(p.t, c.t) + 26;
        const [x1, x2] = cx(p) < cx(c) ? [p.r, c.l] : [p.l, c.r];
        cables.push(`M${x1} ${y} L${x2} ${y}`);
        sockets.push({ x: x1, y }, { x: x2, y });
      }
      // gap === 2: no cable, see skippedParents.
    }
  }
  return { cables, sockets };
}
