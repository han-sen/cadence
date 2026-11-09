import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { RecordedEvent } from "@/lib/lineage/events";
import { user } from "./auth-schema";

// One generated chart. Shared by everyone and never changed once saved: a refresh inserts a
// new row, and the album's canonical chart is its newest row.
export const chart = pgTable(
  "chart",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    seedMbid: text("seed_mbid").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    events: jsonb("events").$type<RecordedEvent[]>().notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chart_seedMbid_createdAt_idx").on(table.seedMbid, table.createdAt),
  ],
);

// A user's history: which chart they opened, and when.
export const chartView = pgTable(
  "chart_view",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chartId: text("chart_id")
      .notNull()
      .references(() => chart.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at").defaultNow().notNull(),
  },
  (table) => [
    index("chart_view_userId_viewedAt_idx").on(table.userId, table.viewedAt),
  ],
);
