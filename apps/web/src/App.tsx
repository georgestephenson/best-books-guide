import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { SubjectDetail } from '@bestbooks/shared';
import { catalogueKeys, fetchSubjects } from './features/catalogue/api.js';
import {
  ErrorBlock,
  JsonLd,
  LoadingBlock,
  PageMeta,
  PublicLayout,
} from './features/catalogue/components.js';
import { useAuth } from './features/auth/AuthContext.js';
import { fetchTrackedLists, memberKeys } from './features/member/api.js';
import { TrackedListCard } from './features/member/components.js';

/**
 * An interactive full-width hero: books in the placeholder-cover palette (components.tsx)
 * drop onto the shelf on load, bounce, and settle upright; the cursor shoves nearby spines
 * aside and an angular spring stands them back up. Canvas-drawn and aria-hidden — purely
 * decorative, never in the accessibility tree. Honours prefers-reduced-motion by drawing a
 * single static, upright frame with no animation or pointer interaction.
 */
function Bookshelf() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl; // non-null declared type for the closures below
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext('2d');
    } catch {
      context = null;
    }
    if (!context) return; // no 2d context (e.g. the test env) — leave the canvas blank
    const ctx = context;

    // Design tokens (index.css), with the same hard-coded fallbacks the CSS uses.
    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const shelfColor = token('--color-muted', '#5e6358');
    const inkColor = token('--color-ink', '#23261f');
    const spines = [
      token('--color-accent', '#1f5140'),
      token('--color-accent-soft', '#2f6b55'),
      token('--color-star', '#b08a3e'),
      token('--color-ink', '#23261f'),
      token('--color-muted', '#5e6358'),
    ];
    // Mostly greens & gold, an occasional dark spine — indexes into `spines`.
    const colorPattern = [0, 1, 2, 0, 1, 3, 0, 2, 1, 4, 0, 1, 2, 0, 3, 1];

    const reduce =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Deterministic PRNG so the shelf looks identical on every load (and SSR-stable).
    function makeRng(seed: number) {
      let s = seed >>> 0;
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
      };
    }

    type Book = {
      homeX: number; // pivot: centre of the spine's base on the shelf
      w: number;
      h: number;
      color: string;
      y: number; // current base y (falls from above to restY)
      restY: number;
      vy: number;
      landed: boolean;
      release: number; // seconds before this book is released to fall (staggered)
      angle: number; // lean from upright, radians
      angVel: number;
      band: number; // title-band height fraction, or -1 for none
      kick: 1 | -1; // impact-topple direction
    };

    let books: Book[] = [];
    let W = 0;
    let H = 0;
    let shelfY = 0;
    let lastW = -1;
    const shelfThickness = 7;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      shelfY = H - shelfThickness - 2;
    }

    // Fill the width with a row of varied spines (re-run when the width changes a lot).
    function buildBooks() {
      const rng = makeRng(0x9e3779b1);
      const availH = shelfY - 8;
      const next: Book[] = [];
      let x = 4;
      let i = 0;
      while (x < W - 6) {
        const w = 12 + Math.floor(rng() * 16); // 12..28
        if (x + w > W - 4) break;
        const h = Math.round(availH * (0.5 + rng() * 0.45));
        next.push({
          homeX: x + w / 2,
          w,
          h,
          color: spines[colorPattern[i % colorPattern.length]!] ?? spines[0]!,
          y: reduce ? shelfY : -h - rng() * H * 1.4,
          restY: shelfY,
          vy: 0,
          landed: reduce,
          release: reduce ? 0 : rng() * 0.85,
          angle: 0,
          angVel: 0,
          band: rng() < 0.5 ? 0.35 + rng() * 0.35 : -1,
          kick: rng() < 0.5 ? 1 : -1,
        });
        const gap = 1 + Math.floor(rng() * 3) + (rng() < 0.12 ? 6 : 0);
        x += w + gap;
        i += 1;
      }
      books = next;
    }

    // Cursor state, in canvas-local pixels.
    let mx = -1e6;
    let my = -1e6;
    let mvx = 0; // per-event horizontal travel, decayed each frame
    let hovering = false;

    function onMove(e: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const nx = e.clientX - rect.left;
      const ny = e.clientY - rect.top;
      mvx = hovering ? nx - mx : 0;
      mx = nx;
      my = ny;
      hovering = true;
    }
    function onLeave() {
      hovering = false;
      mx = -1e6;
      my = -1e6;
      mvx = 0;
    }

    // Physics constants.
    const G = 2600; // gravity, px/s²
    const REST = 0.36; // bounce restitution
    const K = 150; // angular stiffness (righting spring)
    const C = 7; // angular damping
    const MAXA = 0.62; // max lean, radians (~35°)
    const R = 105; // cursor influence radius, px

    function step(dt: number) {
      mvx *= 0.55; // a still cursor stops shoving
      for (const b of books) {
        if (!b.landed) {
          if (b.release > 0) {
            b.release -= dt;
          } else {
            b.vy += G * dt;
            b.y += b.vy * dt;
            if (b.y >= b.restY) {
              b.y = b.restY;
              if (b.vy > 60) {
                b.vy = -b.vy * REST; // bounce
                b.angVel += b.kick * 0.6; // topple a touch on impact
              } else {
                b.vy = 0;
                b.landed = true;
              }
            }
          }
        }

        // Angular spring back to upright…
        let torque = -K * b.angle - C * b.angVel;
        // …plus a shove away from the cursor, stronger up close and along its travel.
        if (hovering) {
          const dx = b.homeX - mx;
          const adx = Math.abs(dx);
          if (adx < R) {
            const topY = b.y - Math.cos(b.angle) * b.h;
            if (my > topY - 24 && my < b.y + 12) {
              const prox = 1 - adx / R;
              const dir = dx >= 0 ? 1 : -1;
              torque += dir * 44 * prox * prox; // lean away from the cursor
              torque += mvx * 1.4 * prox; // extra shove in the swipe direction
            }
          }
        }

        b.angVel += torque * dt;
        b.angVel = Math.max(-14, Math.min(14, b.angVel));
        b.angle += b.angVel * dt;
        if (b.angle > MAXA) {
          b.angle = MAXA;
          if (b.angVel > 0) b.angVel *= -0.3;
        } else if (b.angle < -MAXA) {
          b.angle = -MAXA;
          if (b.angVel < 0) b.angVel *= -0.3;
        }
      }
    }

    // Rounded rect via arcTo (roundRect isn't in every lib.dom we target).
    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      const rr = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    function drawBook(b: Book) {
      ctx.save();
      ctx.translate(b.homeX, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = b.color;
      roundRect(-b.w / 2, -b.h, b.w, b.h, 2);
      ctx.fill();
      // Inset highlight near the left edge — the placeholder cover's detail.
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-b.w / 2 + 2.5, -b.h + 4, 1.5, b.h - 8);
      if (b.band > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        const bw = Math.max(4, b.w - 8);
        roundRect(-bw / 2, -b.h * b.band, bw, 6, 1);
        ctx.fill();
      }
      ctx.restore();
    }

    function render() {
      ctx.clearRect(0, 0, W, H);
      // Shelf plank across the full width, with a soft shadow line beneath.
      ctx.fillStyle = shelfColor;
      roundRect(0, shelfY, W, shelfThickness, 2);
      ctx.fill();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = inkColor;
      ctx.fillRect(0, shelfY + shelfThickness, W, 2);
      ctx.globalAlpha = 1;
      for (const b of books) drawBook(b);
    }

    resize();
    buildBooks();
    lastW = W;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        resize();
        // Re-lay the row only on a real width change; otherwise just keep it crisp.
        if (Math.abs(W - lastW) > 24) {
          lastW = W;
          buildBooks();
        }
        if (reduce) render();
      });
      ro.observe(canvas);
    }

    if (reduce) {
      render();
      return () => ro?.disconnect();
    }

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);

    let raf = 0;
    let last = 0;
    function frame(t: number) {
      if (!last) last = t;
      let dt = (t - last) / 1000;
      last = t;
      if (dt > 0.05) dt = 0.05; // clamp long stalls (tab switches)
      step(dt / 2); // two sub-steps keep the spring stable
      step(dt / 2);
      render();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div className="mb-10 w-full" aria-hidden="true">
      <canvas
        ref={canvasRef}
        data-testid="bookshelf"
        className="block h-24 w-full sm:h-32"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}

