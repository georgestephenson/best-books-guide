import { eq } from 'drizzle-orm';
import { ConflictError } from '../../domain/errors.js';
import type {
  CreateUserInput,
  UserRecord,
  UserRepository,
  Role,
} from '../../app/ports/user-repository.js';
import type { Database } from './pool.js';
import { users, type UserRow } from './schema/users.js';

function toRecord(row: UserRow): UserRecord {
  // role is DB-constrained to the enum by users_role_check.
  return { ...row, role: row.role as Role };
}

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string; cause?: { code?: string } }).code
    ?? (err as { cause?: { code?: string } }).cause?.code;
  return code === '23505';
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateUserInput): Promise<UserRecord> {
    try {
      const [row] = await this.db.insert(users).values(input).returning();
      return toRecord(row!);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError('email already registered');
      throw err;
    }
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toRecord(row) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ? toRecord(row) : null;
  }

  async markEmailVerified(id: string, at: Date): Promise<void> {
    await this.db.update(users).set({ emailVerifiedAt: at }).where(eq(users.id, id));
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }

  async updateDisplayName(id: string, displayName: string): Promise<UserRecord> {
    const [row] = await this.db
      .update(users)
      .set({ displayName })
      .where(eq(users.id, id))
      .returning();
    return toRecord(row!);
  }

  async promoteToAdmin(email: string): Promise<UserRecord | null> {
    // email is citext, so this match folds case in the database.
    const [row] = await this.db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.email, email))
      .returning();
    return row ? toRecord(row) : null;
  }
}
