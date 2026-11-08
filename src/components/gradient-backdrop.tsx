// The kindred section's backdrop: a soft grainy gradient in the page's blues. The electric
// accent glows across the upper left and center and fades into deep navy that fills the whole
// right side and the bottom-left corner (about half the area, like the reference), then a fine
// monochrome grain over everything, like a risograph or film print.
// Fills its nearest positioned parent, behind the content (the parent needs `isolate`).

// The darkest tone: the page's deep blue pushed toward black, not a new hue.
const NAVY = "color-mix(in oklab, var(--accent-deep), black 55%)";

const GRADIENT = [
  // Navy pooling over the right side and in the bottom-left corner.
  `radial-gradient(60% 85% at 100% 0%, ${NAVY} 0%, ${NAVY} 30%, transparent 75%)`,
  `radial-gradient(45% 60% at 0% 110%, ${NAVY} 0%, ${NAVY} 25%, transparent 75%)`,
  // The accent glow: a band from the upper left toward the center.
  "radial-gradient(40% 70% at 20% 28%, var(--accent) 0%, var(--accent) 35%, transparent 85%)",
  "radial-gradient(35% 60% at 40% 62%, var(--accent) 0%, var(--accent) 20%, transparent 85%)",
  `linear-gradient(135deg, var(--accent-deep) 0%, var(--accent-deep) 45%, ${NAVY} 100%)`,
].join(",");

// Fractal noise as an SVG data URI, tiled. Gray only, so it shifts lightness, not color.
// Raw noise is mostly mid-gray, which `overlay` barely shows, so its contrast is stretched 4×.
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncR type='linear' slope='4' intercept='-1.5'/><feFuncG type='linear' slope='4' intercept='-1.5'/><feFuncB type='linear' slope='4' intercept='-1.5'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(#g)'/></svg>`,
)}")`;

export function GradientBackdrop() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 -z-10 overflow-hidden"
      style={{ background: GRADIENT }}
    >
      {/* The grain. Remove this layer for a clean gradient. */}
      {/* <div
        className="absolute inset-0 opacity-75 mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: "220px 220px" }}
      /> */}
    </div>
  );
}
