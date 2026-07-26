# ADR-0011 — Transactional email delivery is best-effort

_Status: Accepted · 2026-07-26_

## Context

Three use-cases send mail: `RegisterUser` (verification, plus the existing-account notice), `RequestPasswordReset`, and `ResendVerification`. Each awaited `EmailSender.send()` with nothing catching a transport failure, so an SDK error propagated out of the use-case and `problemFromError` mapped it to a **500**.

In `RegisterUser` that is worse than a failed send. The order of operations is: create the user row (committed), issue the one-time token, then send. A send failure therefore returns 500 to a caller whose account *already exists*. Retrying hits `ConflictError`, whose handler sends the existing-account notice — which fails the same way, throwing from inside the `catch`. The address is then permanently unable to complete registration.

This was not hypothetical. Production runs `EMAIL_TRANSPORT=ses` and the SES account is still in the sandbox — a production-access request was submitted 2026-07-21 and denied (case `178466565800037`). In the sandbox SES rejects any recipient that is not a verified identity, so **every** signup with a real address hit this path. Live signup on `bestbooks.guide` was broken; only the near-total absence of traffic hid it.

The sandbox merely made a latent bug fire every time. Throttling, a transient SES outage, or a bounced-address rejection all produce the same wedge in production with access granted.

## Decision

**A transactional email failure never fails the request that triggered it.**

This is applied as a `BestEffortEmailSender` decorator wrapping the configured transport at the composition root, not as a `try`/`catch` in each use-case:

- All three call sites want identical behaviour, and the port is already `send(): Promise<void>` — fire-and-forget in shape.
- All three routes return a response that is uniform whether or not the account exists ([05 — Security](../05-security.md), enumeration safety), so none of them *can* usefully report a delivery failure to the caller.
- One place to change when delivery policy grows a retry or an outbox.

The decorator wraps the injected transport too, so tests and production share one policy. Failures are logged with the recipient, subject, and error only — **never the message body**, which carries a live verification or password-reset token.

## Consequences

- Signup, password reset, and resend all succeed under a broken transport. The account remains usable: sign-in does not require a verified email, so a member whose verification mail never arrived can still log in and request a resend.
- **A failed send is now silent to the user.** They are told to check an inbox that will never receive anything. This is the deliberate trade — the alternative on offer was a 500 plus a wedged account, which is strictly worse. Operator-side, the failure is loud in the logs.
- The gap this leaves is delivery *observability*: nothing yet alerts on a spike in delivery failures. Monit watches the host, not this. Tracked in [TODO.md](../../TODO.md) — it should land before the site takes real signup traffic.
- Rolling back the user row on failure was considered and rejected. It needs a `delete` on `UserRepository` that exists for no other reason, it still owes the caller either a 500 or a lie, and it discards a legitimate account over a transient fault.
- An outbox with retries is the natural next step if delivery ever needs a guarantee. Not warranted at transactional-only volume ([06 — Infrastructure](../06-infrastructure.md) §SES).
