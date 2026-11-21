import type { CSSProperties, ReactNode } from "react";
import { Cover } from "./cover";

// The home page hero's picture: the shape of a real chart (the Stranger in the Alps demo) as a
// few cards floating in space, tilted to an isometric view, joined by cables. Only the seed shows
// a cover: the other cards are genres, plus two loose tiles (the chart's size and some traits),
// so the hero shows the lineage and the album strip below shows the albums. No floor, so it
// sits on whatever background the hero has. White, blue and indigo cards in the chart page's
// style. Decorative only: hidden from screen readers.
//
// Everything is placed on a flat 600×600 plane, then the plane is turned and tipped back (TURN
// and TILT), so its top-left corner points up the screen. The whole scene drifts up and down as
// one piece. The chart flows down the plane's diagonal: roots near the top corner, the seed in
// the middle with its sibling and a kindred pick to either side, the branch near the bottom
// corner.

const PLANE = 600;

// The view: how far the plane is turned in its own plane (45 puts a corner straight up; less
// turns it left), and how far it's tipped back from facing the screen.
const TURN = 32;
const TILT = 36;

// Footprints on the plane, and how far each card floats above it. Cabled cards stay at 0: the
// cables run in the plane itself, so a lifted card would drift away from its cable's end on
// screen. The loose tiles have no cables, so they float higher, which gives the scene depth.
type Spot = { x: number; y: number; w: number; h: number; lift: number };

const SPOTS = {
  folkRock: { x: 0, y: 214, w: 170, h: 116, lift: 0 },
  slowcore: { x: 214, y: 0, w: 170, h: 116, lift: 0 },
  seed: { x: 226, y: 226, w: 160, h: 184, lift: 0 },
  sibling: { x: 30, y: 440, w: 150, h: 104, lift: 0 },
  kindred: { x: 440, y: 40, w: 150, h: 104, lift: 0 },
  branch: { x: 430, y: 430, w: 170, h: 116, lift: 0 },
  stat: { x: 40, y: 30, w: 124, h: 124, lift: 44 },
  traits: { x: 220, y: 522, w: 212, h: 100, lift: 26 },
} satisfies Record<string, Spot>;

export function HeroIllustration() {
  return (
    <div
      aria-hidden
      className="pointer-events-none relative grid aspect-[5/4] w-full place-items-center [perspective:2200px]"
    >
      {/* The scene is drawn at a fixed size (about 720×550 on screen) and scaled down: a little
          on wide screens, more to fit narrower ones. This wrapper is a zero-size point at the
          box's center with the scene centered on it, so the scene stays centered at any scale
          instead of overflowing the box to one side. */}
      <div className="relative size-0 scale-[0.93] [transform-style:preserve-3d] max-sm:scale-[0.45] sm:max-lg:scale-[0.79]">
        <div
          className="hero-drift absolute [transform-style:preserve-3d]"
          style={{
            width: PLANE,
            height: PLANE,
            left: -PLANE / 2,
            top: -PLANE / 2,
            transform: `rotateX(${TILT}deg) rotateZ(${TURN}deg)`,
          }}
        >
          <Cables />

          <Floating spot={SPOTS.folkRock}>
            <GenreCard number="01" tier="Roots" name="Folk Rock" year={1965} />
          </Floating>
          <Floating spot={SPOTS.slowcore}>
            <GenreCard number="01" tier="Roots" name="Slowcore" year={1990} />
          </Floating>
          <Floating spot={SPOTS.sibling}>
            <GenreCard
              number="02"
              tier="Siblings"
              name="Sadcore"
              year={1992}
              tone="blue"
            />
          </Floating>
          <Floating spot={SPOTS.kindred}>
            <GenreCard
              number="04"
              tier="Kindred"
              name="Singer-Songwriter"
              tone="indigo"
            />
          </Floating>
          <Floating spot={SPOTS.branch}>
            <GenreCard
              number="03"
              tier="Branches"
              name="Bedroom Pop"
              year={2008}
            />
          </Floating>
          <Floating spot={SPOTS.seed}>
            <SeedCard />
          </Floating>
          <Floating spot={SPOTS.stat}>
            <StatTile />
          </Floating>
          <Floating spot={SPOTS.traits}>
            <TraitsTile />
          </Floating>
        </div>
      </div>
    </div>
  );
}

// Center points of a footprint's sides, for joining cables to.
const side = (s: Spot, which: "right" | "bottom" | "left" | "top") =>
  ({
    right: [s.x + s.w, s.y + s.h / 2],
    bottom: [s.x + s.w / 2, s.y + s.h],
    left: [s.x, s.y + s.h / 2],
    top: [s.x + s.w / 2, s.y],
  })[which];

// A cable from one point to another, leaving and arriving at right angles to the cards.
function cable(
  [x1, y1]: number[],
  [x2, y2]: number[],
  out: "x" | "y",
  into: "x" | "y",
) {
  const k = 0.6;
  const c1 = out === "x" ? [x1 + (x2 - x1) * k, y1] : [x1, y1 + (y2 - y1) * k];
  const c2 = into === "x" ? [x2 - (x2 - x1) * k, y2] : [x2, y2 - (y2 - y1) * k];
  return `M${x1} ${y1} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${x2} ${y2}`;
}

