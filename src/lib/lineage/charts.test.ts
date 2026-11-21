import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { replayChart } from "./charts";
import type { ChartEvent, RecordedEvent } from "./events";

// ─── Helpers (ready to use) ──────────────────────────────────────────────────────────────

// replayChart doesn't look inside events, it only reads offsetMs. So any valid event will do
// as a payload. An "error" event is the smallest one, and its message doubles as a label, so a
// test can say "b was sent" instead of comparing whole objects.
const at = (offsetMs: number, label: string): RecordedEvent => ({
  offsetMs,
  event: { type: "error", message: label },
});

// The labels emit has been called with so far, in order: ["a", "b"].
// emit.mock.calls is an array with one entry per call, and each entry is that call's argument list.
const sentLabels = (
  emit: ReturnType<typeof vi.fn<(event: ChartEvent) => void>>,
) =>
  emit.mock.calls.map(([event]) =>
    event.type === "error" ? event.message : event.type,
  );

// ─── Tests ───────────────────────────────────────────────────────────────────────────────
//
// The pattern for every test:
//   1. Make a fake emit, a signal, and some events.
//   2. Start replayChart WITHOUT awaiting it. It only resolves once every event is sent, so
//      awaiting it right away would jump straight to the end.
//   3. Move fake time forward with `await vi.advanceTimersByTimeAsync(ms)` and check what has
//      been sent so far. Note that the ms is relative: each call moves time forward from wherever
//      it is now, it doesn't jump to an absolute time.
//   4. At the end, `await` the promise so the test doesn't finish with the replay still running.

describe("replayChart", () => {
  beforeEach(() => {
    // Fakes both setTimeout and Date.now, so replayChart's clock maths still works when time jumps.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("caps a long opening wait at 2.5s", async () => {
    // Events: the first at 24,000ms. Divided by 4 that's 6,000ms, more than the 2,500ms cap.
    const emit = vi.fn<(event: ChartEvent) => void>();
    const replay = replayChart(
      [at(24_000, "a")],
      emit,
      new AbortController().signal,
    );

    await vi.advanceTimersByTimeAsync(2_499);
    expect(sentLabels(emit)).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(sentLabels(emit)).toEqual(["a"]);

    await replay;
  });

  it("divides a short opening wait by 4 instead of capping it", async () => {
    // Events: the first at 4,000ms → should be sent at 1,000ms.
    const emit = vi.fn<(event: ChartEvent) => void>();
    const replay = replayChart(
      [at(4_000, "a")],
      emit,
      new AbortController().signal,
    );

    await vi.advanceTimersByTimeAsync(999);
    expect(sentLabels(emit)).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(sentLabels(emit)).toEqual(["a"]);

    await replay;
  });

  it("plays the gaps after the first event at 4x speed", async () => {
    // Events: a at 24,000, b at 26,000, c at 34,000.
    // Expected send times: a at 2,500, b at 3,000 (2,000ms gap / 4), c at 5,000 (10,000 / 4).
    const emit = vi.fn<(event: ChartEvent) => void>();
    const replay = replayChart(
      [at(24_000, "a"), at(26_000, "b"), at(34_000, "c")],
      emit,
      new AbortController().signal,
    );

    await vi.advanceTimersByTimeAsync(2_500); // now at 2,500
    expect(sentLabels(emit)).toEqual(["a"]);

    await vi.advanceTimersByTimeAsync(499); // 2,999: b isn't out early
    expect(sentLabels(emit)).toEqual(["a"]);

    await vi.advanceTimersByTimeAsync(1); // 3,000
    expect(sentLabels(emit)).toEqual(["a", "b"]);

    await vi.advanceTimersByTimeAsync(1_999); // 4,999: nor is c
    expect(sentLabels(emit)).toEqual(["a", "b"]);

    await vi.advanceTimersByTimeAsync(1); // 5,000
    expect(sentLabels(emit)).toEqual(["a", "b", "c"]);

    await replay;
  });

  it("stops sending once the client aborts", async () => {
    const controller = new AbortController();
    const emit = vi.fn<(event: ChartEvent) => void>();
    const replay = replayChart(
      [at(24_000, "a"), at(26_000, "b"), at(34_000, "c")],
      emit,
      controller.signal,
    );

    await vi.advanceTimersByTimeAsync(2_500);
    expect(sentLabels(emit)).toEqual(["a"]);

    // The client leaves while the replay is waiting for b.
    controller.abort();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(sentLabels(emit)).toEqual(["a"]);

    // It stops quietly: resolves rather than throwing.
    await expect(replay).resolves.toBeUndefined();
  });

  it("sends nothing if the client left before the replay started", async () => {
    // Already aborted, as when the request is cancelled before the replay gets going.
    const controller = new AbortController();
    controller.abort();
    const emit = vi.fn<(event: ChartEvent) => void>();
    const replay = replayChart(
      [at(24_000, "a"), at(26_000, "b")],
      emit,
      controller.signal,
    );

    await vi.advanceTimersByTimeAsync(10_000);
    expect(emit).not.toHaveBeenCalled();

    await replay;
  });

  it("finishes straight away with no events", async () => {
    // Nothing to wait for, so it can be awaited directly: no fake time has to pass.
    const emit = vi.fn<(event: ChartEvent) => void>();

    await replayChart([], emit, new AbortController().signal);

    expect(emit).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
