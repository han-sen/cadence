"use client";

import { useRouter } from "next/navigation";
import { Button } from "react-aria-components";
import { authClient } from "@/lib/auth-client";
import { DEMO_CHARTS } from "@/lib/lineage/demo-charts";
import { AlbumSearch } from "./album-search";
import { AlbumStrip } from "./album-strip";
import { HeroIllustration } from "./hero-illustration";

// The home page: a splash hero (the pitch and search on the left, a floating piece of a chart on
// the right, on one shared glow), then the demo charts drifting past in a full-width strip.
// Picking an album, in search or the strip, opens its chart page.
export function HomeView() {
  return (
    <div className="flex flex-col">
      <Hero />
      {/* No heading: signed out, the hero's hint under the sign-in button points to these;
          signed in, the sleeves speak for themselves. The section keeps its label for
          screen readers. */}
      <AlbumStrip albums={DEMO_CHARTS} label="Example charts" />
    </div>
  );
}

function Hero() {
  return (
    // Full width, so the glow and the illustration can run to the screen's edges. Clipped
    // sideways so the illustration's overhang never makes the page scroll.
    <section className="relative isolate overflow-x-clip">
      <HeroGlow />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-4 px-4 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-0 lg:pt-4">
        <HeroText />
        {/* Pulled right on wide screens so the picture overhangs the column toward the edge.
            Kept clear of the strip below: its sleeves are cards too, and overlapping them
            muddles the two. */}
        <div className="-mt-4 mb-6 lg:-mt-10 lg:mb-4 lg:-mr-24 lg:-ml-8">
          <HeroIllustration />
        </div>
      </div>
    </section>
  );
}

// Soft blue light behind the hero, brightest behind the illustration, fading into the page
// before the strip.
function HeroGlow() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 -z-10 bg-[radial-gradient(45%_55%_at_72%_48%,rgb(81_97_255/0.24),transparent_70%),radial-gradient(35%_45%_at_18%_30%,rgb(31_34_184/0.08),transparent_70%)]"
    />
  );
}

function HeroText() {
  const router = useRouter();
  // Search needs a session (the API returns 401 without one). Signed out, the search box
  // becomes a sign-in button. While the session is loading, the box shows but stays disabled,
  // so nothing jumps and it can't be used a moment before it's allowed.
  const { data: session, isPending } = authClient.useSession();
  const signedOut = !isPending && !session;

  return (
    <div className="relative z-10 flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="display max-w-xl text-5xl sm:text-6xl lg:text-7xl">
          Every album has a family tree
        </h2>
        <p className="max-w-md text-lg leading-snug text-(--muted)">
          Name an album you love. See where it came from, where it led, and what
          to play next.
        </p>
      </div>

      {signedOut ? (
        <div className="flex flex-col items-start gap-3">
          <Button
            className="btn-tactile h-14 rounded-full px-7 text-sm font-semibold text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onPress={() =>
              authClient.signIn.social({ provider: "google", callbackURL: "/" })
            }
          >
            Sign in to chart any album
          </Button>
          <p className="text-sm text-(--muted)">
            Or open one of the charts below, no account needed.
          </p>
        </div>
      ) : (
        <div className="max-w-lg">
          <AlbumSearch
            isOnPage
            isDisabled={!session}
            onSelect={(album) => router.push(`/album/${album.mbid}`)}
          />
        </div>
      )}
    </div>
  );
}
