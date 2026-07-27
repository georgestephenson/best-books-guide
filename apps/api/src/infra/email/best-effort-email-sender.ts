import type { EmailMessage, EmailSender } from '../../app/ports/email-sender.js';

/**
 * Delivery-failure policy, applied once at the composition root rather than at each
 * of the three call sites (register, password reset, resend verification).
 *
 * All three routes already return a uniform response that says nothing about whether
 * an account exists (docs/05 — enumeration safety), so none of them can usefully
 * surface a send failure to the caller anyway. Letting the SDK error escape instead
 * turns a delivery problem into a 500 *after* the user row is committed and the
 * one-time token is issued — the caller sees a failure, the account exists, and a
 * retry hits the already-registered path. Transactional mail is best-effort: log it
 * loudly and let the request succeed. The account stays usable (sign-in does not
 * require a verified email) and the member can trigger a resend.
 *
 * This is the whole reason SES sandbox rejections took the production signup flow
 * down — see [ADR-0011](../../../../../docs/adr/0011-best-effort-transactional-email.md).
 *
 * Logs deliberately carry only the recipient, the subject and the error: the message
 * body holds a live verification or password-reset token and must never reach the logs.
 */
export class BestEffortEmailSender implements EmailSender {
  constructor(private readonly inner: EmailSender) {}

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.inner.send(message);
    } catch (err) {
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error(
        `[email] delivery failed to=${message.to} subject="${message.subject}" reason=${reason}`,
      );
    }
  }
}
