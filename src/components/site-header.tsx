import Link from "next/link";
import { AuthButton } from "./auth-button";
import { LogoMark } from "./logo-mark";

// The app bar on every page: the wordmark on the left, sign-in or the signed-in user on the
// right. Sticky, on a translucent page-colored fill, so content scrolls under it.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        {/* The page's main heading: the mark and the wordmark. The mark is decorative, so the
            link's name is just "Cadence". */}
        <h1 className="display text-2xl">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="size-7 shrink-0">
              <LogoMark />
            </span>
            Cadence
          </Link>
        </h1>
        <AuthButton />
      </div>
    </header>
  );
}
