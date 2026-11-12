"use client";

import { type CSSProperties, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createHalftone, loadCoverForWebGL } from "@/lib/halftone";
import { Cover } from "./cover";

// The seed cover's loading sequence (prototype: public/prototypes/sequence.html):
// 1. A short crate flip of blank glass sleeves while the cover loads (at least ~2s).
// 2. It lands on the seed sleeve, which shows the cover as color halftone dots on paper. The dots
//    get finer at each real stream event, and creep a little in between so they never sit
//    still, but never run ahead of real progress.
// 3. When the first album is confirmed (or the stream ends), the dots dissolve into the plain
//    cover: the page below now has something to read.
// Falls back to a plain <Cover> under prefers-reduced-motion or without WebGL.

export type SeedProgress = {
  traitsArrived: boolean;
  albumsNamed: boolean;
  // The first album was confirmed, or the stream ended some other way.
  finished: boolean;
};

const MIN_CRATE_MS = 2000;
const FLIP_MS = 330;
const PLACE_DELAY_MS = 320;
const RESOLVE_S = 1.4;
// Sleeves in the crate. Only a few are visible: at cover size, a deep stack reads as a smudge.
const VISIBLE = 3;
const STACK = VISIBLE + 1; // one extra waits hidden at the back, so a flip never leaves a gap

// Dot detail reached at each stage, plus where the creep tops out.
const LEVELS = [0, 0.4, 0.6];
const CEILING = 0.85;
const CREEP_TAU_S = 4;

// Search results use the 250px thumbnails; the seed is drawn larger, so ask for 500px.
export const largeCover = (url: string) => url.replace(/front-250$/, "front-500");

// Checked once per page load and remembered: the probe creates a WebGL context, which is costly.
let animationSupported: boolean | undefined;
function canAnimate() {
  if (animationSupported === undefined) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const probe = reduced ? null : document.createElement("canvas").getContext("webgl");
    probe?.getExtension("WEBGL_lose_context")?.loseContext();
    animationSupported = probe !== null;
  }
  return animationSupported;
}
const neverChanges = () => () => {};

export function SeedLoader({ coverUrl, progress, className }: { coverUrl: string; progress: SeedProgress; className: string }) {
  // A chart page opened directly renders on the server first, where there's no window to check.
  // The server and the browser's first render both show the plain cover (the third argument),
  // so they match; the browser then switches to the animation if it can run it.
  const animate = useSyncExternalStore(neverChanges, canAnimate, () => false);
  if (!animate) return <Cover url={coverUrl} className={className} />;
  return <AnimatedSeed coverUrl={largeCover(coverUrl)} progress={progress} className={className} />;
}

type Sleeve = { id: number; leaving: boolean };

