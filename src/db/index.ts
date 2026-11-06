import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local.");

const globalForDb = globalThis as unknown as {
  db?: ReturnType<typeof drizzle>;
};

export const db = globalForDb.db ?? drizzle(url);
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