/**
 * The home hero's top slot: returning members see the lists they track (with progress)
 * first (docs/01 F7); everyone else gets the decorative shelf so the page opens warmly.
 */
function HomeTopSlot() {
  const { status, user } = useAuth();
  const isAuthed = status === 'authenticated' && Boolean(user);
  const { data } = useQuery({
    queryKey: memberKeys.trackedLists,
    queryFn: fetchTrackedLists,
    enabled: isAuthed,
  });

  if (isAuthed) {
    // While the tracked lists are still loading, show nothing rather than flash the
    // shelf and swap it out a moment later.
    if (data === undefined) return null;
    if (data.length > 0) {
      return (
        <section className="mb-12 rounded-lg border border-line bg-panel p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="eyebrow">Lists you track</h2>
            <Link className="font-sans text-sm text-accent hover:underline" to="/my-books">
              My Books →
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {data.map((list) => (
              <TrackedListCard key={list.slug} list={list} />
            ))}
          </div>
        </section>
      );
    }
  }
  return <Bookshelf />;
}

function SubjectSection({ subject }: { subject: SubjectDetail }) {
  return (
    <section className="border-t border-line py-9 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          <Link className="text-ink hover:text-accent" to={`/subjects/${subject.slug}`}>
            {subject.name}
          </Link>
        </h2>
        <span className="eyebrow whitespace-nowrap">
          {subject.lists.length} {subject.lists.length === 1 ? 'list' : 'lists'}
        </span>
      </div>
      {subject.description ? (
        <p className="mt-2 max-w-2xl text-muted">{subject.description}</p>
      ) : null}
      <ul className="mt-5 grid gap-3">
        {subject.lists.map((list) => (
          <li key={list.slug}>
            <Link
              className="group flex items-baseline gap-3 rounded-md border border-line bg-panel px-4 py-3 transition-colors hover:border-accent"
              to={`/lists/${list.slug}`}
            >
              <span className="font-serif text-lg font-semibold text-ink group-hover:text-accent">
                {list.title}
              </span>
              <span className="font-sans text-xs text-faint">{list.itemCount} books</span>
              {list.intro ? (
                <span className="ml-auto hidden max-w-sm truncate font-sans text-sm text-muted sm:block">
                  {list.intro}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Home: the browse entry point — subjects and their curated lists (docs/04 GET /subjects). */
export function App() {
  const { data, status, error } = useQuery({
    queryKey: catalogueKeys.subjects,
    queryFn: fetchSubjects,
  });

  return (
    <PublicLayout>
      <PageMeta
        title="Best Books Guide — the best books by subject"
        description="A curated, opinionated guide to the best books by subject. An editor picks, ranks, and says why — so you can decide what to read next."
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Best Books Guide',
          description: 'The best books by subject — curated, ranked, and argued.',
        }}
      />

      <HomeTopSlot />

      <header className="max-w-2xl">
        <p className="eyebrow">Curated by subject</p>
        <h1 className="mt-2 text-balance font-serif text-4xl font-semibold leading-tight tracking-tight">
          What should you read next?
        </h1>
        <p className="mt-4 text-lg text-muted">
          Most book sites rank by popularity. This one is deliberately curated — each subject
          stripped to the highest-quality, most authoritative books, ranked, with a note on why each
          one earns its place.
        </p>
      </header>

      <div className="mt-12">
        {status === 'pending' ? (
          <LoadingBlock label="Loading subjects…" />
        ) : status === 'error' ? (
          <ErrorBlock error={error} kind="page" />
        ) : data.length === 0 ? (
          <p className="max-w-xl text-muted">
            The first curated lists are being written. Check back soon.
          </p>
        ) : (
          data.map((subject) => <SubjectSection key={subject.slug} subject={subject} />)
        )}
      </div>
    </PublicLayout>
  );
}
