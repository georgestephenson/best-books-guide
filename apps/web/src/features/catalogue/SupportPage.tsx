import { Link } from 'react-router';
import { JsonLd, PageMeta, PublicLayout } from './components.js';
import { KofiButton } from './support.js';

/**
 * The one place on the site that asks for money (docs/01 Principle 4: reader-supported,
 * never ad-supported). Ko-fi is the platform — Patreon stays parked until there's
 * member-exclusive content to sell, which there deliberately isn't. The page argues the
 * case rather than asserting the ask, the same standard the lists are held to
 * (Principle 2); the in-page prompts that lead here are `SupportAsk` (support.tsx) and
 * the footer's "reader-supported".
 */
export function SupportPage() {
  return (
    <PublicLayout>
      <PageMeta
        title="Support Best Books Guide"
        description="Best Books Guide is free to read, ad-free, and carries no third-party trackers. It's paid for by the readers who find it useful."
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Support Best Books Guide',
          description: 'Why this site is reader-supported, and how to chip in.',
        }}
      />

      <div className="max-w-2xl">
        <header>
          <p className="eyebrow">Reader-supported</p>
          <h1 className="mt-2 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight">
            No ads. No trackers. No paywall.
          </h1>
          <p className="dropcap mt-6 text-ink">
            Most book sites make their money by selling your attention — ranking by popularity,
            following you around the web, and wrapping the whole thing in advertising. This one
            never will. Every list here is free to read, there are no third-party trackers on any
            page, and nothing is held back behind a subscription.
          </p>
          <p className="mt-4 text-muted">
            That only works if the people who find it useful pay for it. If a list here saved you
            from a bad book, or pointed you at a good one, you can chip in — once, or monthly.
            There&rsquo;s no members-only tier and nothing to unlock. The site stays exactly the
            same either way.
          </p>
        </header>

        <div className="mt-8 rounded-lg border border-line bg-panel p-6">
          <KofiButton size="lg" />
          <p className="mt-3 font-sans text-sm text-faint">
            Opens ko-fi.com. Any amount, one-off or monthly — no account needed to give.
          </p>
        </div>

        <section className="mt-12 border-t border-line pt-8">
          <h2 className="eyebrow">Where it goes</h2>
          <ul className="mt-4 grid gap-3 text-muted">
            <li>
              <strong className="font-serif text-ink">Running the site.</strong> The server, the
              domain, and the off-site backups — the whole thing runs on one small machine, which is
              why the pages load quickly and the bill stays small.
            </li>
            <li>
              <strong className="font-serif text-ink">Reading the books.</strong> A ranked list is
              only worth reading if someone actually read the candidates. Buying them is the largest
              cost here, and the one that decides how fast new subjects arrive.
            </li>
            <li>
              <strong className="font-serif text-ink">The time to write it up.</strong> Every entry
              carries a note on why it earns its place, and every list opens with the criteria it
              was picked against. That research is the product.
            </li>
          </ul>
        </section>

        <p className="mt-10 font-sans text-sm text-muted">
          Not in a position to give? Genuinely, that&rsquo;s fine — the most useful thing you can do
          is send a list to someone who needs it.
        </p>

        <Link className="mt-6 inline-block font-sans text-sm text-accent hover:underline" to="/">
          ← Back to browse
        </Link>
      </div>
    </PublicLayout>
  );
}
