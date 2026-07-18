export type Role = 'member' | 'admin';

/** A user as stored — includes the password hash, which never leaves the app layer. */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  displayName: string;
}

export interface UserRepository {
  /** Insert a new user. Throws `ConflictError` if the email already exists. */
  create(input: CreateUserInput): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  /** Case-insensitive (email is citext). */
  findByEmail(email: string): Promise<UserRecord | null>;
  markEmailVerified(id: string, at: Date): Promise<void>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  updateDisplayName(id: string, displayName: string): Promise<UserRecord>;
  /**
   * Grant the admin role by email (the `promote-admin` runbook — docs/07). Returns
   * the updated record, or `null` if no user has that email. Case-insensitive.
   */
  promoteToAdmin(email: string): Promise<UserRecord | null>;
}
