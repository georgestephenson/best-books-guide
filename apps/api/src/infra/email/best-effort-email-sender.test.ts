import { afterEach, describe, expect, it, vi } from 'vitest';
import { BestEffortEmailSender } from './best-effort-email-sender.js';
import type { EmailMessage, EmailSender } from '../../app/ports/email-sender.js';

const message: EmailMessage = {
  to: 'reader@example.com',
  subject: 'Confirm your email · Best Books Guide',
  text: 'Confirm here: https://bestbooks.guide/verify-email?token=s3cr3t-token',
  html: '<a href="https://bestbooks.guide/verify-email?token=s3cr3t-token">Confirm</a>',
};

class RecordingSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  send(m: EmailMessage): Promise<void> {
    this.sent.push(m);
    return Promise.resolve();
  }
}

class ThrowingSender implements EmailSender {
  constructor(private readonly err: unknown) {}
  send(): Promise<void> {
    return Promise.reject(this.err);
  }
}

describe('BestEffortEmailSender', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes the message through to the inner transport', async () => {
    const inner = new RecordingSender();
    await new BestEffortEmailSender(inner).send(message);
    expect(inner.sent).toEqual([message]);
  });

  it('swallows a transport failure instead of rejecting', async () => {
    // The SES sandbox rejection that took production signup down.
    const err = Object.assign(new Error('Email address is not verified.'), {
      name: 'MessageRejected',
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(new BestEffortEmailSender(new ThrowingSender(err)).send(message)).resolves
      .toBeUndefined();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('logs the recipient, subject and reason', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = Object.assign(new Error('Throttled'), { name: 'TooManyRequestsException' });

    await new BestEffortEmailSender(new ThrowingSender(err)).send(message);

    const logged = spy.mock.calls[0]![0] as string;
    expect(logged).toContain('reader@example.com');
    expect(logged).toContain('Confirm your email');
    expect(logged).toContain('TooManyRequestsException: Throttled');
  });

  it('never logs the message body, which carries a live token', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await new BestEffortEmailSender(new ThrowingSender(new Error('nope'))).send(message);

    const logged = spy.mock.calls[0]![0] as string;
    expect(logged).not.toContain('s3cr3t-token');
  });

  it('handles a non-Error rejection', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      new BestEffortEmailSender(new ThrowingSender('socket hang up')).send(message),
    ).resolves.toBeUndefined();
    expect(spy.mock.calls[0]![0] as string).toContain('socket hang up');
  });
});
