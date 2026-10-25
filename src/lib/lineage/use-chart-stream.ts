"use client";

import { useCallback, useReducer, useRef } from "react";
import type { ChartEvent } from "./events";
import type { Verification } from "./musicbrainz";
import type { AlbumPick, Genre, LineageChart } from "./schema";

export type AlbumEntry = { id: number; album: AlbumPick; check?: Verification };

export type ChartState = {
  status: "idle" | "streaming" | "done" | "error" | "cancelled";
  seed?: LineageChart["seed"];
  genres: Genre[];
  albums: AlbumEntry[];
  error?: string;
  startedAt?: number;
  firstEventAt?: number;
  finishedAt?: number;
  usage?: { inputTokens: number; outputTokens: number };
  model?: string;
};

type Action =
  | { type: "start" }
  | { type: "event"; event: ChartEvent }
  | { type: "fail"; message: string }
  | { type: "cancel" };

const initial: ChartState = { status: "idle", genres: [], albums: [] };

function reducer(state: ChartState, action: Action): ChartState {
  const now = Date.now();
  switch (action.type) {
    case "start":
      return { ...initial, status: "streaming", startedAt: now };
    case "fail":
      return { ...state, status: "error", error: action.message, finishedAt: now };
    case "cancel":
      return state.status === "streaming" ? { ...state, status: "cancelled", finishedAt: now } : state;
    case "event": {
      const s = state.firstEventAt ? state : { ...state, firstEventAt: now };
      const e = action.event;
      switch (e.type) {
        case "seed":
          return { ...s, seed: e.seed };
        case "genre":
          return { ...s, genres: [...s.genres, e.genre] };
        case "album":
          return { ...s, albums: [...s.albums, { id: e.id, album: e.album }] };
        case "verified":
          return { ...s, albums: s.albums.map((a) => (a.id === e.id ? { ...a, check: e.check } : a)) };
        case "done":
          return { ...s, status: "done", usage: e.usage, model: e.model, finishedAt: now };
        case "error":
          return { ...s, status: "error", error: e.message, finishedAt: now };
      }
    }
  }
}

// Posts to /api/chart and folds the newline-delimited event stream into chart state.
export function useChartStream() {
  const [state, dispatch] = useReducer(reducer, initial);
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(async (artist: string, title: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: "start" });

    try {
      const res = await fetch("/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artist, title }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        dispatch({ type: "fail", message: body?.error ?? `Request failed (${res.status}).` });
        return;
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        // Events are one JSON object per line; keep any trailing partial line for the next chunk.
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ChartEvent;
          if (event.type === "done" || event.type === "error") finished = true;
          dispatch({ type: "event", event });
        }
      }
      if (!finished) dispatch({ type: "fail", message: "The stream ended before the chart finished." });
    } catch (err) {
      if (controller.signal.aborted) return;
      dispatch({ type: "fail", message: err instanceof Error ? err.message : "Connection lost." });
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    dispatch({ type: "cancel" });
  }, []);

  return { state, start, cancel };
}
