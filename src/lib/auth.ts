import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/db";
import { requireEnv } from "@/lib/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  // Google's tokens are stored encrypted (with BETTER_AUTH_SECRET), so a leaked database
  // doesn't hand them out. Cadence never uses them after sign-in. Rows saved before this was
  // on stay readable: Better Auth only decrypts values that look encrypted. Changing the
  // secret makes stored tokens unreadable, which here only means signing in again.
  account: { encryptOAuthTokens: true },
  socialProviders: {
    google: {
      clientId: requireEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
      prompt: "select_account",
    },
  },
});
