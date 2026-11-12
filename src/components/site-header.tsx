import Link from "next/link";
import { AuthButton } from "./auth-button";

// The app bar on every page: the wordmark on the left, sign-in or the signed-in user on the
// right. Sticky, on a translucent page-colored fill, so content scrolls under it.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        {/* The page's main heading. Placeholder text until there's a logo (keep the h1 and give
            the logo alt text "Cadence"). */}
        <h1 className="display text-2xl">
          <Link href="/">Cadence</Link>
        </h1>
        <AuthButton />
      </div>
    </header>
  );
}
