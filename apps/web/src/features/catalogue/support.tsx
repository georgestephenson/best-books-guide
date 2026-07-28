import { Link } from 'react-router';
import kofiCup from '../../assets/kofi-cup.png';

/**
 * Ko-fi's own `Widget_2.js` button, rebuilt natively. The script version can't be used
 * here for two independent reasons: `kofiwidget2.draw()` calls `document.writeln`, which
 * blanks the document when it runs after a SPA has mounted, and it pulls a script, an
 * image, and a Google Fonts stylesheet from three third-party origins that
 * `script-src 'self'` blocks — the structural no-trackers guarantee behind
 * [01](docs/01-product.md) Principle 4.
 *
 * What the widget actually emits is an `<a>` with a cup icon and a background colour, so
 * this is the same button: Ko-fi's logo (self-hosted from src/assets, inlined by Vite
 * under the 4 KB asset limit) and Ko-fi's wording, in the site's own typeface and palette.
 * No CSP exception, no third-party request, same destination.
 */
export const KOFI_URL = 'https://ko-fi.com/gfste';

/**
 * Ko-fi's stock button is brand blue (`#72a4f2`). It reads as a pasted-in advert against
 * the reading-room palette, so the button wears the site's accent green and lets the
 * orange-and-charcoal cup do the brand recognition. Swap this one class for
 * `bg-[#72a4f2] hover:bg-[#5f95ef]` to get the stock look back.
 */
const KOFI_COLOR = 'bg-accent hover:bg-accent-soft';

/** The donate call-to-action. `lg` is the Support page's; `md` closes a list page. */
export function KofiButton({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <a
      className={`inline-flex items-center gap-2.5 rounded-lg ${KOFI_COLOR} font-sans font-semibold text-panel shadow-sm transition-colors ${
        size === 'lg' ? 'px-6 py-3.5 text-base' : 'px-5 py-3 text-sm'
      }`}
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      <img
        className={size === 'lg' ? 'h-6 w-7' : 'h-5 w-6'}
        src={kofiCup}
        alt=""
        aria-hidden="true"
      />
      Support me on Ko-fi
    </a>
  );
}

/**
 * The one in-page donation prompt, at the foot of a list the reader has just finished —
 * the moment the site has actually delivered something. It stays a static block below
 * the content it's asking about: no floating overlay, no modal, no dismiss state to
 * remember (docs/01 Principle 3 — engagement only in service of the reader).
 */
export function SupportAsk() {
  return (
    <aside className="mt-12 max-w-3xl border-t border-line pt-6">
      <p className="font-sans text-sm text-muted">
        This list is free to read, with no ads and no trackers on the page. If it helped you choose,
        you can put something in the tip jar.
      </p>
      <div className="mt-4">
        <KofiButton />
      </div>
      <p className="mt-3 font-sans text-xs text-faint">
        <Link className="text-accent hover:underline" to="/support">
          Why this site is reader-supported →
        </Link>
      </p>
    </aside>
  );
}
