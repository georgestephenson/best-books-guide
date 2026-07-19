/**
 * Severity of a language-screen verdict (docs/01 F5):
 * - `clean`  — publish, no report.
 * - `mild`   — publish, but auto-report into the moderation queue for a human.
 * - `severe` — auto-hide immediately *and* file a system report; a human confirms.
 *
 * Machines flag, humans decide — nothing here silently eats a review, guarding
 * against the Scunthorpe problem (docs/01 F5).
 */
export type ScreenSeverity = 'clean' | 'mild' | 'severe';

export interface ScreenResult {
  severity: ScreenSeverity;
  /** The matched terms, for the report note the moderator reads. */
  matches: string[];
}

/** Automated review-text screen — a maintained wordlist matcher (docs/01 F5). */
export interface LanguageScreen {
  screen(text: string): ScreenResult;
}
