// In-memory fakes of the ports, for unit-testing the use-cases with no I/O
// (docs/02 §Testing strategy). Kept in a plain module (imported only by tests) so
// each test builds exactly the fakes it needs.
import type { EmailMessage, EmailSender } from '../ports/email-sender.js';
import type {
  BreachedPasswordChecker,
  PasswordHasher,
  RateLimiter,
  RateLimitResult,
} from '../ports/security.js';
import type { SessionRecord, SessionStore } from '../ports/session-store.js';
import type {
  AccessTokenClaims,
  AccessTokenService,
  OneTimeTokenPurpose,
  OneTimeTokenStore,
  RandomSource,
  TokenHasher,
} from '../ports/token-services.js';
import type { CreateUserInput, UserRecord, UserRepository } from '../ports/user-repository.js';
import type { Clock } from '../ports/clock.js';
import { ConflictError } from '../../domain/errors.js';

export function makeUser(over: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user-1',
    email: 'reader@example.com',
    passwordHash: 'h:correcthorsebattery',
    displayName: 'Reader',
    role: 'member',
    emailVerifiedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

export class FakeUserRepository implements UserRepository {
  private readonly byId = new Map<string, UserRecord>();
  private seq = 0;

  constructor(seed: UserRecord[] = []) {
    for (const u of seed) this.byId.set(u.id, u);
  }

  create(input: CreateUserInput): Promise<UserRecord> {
    for (const u of this.byId.values()) {
      if (u.email.toLowerCase() === input.email.toLowerCase()) {
        return Promise.reject(new ConflictError('email already registered'));
      }
    }
    const user = makeUser({ id: `user-${++this.seq}`, ...input });
    this.byId.set(user.id, user);
    return Promise.resolve(user);
  }
  findById(id: string): Promise<UserRecord | null> {
    return Promise.resolve(this.byId.get(id) ?? null);
  }
  findByEmail(email: string): Promise<UserRecord | null> {
    for (const u of this.byId.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return Promise.resolve(u);
    }
    return Promise.resolve(null);
  }
  markEmailVerified(id: string, at: Date): Promise<void> {
    const u = this.byId.get(id);
    if (u) this.byId.set(id, { ...u, emailVerifiedAt: at });
    return Promise.resolve();
  }
  updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    const u = this.byId.get(id);
    if (u) this.byId.set(id, { ...u, passwordHash });
    return Promise.resolve();
  }
  updateDisplayName(id: string, displayName: string): Promise<UserRecord> {
    const u = { ...this.byId.get(id)!, displayName };
    this.byId.set(id, u);
    return Promise.resolve(u);
  }
}

export class FakeSessionStore implements SessionStore {
  readonly records = new Map<string, SessionRecord>();
  readonly revokedAll: string[] = [];

  create(sessionId: string, record: SessionRecord): Promise<void> {
    this.records.set(sessionId, record);
    return Promise.resolve();
  }
  get(sessionId: string): Promise<SessionRecord | null> {
    return Promise.resolve(this.records.get(sessionId) ?? null);
  }
  rotate(
    sessionId: string,
    fields: { tokenHash: string; prevTokenHash: string; rotatedAt: number },
  ): Promise<void> {
    const r = this.records.get(sessionId);
    if (r) this.records.set(sessionId, { ...r, ...fields });
    return Promise.resolve();
  }
  revoke(sessionId: string): Promise<void> {
    this.records.delete(sessionId);
    return Promise.resolve();
  }
  revokeAllForUser(userId: string): Promise<void> {
    this.revokedAll.push(userId);
    for (const [sid, r] of this.records) if (r.userId === userId) this.records.delete(sid);
    return Promise.resolve();
  }
}

export class FakeOneTimeTokenStore implements OneTimeTokenStore {
  private readonly map = new Map<string, string>();
  private k(p: OneTimeTokenPurpose, h: string): string {
    return `${p}:${h}`;
  }
  // The port's 4th arg (ttlSeconds) is irrelevant to an in-memory fake, so it's omitted.
  issue(p: OneTimeTokenPurpose, tokenHash: string, userId: string): Promise<void> {
    this.map.set(this.k(p, tokenHash), userId);
    return Promise.resolve();
  }
  consume(p: OneTimeTokenPurpose, tokenHash: string): Promise<string | null> {
    const key = this.k(p, tokenHash);
    const v = this.map.get(key) ?? null;
    this.map.delete(key);
    return Promise.resolve(v);
  }
}

export class FakeRateLimiter implements RateLimiter {
  constructor(private result: RateLimitResult = { allowed: true, retryAfterSeconds: 0 }) {}
  readonly resets: string[] = [];
  setBlocked(retryAfterSeconds = 60): void {
    this.result = { allowed: false, retryAfterSeconds };
  }
  hit(): Promise<RateLimitResult> {
    return Promise.resolve(this.result);
  }
  reset(scope: string, key: string): Promise<void> {
    this.resets.push(`${scope}:${key}`);
    return Promise.resolve();
  }
}

/** Hash = `h:<password>`; verify checks that shape (so a dummy hash reads false). */
export class FakePasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return Promise.resolve(`h:${password}`);
  }
  verify(hash: string, password: string): Promise<boolean> {
    return Promise.resolve(hash === `h:${password}`);
  }
}

export class FakeBreachedChecker implements BreachedPasswordChecker {
  constructor(private readonly breached: Set<string> = new Set()) {}
  isBreached(password: string): boolean {
    return this.breached.has(password);
  }
}

export class FakeEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];
  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}

export class FakeTokenHasher implements TokenHasher {
  hash(token: string): string {
    return `t:${token}`;
  }
}

export class SequentialRandom implements RandomSource {
  private n = 0;
  token(): string {
    return `secret-${++this.n}`;
  }
  sessionId(): string {
    return `sid-${++this.n}`;
  }
}

export class FakeAccessTokenService implements AccessTokenService {
  readonly ttlSeconds = 900;
  sign(claims: AccessTokenClaims): Promise<string> {
    return Promise.resolve(`jwt:${claims.sub}`);
  }
  verify(): Promise<AccessTokenClaims | null> {
    return Promise.resolve(null);
  }
}

export class FixedClock implements Clock {
  constructor(private ms = Date.parse('2026-07-18T00:00:00Z')) {}
  set(ms: number): void {
    this.ms = ms;
  }
  now(): Date {
    return new Date(this.ms);
  }
  uptimeSeconds(): number {
    return 0;
  }
}
