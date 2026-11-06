import "server-only";
import * as schema from "./schema";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local.");

const globalForDb = globalThis as unknown as {
  db?: NodePgDatabase<typeof schema>;
};

export const db = globalForDb.db ?? drizzle({ connection: url, schema });
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
