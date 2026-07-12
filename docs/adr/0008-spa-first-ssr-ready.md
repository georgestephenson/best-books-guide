# ADR-0008 — SPA first, built SSR-ready

_Status: Accepted · 2026-07-11 (interview decision)_

## Context
A content site's public pages benefit from SEO, which favours server rendering. But SSR from day one adds a rendering server, hydration concerns, and framework-mode buy-in before there is any content to rank. Interview decision: ship a client-rendered SPA, on the condition that later SEO optimisation is cheap.

## Decision
React 19 + Vite 7 SPA now, with the SSR seams built in from the start:
- React Router 7 in data mode — its framework mode **is** the SSR upgrade, keeping route structure unchanged;
- All data via the REST API (no client-only data paths an SSR server couldn't reuse);
- Stable slug URLs + canonical tags; React 19 native `<title>`/`<meta>` per route; JSON-LD on book/list pages;
- `sitemap.xml`/`robots.txt` generated server-side by the API from day one.

## Consequences
- Ships weeks earlier; Google does render JS (interim SEO is adequate); other crawlers less so — accepted for launch.
- The upgrade is contained: enable RR7 framework mode with SSR, run its Node server behind Nginx on the same host, components and API untouched. Prerendering public pages at build time is the even-cheaper fallback.
- **Revisit trigger**: organic search becomes a real acquisition goal, or link previews/crawlers demonstrably fail on shared pages.
