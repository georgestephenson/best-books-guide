import type { EmailMessage, EmailSender } from '../../app/ports/email-sender.js';

/**
 * Dev transport: logs the message instead of sending it (no SES call, no sandbox
 * limits) — in dev the verification/reset link is right there in the API output.
 * Integration tests use a capturing fake instead, to read the token back.
 */
export class LoggingEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    console.info(`[email] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return Promise.resolve();
  }
}
