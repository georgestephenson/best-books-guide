# 01 — Product

_Last updated: 2026-07-11 · Status: Accepted_

## Vision

**Best Books Guide answers "what should I read next in X?" with an opinion.**

Most book sites rank by popularity or algorithm. Best Books Guide is deliberately *curated*: it strips each subject down to the highest-quality, most authoritative books — an editor picks, ranks, and says why — cancelling the noise so readers use their time well (see the README pitch). Members use it to decide what to read, track their reading, and record what they thought.

The tone of the product: a knowledgeable friend's bookshelf, not an infinite feed.

## Product principles — calm by design

The README's motivation — *cancel the noise, use your time efficiently, stay sane* — is a design constraint, not marketing copy. Concretely:

1. **A list is a destination, not a feed.** It's short (aim for 10–15 items), ranked, argued, and it *ends*. Series and sublists are the tools that keep it short: a seven-book saga occupies one slot, and a sprawling subject splits into sublists — each its own short list, with the parent as the map.
2. **Authority is argued, not asserted.** Every list opens with its selection criteria (the intro); every item carries the editor's *why* (the blurb). Community ratings inform readers — they never reorder an editor's list.
3. **Engagement only in service of the reader.** No infinite scroll, no retention-loop mechanics, no nagging by default. Notifications, digests, badges, or streaks are permissible when **opt-in, quiet, and done well** — they celebrate the member's own journey, never manufacture anxiety about it. Recommendations exist and stay **inside the catalogue**: same author, shared lists, curation-graph similarity — computed from what editors curated, never from tracking readers.
4. **Respect the reader's attention and privacy.** Fast, quiet pages; no third-party trackers — the CSP makes this structural ([05 — Security](05-security.md)). If analytics ever arrive, they'll be cookie-less and self-hosted. **Reader-supported, not ad-supported**: a quiet donate link, never ads.
5. **The noise test.** Every proposed feature must answer: *does this help someone choose their next book, or keep their reading record?* If neither, it's noise — see the philosophy-gated list under Non-goals below.

## Personas

| Persona | Who they are | What they need |
|---|---|---|
| **Visitor** | Arrived from a link or search, not logged in | Browse subjects, lists, and book pages freely; fast pages; no signup wall |
| **Member** | Created an account | Shelve books (want to read / reading / finished), rate 1–5 stars, write reviews, track lists and watch their own progress against them |
| **Admin (editor)** | Site owner, later possibly other editors | Import books from Open Library, maintain the catalogue, create and rank lists, moderate reported reviews |

Roles are exactly two: `member` and `admin`. No finer-grained permissions until a real need appears.

## MVP feature set

Decided 2026-07-11 (interview):

### F1 — Public catalogue (visitor)
- Browse **subjects** (e.g. History, Science Fiction, Economics), each with one or more curated **lists**.
- A **list** is an ordered, ranked set of items, each with an editor's blurb explaining *why it's here*.
  - An item is a **book or a series**: "Harry Potter" takes one ranked slot next to *Moby Dick*, and the site groups the series' books under it (a **series page** shows them in reading order).
  - A list can hold **sublists** — e.g. *Programming* under *Computer Science* — one level deep, each with its own intro, blurb-on-parent, slug, and page; the parent list renders as a map of its sublists.
- A **book page** shows metadata (title, authors, year, pages, description, cover), its series (if any), which lists it appears on, aggregate rating, public reviews — and a short **related books** strip: same author and co-listed titles in MVP, curation-graph similarity later (see Non-goals).
- Clean, human-readable URLs: `/subjects/history`, `/lists/best-history-books`, `/books/the-making-of-the-atomic-bomb`, `/series/harry-potter`.
- No login required for any public page.
- Member actions (shelve, rate, review) stay **book-level** in MVP: a series is a curation device, not a reviewable unit.

### F2 — Accounts & auth (member)
- Register with email + password; verification email (via SES) required before rating/reviewing.
- Login / logout, session persistence across page reloads, password reset by email.
- Minimal profile: display name, email. No public profile pages in MVP.

### F3 — Reading status ("shelves")
- One status per member per book: `want_to_read` | `reading` | `finished`.
- Optional started/finished dates; finished date defaults to when marked.
- "My books" page grouped by status; the finished shelf sorted by date doubles as the member's reading log — the "reading journey" the README promises, kept for the member, not for engagement.

### F4 — Star ratings
- One 1–5 star rating per member per book; changeable any time.
- Book pages show average (1 decimal) + count. Aggregates update immediately.

### F5 — Written reviews
- A review = required star rating + optional text (limit 5,000 chars).
- One review per member per book; editable; deletable by author.
- Any member can **report** a review; admin sees a report queue and can **hide** a review (soft delete, reason recorded).
- **Automated language screening** on submission: a maintained profanity matcher checks the text. Severe terms → auto-hide immediately *plus* a system-filed report so a human confirms; milder hits → publish but auto-report into the same queue. Machines flag, humans decide — false positives (the Scunthorpe problem) must never silently eat a review. LLM-assisted moderation is the backlog upgrade.