function AnimatedSeed({ coverUrl, progress, className }: { coverUrl: string; progress: SeedProgress; className: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageReady, setImageReady] = useState(false);
  const [minTimeDone, setMinTimeDone] = useState(false);
  const [placed, setPlaced] = useState(false); // seed sleeve has moved to the cover position
  const [resolved, setResolved] = useState(false); // dissolve finished: it's just the cover now
  const [sleeves, setSleeves] = useState<Sleeve[]>(() => Array.from({ length: STACK }, (_, i) => ({ id: i, leaving: false })));
  const landed = imageReady && minTimeDone;

  // The animation loop reads the latest props through a ref, so it doesn't restart on every event.
  const live = useRef({ progress, landed, placed });
  useEffect(() => {
    live.current = { progress, landed, placed };
  });

  useEffect(() => {
    const t = setTimeout(() => setMinTimeDone(true), MIN_CRATE_MS);
    return () => clearTimeout(t);
  }, []);

  // Flip the front sleeve off every FLIP_MS until we land.
  useEffect(() => {
    if (landed) return;
    let nextId = STACK;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const interval = setInterval(() => {
      setSleeves((s) => {
        const front = s.findIndex((x) => !x.leaving);
        return s.map((x, i) => (i === front ? { ...x, leaving: true } : x));
      });
      // Once the flip has played, drop that sleeve and add a fresh one at the back.
      timers.push(
        setTimeout(() => {
          setSleeves((s) => {
            const gone = s.findIndex((x) => x.leaving);
            return [...s.slice(0, gone), ...s.slice(gone + 1), { id: nextId++, leaving: false }];
          });
        }, FLIP_MS - 20),
      );
    }, FLIP_MS);
    return () => {
      clearInterval(interval);
      timers.forEach(clearTimeout);
    };
  }, [landed]);

  // After landing, give the seed sleeve a beat at the front of the crate, then lift it into place.
  useEffect(() => {
    if (!landed) return;
    const t = setTimeout(() => setPlaced(true), PLACE_DELAY_MS);
    return () => clearTimeout(t);
  }, [landed]);

  // WebGL halftone: load the cover, then draw every frame until the dissolve completes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const halftone = canvas && createHalftone(canvas);
    if (!halftone) {
      // Rare: the WebGL probe passed but this context failed. Show the cover without the effect.
      const t = setTimeout(() => {
        setImageReady(true);
        setResolved(true);
      });
      return () => clearTimeout(t);
    }
    let cancelled = false;
    loadCoverForWebGL(coverUrl).then((img) => {
      if (cancelled) return;
      halftone.setImage(img);
      setImageReady(true);
    });

    let frame = 0;
    let last = performance.now();
    let detail = 0;
    let resolveStart: number | null = null;
    const stageStart: (number | undefined)[] = [];

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { progress, landed, placed } = live.current;

      // Current stage: -1 still in the crate, 0 landed, 1 traits in, 2 albums named.
      const stage = !landed ? -1 : progress.albumsNamed ? 2 : progress.traitsArrived ? 1 : 0;
      for (let i = 0; i <= stage; i++) stageStart[i] ??= now;
      let target = 0;
      if (stage >= 0) {
        const base = LEVELS[stage];
        const next = LEVELS[stage + 1] ?? CEILING;
        const since = (now - stageStart[stage]!) / 1000;
        target = base + (next - base) * 0.85 * (1 - Math.exp(-since / CREEP_TAU_S));
      }
      detail += (target - detail) * Math.min(1, dt * 3);

      if (progress.finished && placed && resolveStart === null) resolveStart = now;
      const t = resolveStart === null ? 0 : Math.min(1, (now - resolveStart) / 1000 / RESOLVE_S);
      const resolve = 1 - Math.pow(1 - t, 3);

      halftone.draw({ time: now / 1000, detail, resolve });
      if (t >= 1) {
        setResolved(true);
        return; // last frame drawn; the canvas keeps showing the plain cover
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      halftone.dispose();
    };
  }, [coverUrl]);

  // Sleeves still in the crate, front first. Leaving ones keep rendering while they flip away.
  let slot = 0;
  return (
    <div aria-hidden className={`relative shrink-0 [perspective:600px] ${className}`}>
      {sleeves.map((s) => {
        const i = s.leaving ? -1 : (landed ? 1 : 0) + slot++;
        return <div key={s.id} className={`${SLEEVE} ${GLASS}`} style={sleeveStyle(i, s.leaving, placed)} />;
      })}
      <div
        className={`${SLEEVE} overflow-hidden ${resolved ? "border border-transparent" : GLASS}`}
        style={
          placed
            ? { left: 0, width: "100%", bottom: 0, transform: "none", zIndex: 200, transition: "transform .7s cubic-bezier(.2,.8,.2,1), bottom .7s, left .7s, width .7s, border-color .6s, background .6s" }
            : { ...sleeveStyle(0, false, false), opacity: landed ? 1 : 0, zIndex: 100 }
        }
      >
        <canvas ref={canvasRef} className="absolute inset-0 block size-full" />
      </div>
    </div>
  );
}

const SLEEVE = "absolute aspect-square rounded-md origin-bottom";
// Frosted glass: a white tint over whatever the page background is doing behind it.
const GLASS = "border border-white/25 bg-linear-to-br from-white/25 to-white/5 shadow-lg shadow-black/30 backdrop-blur-md";

// Position in the crate: 0 is the front sleeve, higher numbers sit further back and higher up.
// -1 is a sleeve flipping away. Once the seed is placed, the rest of the crate fades out.
function sleeveStyle(i: number, leaving: boolean, placed: boolean): CSSProperties {
  if (leaving) {
    return {
      left: "11%", width: "78%", bottom: "4%", zIndex: 60,
      transform: "rotateX(-88deg) translateY(10%)", opacity: 0,
      transition: "transform .3s cubic-bezier(.5,0,.8,.4), opacity .3s",
    };
  }
  return {
    left: "11%", width: "78%", bottom: `${4 + i * 10}%`, zIndex: 50 - i,
    transform: `rotateX(${14 + i * 4}deg) scale(${1 - i * 0.08})`,
    opacity: placed || i >= VISIBLE ? 0 : 1,
    transition: "transform .3s cubic-bezier(.2,.7,.3,1), bottom .3s, opacity .3s",
  };
}
