import type { BreachedPasswordChecker } from '../../app/ports/security.js';
import { BREACHED_PASSWORDS } from './breached-passwords.data.js';

/** Case-insensitive exact match against the breached-password list (docs/05). */
export class ListBreachedPasswordChecker implements BreachedPasswordChecker {
  private readonly set: Set<string>;

  constructor(list: readonly string[] = BREACHED_PASSWORDS) {
    this.set = new Set(list.map((p) => p.toLowerCase()));
  }

  isBreached(password: string): boolean {
    return this.set.has(password.toLowerCase());
  }
}
