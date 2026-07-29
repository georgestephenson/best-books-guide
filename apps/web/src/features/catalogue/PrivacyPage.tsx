import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Crumbs, PageMeta, PublicLayout } from './components.js';

/**
 * The privacy page (docs/08 M5). It describes what the system actually does — the
 * account columns in docs/03, the one cookie in http/refresh-cookie.ts, the 14-day
 * Nginx logs and nightly S3 backups in docs/07 — so any change to those is a change
 * to this page. Prose, not legalese: the product's voice applies here too (docs/01).
 */

/** Deletion requests until self-serve export/delete ships (docs/08 backlog #7). */
const PRIVACY_EMAIL = 'privacy@bestbooks.guide';

/** The date this text last changed — bump it whenever the copy below does. */
const LAST_UPDATED = '27 July 2026';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-10" aria-labelledby={id}>
      <h2 id={id} className="font-serif text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-muted">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="ml-5 list-disc space-y-2">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function PrivacyPage() {
  const email = (
    <a className="text-accent hover:underline" href={`mailto:${PRIVACY_EMAIL}`}>
      {PRIVACY_EMAIL}
    </a>
  );

  return (
    <PublicLayout>
      <PageMeta
        title="Privacy — Best Books Guide"
        description="What Best Books Guide stores, what it doesn't, and how to have your data deleted. No ads, no analytics, no third-party trackers."
      />
      <Crumbs trail={[{ label: 'Home', to: '/' }, { label: 'Privacy' }]} />

      <div className="max-w-2xl">
        <p className="eyebrow">Last updated {LAST_UPDATED}</p>
        <h1 className="mt-2 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight">
          Privacy
        </h1>
        <p className="mt-4 text-lg text-muted">
          Reading is private. This site is built to need as little about you as possible: you can
          browse every list, book and series here without an account, and nothing you do while
          reading is tracked, profiled or sold.
        </p>

        <Section id="short-version" title="The short version">
          <Bullets
            items={[
              'No advertising, no third-party analytics, no tracking pixels, no social widgets. Your browser talks to this site and nothing else.',
              'Browsing anonymously stores nothing about you beyond a short-lived server log line.',
              'An account stores your email, your display name, and the reading activity you choose to record.',
              'Recommendations come from the curated catalogue — same author, co-listed, related subjects — never from watching what you read.',
              'You can have everything deleted by asking.',
            ]}
          />
        </Section>

        <Section id="reading" title="If you only read">
          <p>
            No account, no profile, nothing to opt out of. Pages are served the same to everyone,
            and the only record is the ordinary web-server log described under{' '}
            <a className="text-accent hover:underline" href="#logs">
              logs and backups
            </a>
            .
          </p>
        </Section>

        <Section id="account" title="If you have an account">
          <p>An account holds only what it takes to run one:</p>
          <Bullets
            items={[
              <>
                <strong className="text-ink">Your email address</strong> — to sign you in, verify
                the account, and let you reset a forgotten password.
              </>,
              <>
                <strong className="text-ink">Your display name</strong> — shown beside any review
                you publish. It doesn&rsquo;t have to be your real name.
              </>,
              <>
                <strong className="text-ink">Your password</strong> — stored only as an Argon2id
                hash. Nobody here can read it, including us.
              </>,
              <>
                <strong className="text-ink">Your reading activity</strong> — the shelf you put a
                book on (want to read, reading, finished) and any dates you add, your ratings and
                reviews, and the lists you track.
              </>,
            ]}
          />
          <p>
            Ratings and reviews are <strong className="text-ink">public</strong>, shown with your
            display name. Your shelves and tracked lists are{' '}
            <strong className="text-ink">not</strong> — they&rsquo;re yours, visible only to you
            when signed in. If you report a review, the report is visible to the site&rsquo;s
            moderator.
          </p>
        </Section>

        <Section id="cookies" title="Cookies and local storage">
          <p>
            There is one cookie, and it only exists once you sign in: a session cookie
            (&ldquo;bb_refresh&rdquo;) that keeps you signed in. It is HTTP-only, same-site,
            restricted to the sign-in endpoints, and expires after 30 days. Signing out deletes it.
          </p>
          <p>
            Your browser also keeps one flag in local storage — a yes/no marker meaning &ldquo;this
            device has signed in before&rdquo;, so the site knows whether to try restoring a
            session. It holds no personal data and no secret.
          </p>
          <p>
            That&rsquo;s the lot. No advertising or analytics cookies, and no consent banner —
            because there&rsquo;s nothing to consent to.
          </p>
        </Section>

        <Section id="logs" title="Logs and backups">
          <Bullets
            items={[
              'The web server keeps standard access logs — IP address, the page requested, timestamp, browser user-agent — for 14 days, then deletes them. They exist to debug faults and spot abuse.',
              'Application logs record events like a failed sign-in attempt, without passwords, tokens or email addresses in them.',
              'The database is backed up nightly to encrypted storage: daily copies kept 30 days, weekly copies 90 days. A deletion works its way out of the backups within 90 days.',
            ]}
          />
        </Section>

        <Section id="email" title="Email">
          <p>
            Email is only ever sent because you did something that needs it: verifying an address,
            resetting a password, or a note to an existing account when someone tries to register
            with its address. There is no newsletter and no marketing list, so there&rsquo;s nothing
            to unsubscribe from.
          </p>
        </Section>

        <Section id="third-parties" title="Who else is involved">
          <Bullets
            items={[
              'Amazon Web Services — hosting, in the London (eu-west-2) region, plus encrypted backup storage and the service that sends the emails above.',
              'Open Library — the source of book data and cover images. Covers are copied to this server when a book is added, so your browser never requests anything from them.',
              'An external uptime monitor pings the site every few minutes. It sees the site, not you.',
            ]}
          />
          <p>Nobody else. Your data is never sold, rented or shared for advertising.</p>
        </Section>

        <Section id="never" title="What this site will never do">
          <p>
            Some of this is settled policy rather than a current fact — it&rsquo;s written into the
            product&rsquo;s principles, not just its code: no ads, ever; no recommendations built
            from watching your behaviour; no engagement mechanics designed to keep you here rather
            than reading. If any of that changes, this page changes first.
          </p>
        </Section>

        <Section id="rights" title="Your data, your call">
          <p>
            If you&rsquo;re in the UK or EU, the law gives you the right to see what&rsquo;s held
            about you, correct it, or have it deleted; those rights are honoured here regardless of
            where you live.
          </p>
          <p>
            Email {email} and ask. Deleting an account removes your shelves, ratings, reviews and
            tracked lists along with it — reviews vanish rather than linger unattributed. Self-serve
            deletion and export are on the roadmap; until they ship, a request by email is the way,
            and it will be actioned within 30 days.
          </p>
        </Section>

        <Section id="changes" title="Changes to this page">
          <p>
            The date at the top says when this text last changed. Anything that materially affects
            what is stored will be reflected here before it takes effect, not after.
          </p>
        </Section>

        <Link className="mt-10 inline-block font-sans text-sm text-accent hover:underline" to="/">
          ← Back to browse
        </Link>
      </div>
    </PublicLayout>
  );
}
