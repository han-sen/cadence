"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { z } from "zod";
import { CHART_SOURCE_HEADER } from "./charts";
import { ChartEvent } from "./events";
import type { AlbumPick, Genre, LineageChart, Verification } from "./schema";

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
  // True when the server is replaying a saved chart rather than making a new one.
  isReplay?: boolean;
};

// Each action carries the time it happened, so the reducer stays pure: same input, same output.
type Action =
  | { type: "start"; at: number }
  | { type: "source"; isReplay: boolean; at: number }
  | { type: "event"; event: ChartEvent; at: number }
  | { type: "fail"; message: string; at: number }
  | { type: "cancel"; at: number };

const initial: ChartState = { status: "idle", genres: [], albums: [] };

function reducer(state: ChartState, action: Action): ChartState {
  const now = action.at;
  switch (action.type) {
    case "start":
      return { ...initial, status: "streaming", startedAt: now };
    case "source":
      return { ...state, isReplay: action.isReplay };
    case "fail":
      return {
        ...state,
        status: "error",
        error: action.message,
        finishedAt: now,
      };
    case "cancel":
      return state.status === "streaming"
        ? { ...state, status: "cancelled", finishedAt: now }
        : state;
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
          return {
            ...s,
            albums: s.albums.map((a) =>
              a.id === e.id ? { ...a, check: e.check } : a,
            ),
          };
        case "done":
          return {
            ...s,
            status: "done",
            usage: e.usage,
            model: e.model,
            finishedAt: now,
          };
        case "error":
          return { ...s, status: "error", error: e.message, finishedAt: now };
      }
    }
  }
}

// Checks a line against the shared event schema. A malformed event is skipped rather than
// ending the stream, so one bad album can't throw away the rest of the chart.
function parseEvent(line: string): ChartEvent | null {
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    console.warn("Ignoring a stream line that isn't JSON:", line);
    return null;
  }
  const result = ChartEvent.safeParse(json);
  if (!result.success) {
    console.warn(
      "Ignoring a malformed chart event:",
      z.prettifyError(result.error),
      json,
    );
    return null;
  }
  return result.data;
}

// Streams a chart into state: start() makes one for an album (or replays its saved chart), play()
// replays a saved chart by id. Both read the same newline-delimited event stream.
export function useChartStream() {
  const [state, dispatch] = useReducer(reducer, initial);
  const controllerRef = useRef<AbortController | null>(null);

  // If the component goes away mid-stream, stop the request so the server stops calling Claude.
  useEffect(() => () => controllerRef.current?.abort(), []);

  // The shared part of start() and play(). Each passes in a `send` function that makes its own
  // fetch; run() stops any chart already streaming, calls send, then reads the response's
  // events into state.
  const run = useCallback(
    async (send: (signal: AbortSignal) => Promise<Response>) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      dispatch({ type: "start", at: Date.now() });

      try {
        const res = await send(controller.signal);
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          dispatch({
            type: "fail",
            message: body?.error ?? `Request failed (${res.status}).`,
            at: Date.now(),
          });
          return;
        }
        dispatch({
          type: "source",
          isReplay: res.headers.get(CHART_SOURCE_HEADER) === "replay",
          at: Date.now(),
        });

        let finished = false;
        const handleLine = (line: string) => {
          if (!line.trim()) return;
          const event = parseEvent(line);
          if (!event) return;
          if (event.type === "done" || event.type === "error") finished = true;
          dispatch({ type: "event", event, at: Date.now() });
        };

        const reader = res.body
          .pipeThrough(new TextDecoderStream())
          .getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          // Events are one JSON object per line; keep any trailing partial line for the next chunk.
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.forEach(handleLine);
        }
        handleLine(buffer); // the last line, in case the stream didn't end with a newline

        if (!finished)
          dispatch({
            type: "fail",
            message: "The stream ended before the chart finished.",
            at: Date.now(),
          });
      } catch (err) {
        if (controller.signal.aborted) return;
        dispatch({
          type: "fail",
          message: err instanceof Error ? err.message : "Connection lost.",
          at: Date.now(),
        });
      }
    },
    [],
  );

  // Makes a chart for an album. Needs sign-in; the server replays the album's saved chart if it
  // has one.
  const start = useCallback(
    (artist: string, title: string, mbid: string) =>
      run((signal) =>
        fetch("/api/chart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artist, title, mbid }),
          signal,
        }),
      ),
    [run],
  );

  // Replays a saved chart by its id. Works signed out (the demo charts or shared charts).
  const play = useCallback(
    (chartId: string) =>
      run((signal) =>
        fetch(`/api/chart/${encodeURIComponent(chartId)}`, { signal }),
      ),
    [run],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    dispatch({ type: "cancel", at: Date.now() });
  }, []);

  return { state, start, play, cancel };
}
