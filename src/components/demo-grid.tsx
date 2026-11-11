"use client";

import { DEMO_CHARTS, type DemoChart } from "@/lib/lineage/demo-charts";
import { Cover } from "./cover";
import { SectionLabel } from "./lineage-flow";

// The home page's six saved charts, 3×2 across the page's full width, covers scaling with it.
// Picking one replays its chart; anyone can, signed in or not.
export function DemoGrid({ onPick }: { onPick: (demo: DemoChart) => void }) {
  return (
    <section aria-label="Example charts" className="mt-8 flex flex-col gap-5">
      <SectionLabel label="Try one" hint="Or start with one of these" />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5">
        {DEMO_CHARTS.map((demo) => (
          <li key={demo.chartId}>
            <button
              type="button"
              onClick={() => onPick(demo)}
              className="group flex w-full flex-col gap-3 text-left"
            >
              <Cover
                url={demo.coverUrl}
                className="aspect-square w-full rounded-2xl transition-transform duration-200 group-hover:-translate-y-1"
              />
              <span className="flex min-w-0 flex-col break-words">
                <span className="leading-tight font-semibold tracking-tight">
                  {demo.title}
                </span>
                <span className="text-sm text-(--muted)">{demo.artist}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
