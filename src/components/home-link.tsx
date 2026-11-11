"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Sent when someone clicks the home link while already on the home page. The chart page
// listens for it and goes back to its empty state.
export const HOME_RESET_EVENT = "lineage:home-reset";

// A link to the home page that always lands on a fresh one. From any other page it's a normal
// navigation. On the home page itself, Next treats a link to the same URL as a no-op and the
// last chart would stay on screen, so it asks the page to reset and scrolls to the top.
export function HomeLink({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Link
      href="/"
      onClick={() => {
        if (pathname !== "/") return;
        window.dispatchEvent(new Event(HOME_RESET_EVENT));
        // Instant, like any navigation. A smooth scroll gets cut off when the chart clears
        // and the page shrinks under it.
        window.scrollTo({ top: 0 });
      }}
    >
      {children}
    </Link>
  );
}
