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
 * aside — lean a book past its balance point and it topples off the shelf and tumbles down
 * the page. The canvas is a fixed, pointer-events-none overlay covering the whole viewport
 * (an in-flow placeholder reserves the shelf's spot), so falling books stay visible until
 * they clear the bottom of the screen instead of clipping at a strip edge. Aria-hidden and
 * purely decorative; honours prefers-reduced-motion by drawing a single static, upright
 * frame with no animation or pointer interaction.
 */
function Bookshelf() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const frameEl = frameRef.current;
    if (!canvasEl || !frameEl) return;
    const canvas: HTMLCanvasElement = canvasEl; // non-null declared types for the closures below
    const shelfFrame: HTMLDivElement = frameEl;
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
      // Layout / art
      homeX: number; // pivot: centre of the spine's base on the shelf
      w: number;
      h: number;
      color: string;
      band: number; // title-band height fraction, or -1 for none
      // 'stand' = hinged on the shelf; 'fall' = detached, tumbling down the page.
      mode: 'stand' | 'fall';
      tipAngle: number; // lean past which gravity tips it over instead of righting it
      kick: 1 | -1; // impact-topple direction on landing
      // Standing (drop-in + hinge) state
      y: number; // base y (falls from above to the shelf, then pinned to it)
      vy: number;
      landed: boolean;
      release: number; // seconds before this book is released to fall (staggered)
      angle: number; // lean/rotation, radians
      angVel: number;
      // Free-fall state (once toppled off the shelf)
      cx: number; // centre-of-mass position
      cy: number;
      fvx: number; // centre-of-mass velocity
      fvy: number;
    };

    let books: Book[] = [];
    let W = 0; // viewport size — the canvas overlay covers the whole visible page
    let H = 0;
    let ox = 0; // shelf strip's left edge / width / plank top, in viewport coords —
    let shelfW = 0; // re-read from the in-flow placeholder every frame so scrolling
    let shelfY = 0; // and layout shifts keep the shelf glued to its spot on the page
    let shelfH = 0;
    let lastW = -1;
    const shelfThickness = 7;

    function resize() {
      W = Math.max(1, window.innerWidth);
      H = Math.max(1, window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function syncShelf() {
      const rect = shelfFrame.getBoundingClientRect();
      ox = rect.left;
      shelfW = Math.max(1, Math.round(rect.width));
      shelfH = Math.max(1, Math.round(rect.height));
      shelfY = rect.bottom - shelfThickness - 2;
      // Standing books ride the shelf as it moves (scroll / layout shifts).
      for (const b of books) if (b.landed && b.mode === 'stand') b.y = shelfY;
    }

    // Fill the shelf strip with a row of varied spines (re-run when its width changes a lot).
    function buildBooks() {
      const rng = makeRng(0x9e3779b1);
      const availH = shelfH - shelfThickness - 10;
      const next: Book[] = [];
      let x = 4;
      let i = 0;
      while (x < shelfW - 6) {
        const w = 12 + Math.floor(rng() * 16); // 12..28
        if (x + w > shelfW - 4) break;
        const h = Math.round(availH * (0.5 + rng() * 0.45));
        next.push({
          homeX: x + w / 2,
          w,
          h,
          color: spines[colorPattern[i % colorPattern.length]!] ?? spines[0]!,
          band: rng() < 0.5 ? 0.35 + rng() * 0.35 : -1,
          mode: 'stand',
          // A thin, tall book tips from a smaller lean than a squat one (base/height),
          // eased a little so a settling wobble never topples on its own.
          tipAngle: Math.atan(w / 2 / h) * 2.1,
          kick: rng() < 0.5 ? 1 : -1,
          y: reduce ? shelfY : -h - rng() * H * 0.9,
          vy: 0,
          landed: reduce,
          release: reduce ? 0 : rng() * 0.85,
          angle: 0,
          angVel: 0,
          cx: 0,
          cy: 0,
          fvx: 0,
          fvy: 0,
        });
        const gap = 1 + Math.floor(rng() * 3) + (rng() < 0.12 ? 6 : 0);
        x += w + gap;
        i += 1;
      }
      books = next;
    }

    // Cursor state, in viewport pixels — tracked on window, since the overlay canvas is
    // pointer-events-none (it must never block clicks on the page beneath it).
    let mx = -1e6;
    let my = -1e6;
    let mvx = 0; // per-event horizontal travel, decayed each frame
    let hovering = false;
    let pBoost = 1; // fingers shove harder than the mouse — they only exist mid-swipe,
    // so they never accumulate the sustained proximity push a hover does

    function onMove(e: PointerEvent) {
      mvx = hovering ? e.clientX - mx : 0;
      mx = e.clientX;
      my = e.clientY;
      hovering = true;
      pBoost = e.pointerType === 'mouse' ? 1 : 2.6;
    }
    function onLeave() {
      hovering = false;
      mx = -1e6;
      my = -1e6;
      mvx = 0;
    }
    function onDown(e: PointerEvent) {
      // A new touch starts wherever it lands — never a teleport-delta from the last one.
      mx = e.clientX;
      my = e.clientY;
      mvx = 0;
      hovering = true;
      pBoost = e.pointerType === 'mouse' ? 1 : 2.6;
    }
    function onUp(e: PointerEvent) {
      // A lifted finger is gone; only a mouse keeps hovering between events.
      if (e.pointerType !== 'mouse') onLeave();
    }

    // Physics constants.
    const G = 2600; // gravity, px/s²
    const REST = 0.34; // landing-bounce restitution
    const K = 90; // hinge stiffness inside the stable base (righting spring)
    const C = 6; // hinge damping
    const TOPPLE = 34; // gravity torque once tipped past the base — pulls it over
    const DETACH = 1.2; // lean (rad, ~69°) at which the book leaves the shelf and free-falls
    const SHOVE = 46; // cursor push strength
    const R = 108; // cursor influence radius, px

    // Respawn variety — runtime only, so plain Math.random is fine here.
    function resetToShelf(b: Book) {
      b.mode = 'stand';
      b.landed = false;
      b.vy = 0;
      b.y = -b.h - Math.random() * H * 0.6;
      b.release = 0.15 + Math.random() * 0.6;
      b.angle = 0;
      b.angVel = 0;
    }

    function step(dt: number) {
      mvx *= 0.55; // a still cursor stops shoving
      for (const b of books) {
        if (b.mode === 'fall') {
          // Free rigid body: gravity, drift, spin — until it clears the bottom edge.
          b.fvy += G * dt;
          b.cx += b.fvx * dt;
          b.cy += b.fvy * dt;
          b.fvx *= 0.999;
          b.angle += b.angVel * dt;
          // Gone once it clears the bottom of the viewport — the whole visible page.
          if (b.cy - b.h > H + 24) resetToShelf(b);
          continue;
        }

        // Drop-in with a bounce, then pin the base to the shelf.
        if (!b.landed) {
          if (b.release > 0) {
            b.release -= dt;
          } else {
            b.vy += G * dt;
            b.y += b.vy * dt;
            if (b.y >= shelfY) {
              b.y = shelfY;
              if (b.vy > 60) {
                b.vy = -b.vy * REST; // bounce
                b.angVel += b.kick * 0.35; // a touch of wobble on impact
              } else {
                b.vy = 0;
                b.landed = true;
              }
            }
          }
        }

        // Hinge dynamics: inside the base it rights itself; past the tip angle gravity
        // takes over and topples it — an inverted pendulum losing its balance.
        let torque: number;
        if (Math.abs(b.angle) < b.tipAngle || !b.landed) {
          torque = -K * b.angle - C * b.angVel;
        } else {
          torque = Math.sign(b.angle) * TOPPLE * Math.sin(b.angle) - 0.4 * b.angVel;
        }

        // Cursor shove: lean away, stronger up close and along the swipe direction.
        if (hovering) {
          const dx = ox + b.homeX - mx;
          const adx = Math.abs(dx);
          if (adx < R) {
            const topY = b.y - Math.cos(b.angle) * b.h;
            if (my > topY - 26 && my < b.y + 12) {
              const prox = 1 - adx / R;
              const dir = dx >= 0 ? 1 : -1;
              torque += dir * SHOVE * pBoost * prox * prox;
              torque += mvx * 1.5 * pBoost * prox;
            }
          }
        }

        b.angVel += torque * dt;
        b.angVel = Math.max(-16, Math.min(16, b.angVel));
        b.angle += b.angVel * dt;

        // Past the point of no return: hand the base off to free-fall. Seed the fall
        // with the centre-of-mass velocity from its rotation about the base pivot.
        if (b.landed && Math.abs(b.angle) > DETACH) {
          const s = Math.sin(b.angle);
          const c = Math.cos(b.angle);
          const L = b.h / 2;
          b.cx = ox + b.homeX + s * L;
          b.cy = shelfY - c * L;
          b.fvx = b.angVel * c * L + Math.sign(b.angle) * 24;
          b.fvy = b.angVel * s * L;
          b.mode = 'fall';
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
      // Standing books pivot on their base (rect spans -h..0); falling books tumble
      // about their centre (rect spans -h/2..h/2).
      const top = b.mode === 'fall' ? -b.h / 2 : -b.h;
      if (b.mode === 'fall') ctx.translate(b.cx, b.cy);
      else ctx.translate(ox + b.homeX, b.y);
      ctx.rotate(b.angle);
      ctx.fillStyle = b.color;
      roundRect(-b.w / 2, top, b.w, b.h, 2);
      ctx.fill();
      // Inset highlight near the left edge — the placeholder cover's detail.
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-b.w / 2 + 2.5, top + 4, 1.5, b.h - 8);
      if (b.band > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        const bw = Math.max(4, b.w - 8);
        roundRect(-bw / 2, top + b.h * (1 - b.band), bw, 6, 1);
        ctx.fill();
      }
      ctx.restore();
    }

    function render() {
      ctx.clearRect(0, 0, W, H);
      // Shelf plank across the strip, with a soft shadow line beneath.
      ctx.fillStyle = shelfColor;
      roundRect(ox, shelfY, shelfW, shelfThickness, 2);
      ctx.fill();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = inkColor;
      ctx.fillRect(ox, shelfY + shelfThickness, shelfW, 2);
      ctx.globalAlpha = 1;
      for (const b of books) drawBook(b);
    }

    resize();
    syncShelf();
    buildBooks();
    lastW = shelfW;

    window.addEventListener('resize', resize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        syncShelf();
        // Re-lay the row only on a real width change; otherwise just keep it crisp.
        if (Math.abs(shelfW - lastW) > 24) {
          lastW = shelfW;
          buildBooks();
        }
        if (reduce) render();
      });
      ro.observe(shelfFrame);
    }

    if (reduce) {
      // No animation loop: draw once, and redraw on scroll/resize so the static shelf
      // stays glued to its spot on the page under the fixed overlay.
      const redraw = () => {
        syncShelf();
        render();
      };
      redraw();
      window.addEventListener('scroll', redraw, { passive: true });
      return () => {
        window.removeEventListener('scroll', redraw);
        window.removeEventListener('resize', resize);
        ro?.disconnect();
      };
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);

    let raf = 0;
    let last = 0;
    function frame(t: number) {
      if (!last) last = t;
      let dt = (t - last) / 1000;
      last = t;
      if (dt > 0.05) dt = 0.05; // clamp long stalls (tab switches)
      syncShelf(); // track scroll / layout shifts before physics
      step(dt / 2); // two sub-steps keep the spring stable
      step(dt / 2);
      render();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  // The in-flow div reserves the shelf's spot in the layout; the canvas is a fixed
  // overlay across the whole viewport so toppled books stay visible all the way down
  // the page. pointer-events-none keeps every link and button beneath it clickable.
  // touch-action: none on the strip lets a swipe over the shelf drive the books rather
  // than being claimed for scrolling (the rest of the page scrolls as normal).
  return (
    <div
      ref={frameRef}
      className="mb-6 h-40 w-full sm:h-44"
      style={{ touchAction: 'none' }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        data-testid="bookshelf"
        className="pointer-events-none fixed inset-0 z-10 h-full w-full"
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
