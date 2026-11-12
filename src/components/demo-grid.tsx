"use client";

import Link from "next/link";
import { DEMO_CHARTS } from "@/lib/lineage/demo-charts";
import { Cover } from "./cover";
import { SectionLabel } from "./lineage-flow";

// The home page's six saved charts, 3×2 across the page's full width, covers scaling with it.
// Each links to its album's chart page, which replays the chart for anyone, signed in or not.
export function DemoGrid() {
  return (
    <section aria-label="Example charts" className="mt-8 flex flex-col gap-5">
      <SectionLabel label="Try one" hint="Or start with one of these" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:gap-8">
        {DEMO_CHARTS.map((demo) => (
          <li key={demo.chartId} className="rounded-[28px] bg-white p-3 sm:p-4">
            <Link
              href={`/album/${demo.mbid}`}
              className="group flex w-full flex-col gap-3 text-left"
            >
              <Cover
                url={demo.coverUrl}
                rounded="rounded-full"
                className="aspect-square w-full shadow-xs transition-transform duration-200 group-hover:-translate-y-1"
              />
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
