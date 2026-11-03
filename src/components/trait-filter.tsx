"use client";

import { createContext, use } from "react";
import type { AlbumPick } from "@/lib/lineage/schema";

// The trait the user clicked, if any. Shared through context because trait pills and album
// cards sit several components deep (flow → tier → genre card → album card → pills).
export const ActiveTrait = createContext<{ active: string | null; toggle: (trait: string) => void }>({
  active: null,
  toggle: () => {},
});

// Claude copies traits from the seed's list, but compare loosely in case the casing drifts.
export const sameTrait = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const sharesTrait = (album: AlbumPick, trait: string) => album.sharedTraits.some((t) => sameTrait(t, trait));

// True when a trait is selected and this album doesn't share it, so it should fade.
export function useDimmed(album: AlbumPick) {
  const { active } = use(ActiveTrait);
  return active !== null && !sharesTrait(album, active);
}

// Each pill is a toggle button: clicking it fades every album that doesn't share the trait.
// Inline items, so a run of pills wraps around a floated cover like text does.
export function TraitList({ traits }: { traits: string[] }) {
  const { active, toggle } = use(ActiveTrait);
  if (!traits.length) return null;
  return (
    <ul className="leading-none">
      {traits.map((t) => {
        const pressed = active !== null && sameTrait(active, t);
        return (
          <li key={t} className="mr-1.5 mb-1.5 inline-block">
            <button
              type="button"
              aria-pressed={pressed}
              onClick={() => toggle(t)}
              className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                pressed ? "bg-white text-zinc-950" : "bg-white/10 text-white/80 hover:bg-white/20"
              }`}
            >
              {t}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
