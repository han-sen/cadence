"use client";

import { useEffect, useRef, useState } from "react";
import { type Box, type CableDrawing, cablePaths } from "@/lib/lineage/cables";
import type { Genre } from "@/lib/lineage/schema";

// Draws the cables over the genre cards. Put it inside the positioned element that holds the
// cards; it finds them by their data-genre-id attribute and measures where they sit.
// Hidden on phones, where the cards say "from X + Y" instead.
export function GenreCables({ genres }: { genres: Genre[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState<CableDrawing>({
    cables: [],
    sockets: [],
  });

  useEffect(() => {
    const container = svgRef.current?.parentElement;
    if (!container) return;
    const measure = () => {
      const origin = container.getBoundingClientRect();
      const boxes = new Map<string, Box>();
      container
        .querySelectorAll<HTMLElement>("[data-genre-id]")
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          boxes.set(el.dataset.genreId!, {
            l: r.left - origin.left,
            r: r.right - origin.left,
            t: r.top - origin.top,
            b: r.bottom - origin.top,
          });
        });
      setDrawing(cablePaths(genres, boxes));
    };
    // Card sizes change as albums stream in and covers load, and positions shift when a new
    // card joins a row, so watch the container and every card. Observing also runs measure
    // once straight away, which draws the first frame.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    container
      .querySelectorAll("[data-genre-id]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [genres]);

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible max-sm:hidden"
    >
      <g
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.7}
      >
        {drawing.cables.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g fill="var(--accent-deep)">
        {drawing.sockets.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={5} />
        ))}
      </g>
    </svg>
  );
}
