# ADR-0009 — A grace window for refresh-token reuse detection

_Status: Accepted · 2026-07-18_

## Context

[ADR-0005](0005-jwt-refresh-rotation.md) rotates the opaque refresh token on every use and treats any token presented twice as theft, revoking the whole session. [05 — Security](../05-security.md) even names the cause explicitly: "a refresh token presented twice means it was stolen **or the client double-fired**."

That second cause is common and benign in a real SPA:

- **Boot-time restore.** The app refreshes on every page load to restore the session ([01 — Product](../01-product.md) F2), so a fast reload or a Cmd-click that opens two tabs fires two refreshes against the same cookie.
- **React StrictMode.** In dev, effects mount twice, firing two refreshes before any client-side guard is in place.
- **Racing tabs.** Two tabs sharing the one refresh cookie can refresh within milliseconds of each other.

Under strict "any reuse = revoke", every one of these logs a legitimate user out. The spec says to revoke; following it literally makes the product feel broken.

## Decision

Add a **10-second grace window** to reuse detection, plus **single-flight refresh in the web client**.

Each session stores the current token hash, the immediately-previous hash (`prevTokenHash`), and the time of the last rotation (`rotatedAt`). On refresh:

- presented hash == **current** → normal rotation.
- presented hash == **previous** AND `now − rotatedAt ≤ 10s` → benign double-fire: re-rotate and keep the session alive (the chain advances; all racing callers stay valid within the window).
- anything else → reuse ⇒ theft: revoke the session, return **409**, force a full re-login.

The web client wraps refresh in a module-level single-flight promise so concurrent callers in one tab share one request — the grace window only has to absorb genuine cross-context races (boot, StrictMode, multi-tab).

## Consequences

- Legitimate double-fires no longer nuke sessions; a real stolen token replayed later (seconds+ after rotation) is still caught and revokes the family. The security property [ADR-0005] wanted holds outside a 10-second window.
- Sessions carry two extra fields (`prevTokenHash`, `rotatedAt`); the documented Redis `sess:{sid}` hash is updated to match ([03 — Data model](../03-data-model.md)).
- This is a deliberate, documented deviation from [05 — Security](../05-security.md) as originally written — that doc is amended to describe the grace window rather than unconditional revocation.
- Long-lived independent multi-tab (tabs refreshing on separate 15-minute timers, far apart) is not fully covered by a 10-second window and can still force a re-login in the rare case; accepted at this scale, and the single-flight client makes it rarer still. Revisit only if it shows up in practice.
