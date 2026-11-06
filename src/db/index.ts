import "server-only";
import * as schema from "./schema";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { requireEnv } from "@/lib/env";

const url = requireEnv("DATABASE_URL");

const globalForDb = globalThis as unknown as {
  db?: NodePgDatabase<typeof schema>;
};

export const db = globalForDb.db ?? drizzle({ connection: url, schema });
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
