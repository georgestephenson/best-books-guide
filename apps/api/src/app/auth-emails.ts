import type { EmailMessage } from './ports/email-sender.js';

/**
 * Transactional email content (docs/01 P3 — transactional only, no marketing).
 * Pure builders: the use-cases construct the links and hand the message to the
 * EmailSender port. Plain, quiet copy.
 */

export function verificationEmail(to: string, verifyLink: string): EmailMessage {
  return {
    to,
    subject: 'Confirm your email · Best Books Guide',
    text: `Welcome to Best Books Guide.\n\nConfirm your email address to start rating and reviewing:\n${verifyLink}\n\nThis link expires in 24 hours. If you didn't create an account, ignore this email.`,
    html: `<p>Welcome to Best Books Guide.</p><p>Confirm your email address to start rating and reviewing:</p><p><a href="${verifyLink}">Confirm my email</a></p><p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`,
  };
}

export function passwordResetEmail(to: string, resetLink: string): EmailMessage {
  return {
    to,
    subject: 'Reset your password · Best Books Guide',
    text: `Someone asked to reset the password for this account.\n\nReset it here:\n${resetLink}\n\nThis link expires in 1 hour. If it wasn't you, ignore this email — your password is unchanged.`,
    html: `<p>Someone asked to reset the password for this account.</p><p><a href="${resetLink}">Reset my password</a></p><p>This link expires in 1 hour. If it wasn't you, you can ignore this email — your password is unchanged.</p>`,
  };
}

/**
 * Sent when someone registers with an email that already has an account. This is
 * the enumeration-safe response (docs/05): register always looks like a success,
 * and the real owner is told rather than the registrant.
 */
export function existingAccountEmail(
  to: string,
  loginLink: string,
  resetLink: string,
): EmailMessage {
  return {
    to,
    subject: 'You already have an account · Best Books Guide',
    text: `Someone (maybe you) tried to sign up with this email, but you already have an account.\n\nSign in: ${loginLink}\nForgot your password? ${resetLink}\n\nIf this wasn't you, no action is needed.`,
    html: `<p>Someone (maybe you) tried to sign up with this email, but you already have an account.</p><p><a href="${loginLink}">Sign in</a> · <a href="${resetLink}">Reset your password</a></p><p>If this wasn't you, no action is needed.</p>`,
  };
}
