"use client";

import { Button } from "react-aria-components";
import { authClient } from "@/lib/auth-client";

const BUTTON =
  "rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white/80 " +
  "transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white/60";

export function AuthButton() {
  const { data, isPending } = authClient.useSession();

  if (isPending) return null;

  if (!data) {
    return (
      <Button
        className={BUTTON}
        onPress={() =>
          authClient.signIn.social({ provider: "google", callbackURL: "/" })
        }
      >
        Sign in with Google
      </Button>
    );
  }

  const { user } = data;
  return (
    <div className="flex items-center gap-3">
      {user.image && (
        <img
          src={user.image}
          alt=""
          referrerPolicy="no-referrer"
          className="size-8 rounded-full"
        />
      )}
      <span className="text-sm text-white/80">{user.name}</span>
      <Button className={BUTTON} onPress={() => authClient.signOut()}>
        Sign out
      </Button>
    </div>
  );
}
