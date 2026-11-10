import { type RecordedEvent } from "./events";

export type SaveChartInput = {
  artist: string;
  title: string;
  mbid: string;
  events: RecordedEvent[];
  userId: string;
};
