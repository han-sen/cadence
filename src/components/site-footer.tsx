import Link from "next/link";

// The quiet bar at the bottom of every page. Its privacy link is required: Google only lets the
// sign-in consent screen go public if the home page links to the privacy policy.
export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6">
      <span className="meta text-(--faint)">Cadence</span>
      <Link
        href="/privacy"
        className="meta text-(--muted) underline-offset-2 hover:text-(--ink) hover:underline"
      >
        Privacy
      </Link>
    </footer>
  );
}
