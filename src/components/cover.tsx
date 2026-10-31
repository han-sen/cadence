"use client";

import { useState } from "react";

const BOX = "shrink-0 rounded bg-zinc-200 dark:bg-zinc-800";

// Covers come from the Cover Art Archive via two redirects into archive.org, so they can take a
// few seconds and occasionally fail. Pulses while loading, retries once, and shows a distinct
// "no cover" square if it still fails (or the archive has no art for this album).
// alt="" because the title and artist are always shown next to it; a screen reader would only
// repeat them. `className` sets the size, e.g. "size-16".
export function Cover({ url, className }: { url: string; className: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "missing">("loading");
  const [attempt, setAttempt] = useState(0);

  const onError = () => {
    if (attempt === 0) {
      setTimeout(() => setAttempt(1), 2000);
      return;
    }
    console.warn("Cover art failed to load:", url);
    setStatus("missing");
  };

  if (status === "missing") {
    return (
      <div aria-hidden className={`${BOX} ${className} grid place-items-center text-zinc-400 dark:text-zinc-600`}>
        ♪
      </div>
    );
  }
  return (
    <div className={`${BOX} ${className} overflow-hidden ${status === "loading" ? "animate-pulse" : ""}`}>
      {/* Plain <img>: small thumbnails from an external archive, so Next's image optimizer
          would add a server round trip for little gain. The query string on a retry stops the
          browser from reusing the failed response. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={attempt}
        src={attempt ? `${url}?retry=${attempt}` : url}
        alt=""
        onLoad={() => setStatus("loaded")}
        onError={onError}
        className={`size-full object-cover transition-opacity duration-300 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

// Same footprint as a cover, for content that hasn't arrived yet.
export function CoverPlaceholder({ className }: { className: string }) {
  return <div aria-hidden className={`${BOX} ${className}`} />;
}