// Lineage cables are solid. Kindred is a link by feel, not descent, so its cable is dotted.
const CABLES = [
  {
    from: side(SPOTS.folkRock, "right"),
    to: side(SPOTS.seed, "left"),
    out: "x",
    into: "x",
  },
  {
    from: side(SPOTS.slowcore, "bottom"),
    to: side(SPOTS.seed, "top"),
    out: "y",
    into: "y",
  },
  {
    from: side(SPOTS.seed, "bottom"),
    to: side(SPOTS.sibling, "right"),
    out: "y",
    into: "x",
  },
  {
    from: side(SPOTS.seed, "right"),
    to: side(SPOTS.branch, "top"),
    out: "x",
    into: "y",
  },
  {
    from: side(SPOTS.seed, "right"),
    to: side(SPOTS.kindred, "bottom"),
    out: "x",
    into: "y",
    dotted: true,
  },
] as const;

// The cables float in the plane just under the cards, with a socket at each end. They draw
// themselves in once, on load.
function Cables() {
  return (
    <svg
      className="absolute inset-0 overflow-visible"
      width={PLANE}
      height={PLANE}
    >
      <g
        fill="none"
        stroke="var(--accent)"
        strokeWidth={4}
        strokeLinecap="round"
      >
        {CABLES.map((c, i) => (
          <path
            key={i}
            d={cable(c.from, c.to, c.out, c.into)}
            className={"dotted" in c ? "hero-cable-dotted" : "hero-cable"}
            style={{ animationDelay: `${300 + i * 160}ms` }}
          />
        ))}
      </g>
      <g fill="var(--accent-deep)">
        {CABLES.flatMap((c, i) => [
          <circle key={`a${i}`} cx={c.from[0]} cy={c.from[1]} r={6} />,
          <circle key={`b${i}`} cx={c.to[0]} cy={c.to[1]} r={6} />,
        ])}
      </g>
    </svg>
  );
}

// A card held above its footprint. Its shadow falls well below it, blurred, which is what makes
// it read as floating rather than lying flat.
function Floating({ spot, children }: { spot: Spot; children: ReactNode }) {
  const box: CSSProperties = {
    left: spot.x,
    top: spot.y,
    width: spot.w,
    height: spot.h,
  };
  return (
    <>
      <div
        className="absolute rounded-[24px] bg-[rgb(31_34_140/0.2)] blur-xl"
        style={{ ...box, transform: "translateZ(-60px) translate(18px, 18px)" }}
      />
      <div
        className="absolute"
        style={{ ...box, transform: `translateZ(${spot.lift}px)` }}
      >
        {children}
      </div>
    </>
  );
}

// Card fills: white like the chart's genre cards, the accent blue of its Siblings card, or the
// deep indigo of its Kindred section. The blue ones flip the text colors (.surface-blue).
type Tone = "white" | "blue" | "indigo";
const TONE: Record<Tone, string> = {
  white: "depth-card bg-white",
  blue: "surface-blue depth-tile bg-accent",
  indigo: "surface-blue depth-tile bg-accent-deep",
};

function Tile({
  tone = "white",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex size-full flex-col justify-between rounded-[22px] p-4 ${TONE[tone]} ${className}`}
    >
      {children}
    </div>
  );
}

// A genre: its tier at the top, then the year it emerged, large, with its name. Read across
// the cards, the years tell the history. Kindred has no year (it's a link by feel, from any
// era), so its name is the large part instead.
function GenreCard({
  number,
  tier,
  name,
  year,
  tone,
}: {
  number: string;
  tier: string;
  name: string;
  year?: number;
  tone?: Tone;
}) {
  return (
    <Tile tone={tone}>
      <p className="meta text-(--muted)">
        <span className="text-(--faint)">{number}</span> {tier}
      </p>
      {year ? (
        <div>
          <p className="display text-[40px]">{year}</p>
          <p className="mt-1 text-[13px] leading-tight font-semibold tracking-tight">
            {name}
          </p>
        </div>
      ) : (
        <p className="display text-base">{name}</p>
      )}
    </Tile>
  );
}

// The seed, and the only cover in the scene: a white card, the cover filling most of it.
function SeedCard() {
  return (
    <Tile className="gap-2.5 p-2.5">
      <Cover
        url="https://coverartarchive.org/release-group/0dac7ff9-b4d1-423e-bf6b-7d194abb0e14/front-500"
        className="min-h-0 w-full flex-1 sleeve-shadow"
        rounded="rounded-[14px]"
      />
      <div className="px-1 pb-0.5">
        <p className="truncate text-[13px] leading-tight font-semibold tracking-tight">
          Stranger in the Alps
        </p>
        <p className="truncate text-[11px] text-(--muted)">Phoebe Bridgers</p>
      </div>
    </Tile>
  );
}

// A loose tile: the size of the chart, as a big number.
function StatTile() {
  return (
    <Tile tone="blue">
      <p className="display text-[48px]">18</p>
      <p className="meta text-(--muted)">Albums across 5 genres</p>
    </Tile>
  );
}

// A loose tile: a few short traits, the sound the chart's picks share. Short enough to pack
// into two rows like bricks. Made up for the illustration, not the chart's real traits, which
// are too long for a tile this size.
function TraitsTile() {
  return (
    <Tile className="gap-2">
      <p className="meta text-(--muted)">Sounds like</p>
      <div className="flex flex-wrap gap-1">
        {["Hushed", "Lo-fi", "Acoustic", "Confessional", "Late night"].map(
          (t) => (
            <span
              key={t}
              className="rounded-full bg-(--chip) px-2 py-0.5 text-[11px] font-medium"
            >
              {t}
            </span>
          ),
        )}
      </div>
    </Tile>
  );
}
