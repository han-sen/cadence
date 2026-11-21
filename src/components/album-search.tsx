"use client";

import { useRef } from "react";
import {
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
  useAsyncList,
} from "react-aria-components";
import { type AlbumSuggestion, SearchResponse } from "@/lib/lineage/schema";
import { Cover } from "./cover";

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

const label = (album: AlbumSuggestion) => `${album.title} — ${album.artist}`;

// Search-as-you-type for the seed album. React Aria's ComboBox handles the accessibility:
// arrow keys, Enter, Escape, focus, and announcing results to screen readers.
// useAsyncList runs `load` whenever the text changes and aborts the previous run, so only the
// latest search can update the list.
// `isOnPage` is for a box sitting on the page background rather than in a white card: the box
// itself is white and raised instead of lavender.
export function AlbumSearch({
  onSelect,
  isDisabled,
  placeholder = "Search by album or artist, e.g. Untrue Burial",
  isOnPage = false,
}: {
  onSelect: (album: AlbumSuggestion) => void;
  isDisabled: boolean;
  placeholder?: string;
  isOnPage?: boolean;
}) {
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

      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal,
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (body as { error?: string } | null)?.error;
        throw new Error(message ?? "Album search failed.");
      }
      const parsed = SearchResponse.safeParse(body);
      if (!parsed.success)
        throw new Error("Album search returned something unexpected.");
      return { items: parsed.data.results };
    },
  });

  const searching =
    list.isLoading && list.filterText.trim().length >= MIN_CHARS;

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
      {/* Hidden on screen (the hero's headline says what the box is for) but kept as the
          input's name, so screen readers announce more than "combo box". */}
      <Label className="sr-only">Album</Label>
      <div className="relative">
        <Input
          placeholder={placeholder}
          className={`h-14 w-full rounded-full border-2 border-transparent px-6 ${isOnPage ? "depth-card bg-white" : "bg-background"} text-base outline-none placeholder:text-(--faint) focus:border-accent disabled:cursor-not-allowed disabled:text-(--muted) disabled:placeholder:text-(--muted) sm:text-lg ${searching ? "pr-28" : ""}`}
        />
        {searching && (
          <span className="meta absolute top-1/2 right-6 -translate-y-1/2 text-(--faint)">
            Searching…
          </span>
        )}
      </div>
      {list.error && (
        <Text slot="errorMessage" className="text-sm text-red-600">
          {list.error.message}
        </Text>
      )}
      <Popover
        offset={4}
        className="w-(--trigger-width) overflow-auto rounded-3xl bg-white shadow-xl shadow-accent-deep/15 ring-1 ring-(--line)"
      >
        <ListBox
          className="max-h-96 p-2 outline-none"
          renderEmptyState={() => (
            <p className="px-3 py-2 text-sm text-(--muted)">
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
              className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 outline-none data-focused:bg-accent/10"
            >
              <Cover url={album.coverUrl} className="size-10" />
              <span className="flex min-w-0 flex-col">
                <Text slot="label" className="truncate text-sm font-medium">
                  {album.title}
                </Text>
                <Text
                  slot="description"
                  className="truncate text-xs text-(--muted)"
                >
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
