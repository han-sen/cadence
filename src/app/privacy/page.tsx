import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy · Cadence",
  description:
    "What Cadence collects when you sign in, why, and how to have it deleted.",
};

// The privacy policy Google requires before the sign-in consent screen can be published. Keep it
// in step with the code: if the app starts storing something new, say so here and update the
// date.
const UPDATED = "22 November 2026";
const CONTACT = "mike@mikehansen.io";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-6 pb-16 sm:pt-10">
      <header className="flex flex-col gap-3">
        <h2 className="display text-4xl sm:text-5xl">Privacy</h2>
        <p className="meta text-(--muted)">Last updated {UPDATED}</p>
      </header>

      <div className="depth-card flex flex-col gap-8 rounded-[28px] bg-white p-6 sm:p-10">
        <p className="text-lg leading-snug">
          Cadence is a personal project that maps an album&apos;s genre lineage
          and suggests what to play next. You can open any chart without an
          account. Signing in with Google is only needed to chart a new album.
          This page explains what that stores and why.
        </p>

        <Section title="What Cadence stores">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong>Your Google profile:</strong> your name, email address and
              profile picture, which Google shares when you sign in. Cadence
              uses them to show who&apos;s signed in.
            </li>
            <li>
              <strong>Google sign-in tokens:</strong> stored encrypted. Cadence
              doesn&apos;t use them to access anything else in your Google
              account.
            </li>
            <li>
              <strong>Your sign-in session:</strong> a session record with the
              IP address and browser it started from, and a cookie that keeps
              you signed in.
            </li>
            <li>
              <strong>Your charts:</strong> the charts you create, and which
              charts you&apos;ve opened while signed in. Charts are public:
              anyone can open them, but your name isn&apos;t shown with them.
            </li>
          </ul>
        </Section>

        <Section title="What it doesn't do">
          <p>
            Cadence doesn&apos;t sell or share your personal data, show ads, or
            use analytics or tracking scripts. The only cookie is the one that
            keeps you signed in. Your IP address is also used briefly to limit
            how many requests can be made, but it isn&apos;t stored for that.
          </p>
        </Section>

        <Section title="Services it uses">
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>
              <strong>Google</strong> handles sign-in.
            </li>
            <li>
              <strong>Anthropic</strong> (Claude) generates the charts. It
              receives the album you picked, not your name or email.
            </li>
            <li>
              <strong>MusicBrainz</strong> and the{" "}
              <strong>Cover Art Archive</strong> supply album details and
              covers. They receive album searches, not your personal data.
            </li>
            <li>
              <strong>Render</strong> hosts the app and its database.
            </li>
          </ul>
        </Section>

        <Section title="Deleting your data">
          <p>
            Email{" "}
            <a
              href={`mailto:${CONTACT}`}
              className="font-medium text-accent underline underline-offset-2"
            >
              {CONTACT}
            </a>{" "}
            from the address you sign in with, and your account and history will
            be deleted. Charts you created stay available, with no link to you.
            You can also remove Cadence&apos;s access from your Google account
            settings at any time.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Anything else about your data: {CONTACT}. If this policy changes,
            the date at the top will change with it.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 leading-relaxed text-(--muted) [&_strong]:font-semibold [&_strong]:text-(--ink)">
      <h3 className="display text-xl text-(--ink) sm:text-2xl">{title}</h3>
      {children}
    </section>
  );
}
