export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Transactional email only (verification, password reset) — no marketing (docs/01 P3). */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
