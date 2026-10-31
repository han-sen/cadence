"use client";

import { useRef } from "react";
import { ComboBox, Input, Label, ListBox, ListBoxItem, Popover, Text, useAsyncList } from "react-aria-components";
import { type AlbumSuggestion, SearchResponse } from "@/lib/lineage/schema";
import { Cover } from "./cover";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

const label = (album: AlbumSuggestion) => `${album.title} — ${album.artist}`;

// Search-as-you-type for the seed album. React Aria's ComboBox handles the accessibility:
// arrow keys, Enter, Escape, focus, and announcing results to screen readers.
// useAsyncList runs `load` whenever the text changes and aborts the previous run, so only the
// latest search can update the list.
export function AlbumSearch({ onSelect, isDisabled }: { onSelect: (album: AlbumSuggestion) => void; isDisabled: boolean }) {
  // Picking an album fills the input with its label; that text shouldn't trigger a new search.
  const pickedLabel = useRef<string | null>(null);

  const list = useAsyncList<AlbumSuggestion>({
    async load({ signal, filterText = "", items }) {
      const q = filterText.trim();
      if (q === pickedLabel.current) return { items };
      if (q.length < MIN_CHARS) return { items: [] };

      // Wait for a pause in typing. If another key arrives first, this run is aborted here.
      await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS));
      signal.throwIfAborted();

      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (body as { error?: string } | null)?.error;
        throw new Error(message ?? "Album search failed.");
      }
      const parsed = SearchResponse.safeParse(body);
      if (!parsed.success) throw new Error("Album search returned something unexpected.");
      return { items: parsed.data.results };
    },
  });

  const searching = list.isLoading && list.filterText.trim().length >= MIN_CHARS;

  return (
    <ComboBox
      items={list.items}
      inputValue={list.filterText}
      onInputChange={list.setFilterText}
      onChange={(key) => {
        const album = list.items.find((a) => a.mbid === key);
        if (!album) return;
        pickedLabel.current = label(album);
        onSelect(album);
      }}
      menuTrigger="input"
      // Results arrive after the menu decides whether to open, so let it open while empty
      // and show the search status inside it instead.
      allowsEmptyCollection
      isDisabled={isDisabled}
      className="flex flex-1 flex-col gap-1"
    >
      <Label className="text-sm font-medium">Album</Label>
      <div className="relative">
        <Input
          placeholder="Search by album or artist, e.g. Untrue Burial"
          className="h-10 w-full rounded-md border border-zinc-300 bg-transparent px-3 pr-24 outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
        />
        {searching && <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-zinc-400">Searching…</span>}
      </div>
      {list.error && (
        <Text slot="errorMessage" className="text-sm text-red-600 dark:text-red-400">
          {list.error.message}
        </Text>
      )}
      <Popover
        offset={4}
        className="w-(--trigger-width) overflow-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
      >
        <ListBox
          className="max-h-96 p-1 outline-none"
          renderEmptyState={() => (
            <p className="px-2 py-1.5 text-sm text-zinc-500">
              {list.filterText.trim().length < MIN_CHARS
                ? "Keep typing…"
                : list.isLoading
                  ? "Searching…"
                  : list.error
                    ? list.error.message
                    : "No albums found. Try the artist's name too."}
            </p>
          )}
        >
          {(album: AlbumSuggestion) => (
            <ListBoxItem
              id={album.mbid}
              textValue={label(album)}
              className="flex cursor-default items-center gap-3 rounded px-2 py-1.5 outline-none data-focused:bg-zinc-100 dark:data-focused:bg-zinc-800"
            >
              <Cover url={album.coverUrl} className="size-10" />
              <span className="flex min-w-0 flex-col">
                <Text slot="label" className="truncate text-sm font-medium">
                  {album.title}
                </Text>
                <Text slot="description" className="truncate text-xs text-zinc-500">
                  {album.artist}
                  {album.year ? ` · ${album.year}` : ""}
                  {album.type === "EP" ? " · EP" : ""}
                </Text>
              </span>
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
}
