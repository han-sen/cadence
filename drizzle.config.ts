import { defineConfig } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: url },
});
