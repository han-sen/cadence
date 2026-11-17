"use client";

import Link from "next/link";
import { DEMO_CHARTS } from "@/lib/lineage/demo-charts";
import { Cover } from "./cover";
import { SectionLabel } from "./lineage-flow";

// The home page's six saved charts as record sleeves, 3×2 across the page's full width, covers
// scaling with it.
// Each links to its album's chart page, which replays the chart for anyone, signed in or not.
export function DemoGrid() {
  return (
    <section aria-label="Example charts" className="mt-8 flex flex-col gap-5">
      <SectionLabel label="Try one" hint="Or start with one of these" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:gap-8">
        {DEMO_CHARTS.map((demo) => (
          <li key={demo.chartId}>
            {/* The whole card is the link, and lifts on hover. */}
            <Link
              href={`/album/${demo.mbid}`}
              className="group depth-card hover:depth-card-raised flex h-full flex-col gap-3 rounded-[28px] bg-white p-3 text-left transition duration-200 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-4"
            >
              {/* A record sleeve: the square cover with its record half out on the right. The
                  record slides further out and turns a little on hover. */}
              <div className="relative pr-[16%]">
                <span
                  aria-hidden
                  className="record absolute inset-y-[4%] right-[2%] aspect-square transition-transform duration-300 ease-out group-hover:translate-x-[9%] group-hover:rotate-[40deg] motion-reduce:transition-none"
                />
                {/* Solid white behind the cover: its loading placeholder is see-through, and the
                    record would show through it. */}
                <div className="relative rounded-md bg-white shadow-[0_1px_1px_rgb(0_0_0/0.2),6px_8px_18px_-6px_rgb(11_11_40/0.45)]">
                  <Cover url={demo.coverUrl} className="aspect-square w-full" />
                </div>
              </div>
              <span className="flex min-w-0 flex-col break-words">
                <span className="leading-tight font-semibold tracking-tight">
                  {demo.title}
                </span>
                <span className="text-sm text-(--muted)">{demo.artist}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
