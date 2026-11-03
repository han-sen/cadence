import type { CSSProperties } from "react";

// The page background: one big soft black-and-green blur. A few large pools of emerald,
// heavily blurred, drift on their own paths behind everything, so the glass cards always have
// some shifting light to blur. Fixed in place: the content scrolls over it.
// Still under prefers-reduced-motion.

// Each pool wanders to its own offset and back, at its own speed, so they move against each
// other rather than in step. --dx/--dy/--s feed the shared "drift" keyframes in globals.css.
const POOLS: { className: string; style: CSSProperties }[] = [
  {
    className: "-top-[20%] right-[-10%] h-[80vh] w-[70vw] bg-[#0d6b5d]/70",
    style: {
      "--dx": "-14vw",
      "--dy": "10vh",
      "--s": "1.15",
      animationDuration: "19s",
    } as CSSProperties,
  },
  {
    className: "top-[35%] -left-[20%] h-[70vh] w-[60vw] bg-[#0a4a42]/80",
    style: {
      "--dx": "16vw",
      "--dy": "-8vh",
      "--s": "1.1",
      animationDuration: "23s",
      animationDelay: "-7s",
    } as CSSProperties,
  },
  {
    className: "-bottom-[25%] right-[15%] h-[60vh] w-[55vw] bg-[#0f574c]/50",
    style: {
      "--dx": "-10vw",
      "--dy": "-12vh",
      "--s": "1.2",
      animationDuration: "17s",
      animationDelay: "-11s",
    } as CSSProperties,
  },
  // A darker pool through the middle, so the light reads as patches rather than a wash.
  {
    className: "top-[20%] left-[25%] h-[50vh] w-[45vw] bg-black/50",
    style: {
      "--dx": "12vw",
      "--dy": "8vh",
      "--s": "0.9",
      animationDuration: "21s",
      animationDelay: "-3s",
    } as CSSProperties,
  },
];

export function Background() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#021617]"
    >
      {POOLS.map((pool, i) => (
        <div
          key={i}
          style={pool.style}
          className={`absolute rounded-full blur-[120px] motion-safe:animate-[drift_20s_ease-in-out_infinite_alternate] ${pool.className}`}
        />
      ))}
    </div>
  );
}