### F6 — Admin & curation
- Search Open Library from the admin UI; import a book (metadata + cover) in one click; dedupe on Open Library work key / ISBN.
- Edit any imported field (the site's voice may differ from OL's data); manual book creation as fallback.
- CRUD subjects and lists; drag-to-rank list items; per-item editor blurb; publish/unpublish lists; assign a list's parent to nest it as a sublist (one level, same subject).
- Create **series** (title, slug, description) and attach/order their books manually — Open Library's series data is too patchy to import reliably.
- Moderation queue for reported reviews (member reports and automated language-screen reports land in the same place).
- First admin is promoted via a documented CLI/SQL runbook — no admin signup path.

### F7 — Track a list
- A member can **track** any published list from its page; tracked lists appear on their logged-in home (and My Books) with progress against the list: *0% read* at first, then e.g. *20% read · 10% reading*.
- Progress derives from the member's own shelves (F3) against the list's books — a series item expands to its books; a parent list rolls up its sublists. Nothing is stored beyond the subscription itself ([03 — Data model](03-data-model.md) §tracked_lists).
- Calm by construction (Principle 3): no notifications, no nudges, no streak-guilt — the number moves only when the member shelves something. Tracking is private; untrack any time.

## Non-goals

**Deferred** (backlog, rough priority — good ideas, just not yet):

1. Server-side rendering / SEO hardening (SPA ships first, built SSR-ready — [ADR-0008](adr/0008-spa-first-ssr-ready.md))
2. Cross-list **similarity** for the related-books strip — computed from the curation graph (shared subjects, co-listing patterns), never from reader tracking; MVP ships same-author + co-listed
3. Page/percent reading progress
4. **Opt-in notifications & email digests** — thoughtful and minimalist or not at all (Principle 3 sets the bar)
5. **Quiet gamification** — badges/streaks that celebrate the member's own journey; no leaderboards, no anxiety mechanics (same bar)
6. Better search — still "find a known book fast", not discovery (PG full-text before any search engine)
7. Account self-deletion & data export (schema cascades from day one; the button ships post-MVP)
8. LLM-assisted review moderation (upgrade of F5's wordlist screening)
9. Community suggestions ("propose a book for this list" — feeds curation; the editor still decides)
10. Public member profiles (a shareable shelf page — only if members ask for it)
11. Patreon-style memberships (the basic donate link ships at launch — Principle 4)
12. Native/mobile apps

**Philosophy-gated** (fails the noise test — *not planned*; shipping any of these means rewriting the Principles above first, then an ADR):

- Following/followers, activity feeds
- Comments on reviews (reviews talk about the book, not to each other)
- Recommendations driven by reader tracking or behavioural profiles (in-catalogue, curation-based recommendations are allowed — Principle 3)
- Ads and third-party trackers

Anything not listed above and not in F1–F7 is out of scope until the backlog says otherwise.

## Representative user stories (acceptance-level)

- *Visitor*: from landing, I can reach a confident "this is my next book" in a couple of minutes — the core time-efficiency promise; nothing on the path competes for my attention.
- *Visitor*: I can open `/lists/best-history-books` and see the ranked books with blurbs, covers, and ratings — first meaningful paint fast enough that I don't leave (<2s on decent 4G).
- *Member*: From a book page I can set "Reading" in one click; it appears on My Books immediately; on my next visit it's still there.
- *Member*: I can rate a book without writing text; if I write a review, it appears on the book page with my display name and updates the average.
- *Member*: If I forget my password I can reset it via email within 2 minutes.
- *Member*: I can report a review; it stays visible until an admin acts.
- *Admin*: I can search "Gödel, Escher, Bach" against Open Library, import it with cover in one action, fix its description, and add it to a list at rank 3 with a blurb.
- *Admin*: I can create the "Harry Potter" series, attach its seven books in order, and place the series as a single ranked item on a list; visitors see one entry that opens the series page.
- *Visitor*: on a book page I see a short "related" strip (same author, same lists) that keeps me inside the curated catalogue — no "readers also bought" noise.
- *Member*: I track *Best History Books*; my home shows it move from 0% to *20% read · 10% reading* as I finish and start its books — and it never emails or nags me about it.
- *Admin*: I can hide a reported review with a reason; the author sees "hidden by moderator" in their own view of it.

## Launch definition

MVP is launched when: 10+ subjects with at least one published list each (~100+ books), all F1–F7 flows work on production, SES is out of sandbox, backups are tested, and the [08 — Delivery plan](08-delivery-plan.md) M5 checklist is green.

## Content plan

Seeding is editorial work, not engineering: aim for 8–12 subjects at launch, each list holding ~10–15 books — short lists are the product (Principle 1), so the discipline is leaving books *out*. Editor blurbs and list intros are the differentiator — budget real time for writing them.
