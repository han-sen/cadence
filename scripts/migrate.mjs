// Applies any database migrations in drizzle/ that haven't run yet, then exits. On Render this
// runs right before the app starts (see the start command in the README), because the free plan
// has no pre-deploy step and it's unclear whether the build can reach the database.
//
// Uses drizzle-orm's own migrator, not drizzle-kit, so it works without dev dependencies. It
// records what it ran in the same table drizzle-kit uses (drizzle.__drizzle_migrations), so the
// two can be mixed: `npx drizzle-kit migrate` locally, this script on the server.
//
// Plain JavaScript so Node can run it directly, with no TypeScript step.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const db = drizzle(url);
try {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migrations are up to date.");
} catch (error) {
  // Exiting with an error stops the start command, so the new version never goes live on a
  // half-migrated database. Render keeps the previous version running.
  console.error("Migration failed:", error);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
