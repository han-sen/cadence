"use client";

import { Button } from "react-aria-components";
import { authClient } from "@/lib/auth-client";

const BUTTON =
  "rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white uppercase " +
  "transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

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
      <span className="text-sm font-medium">{user.name}</span>
      <Button className={BUTTON} onPress={() => authClient.signOut()}>
        Sign out
      </Button>
    </div>
  );
}
