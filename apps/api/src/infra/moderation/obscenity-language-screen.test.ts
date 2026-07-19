import { describe, expect, it } from 'vitest';
import { ObscenityLanguageScreen } from './obscenity-language-screen.js';
import { SEVERE_TERMS } from './severe-terms.data.js';

describe('ObscenityLanguageScreen', () => {
  const screen = new ObscenityLanguageScreen();

  it('passes clean text', () => {
    expect(screen.screen('A thoughtful, careful, well-argued book.')).toEqual({
      severity: 'clean',
      matches: [],
    });
  });

  it('treats empty/whitespace as clean', () => {
    expect(screen.screen('').severity).toBe('clean');
    expect(screen.screen('   \n\t ').severity).toBe('clean');
  });

  it('flags ordinary profanity as mild, with the matched term', () => {
    const result = screen.screen('this book is shit');
    expect(result.severity).toBe('mild');
    expect(result.matches).toContain('shit');
  });

  it('flags a curated severe term as severe', () => {
    const result = screen.screen(`you are a ${SEVERE_TERMS[0]}`);
    expect(result.severity).toBe('severe');
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('does not fall for the Scunthorpe problem (whitelisted place names)', () => {
    expect(screen.screen('I grew up near Scunthorpe in Lincolnshire.').severity).toBe('clean');
    expect(screen.screen('A history of the Cockburn family.').severity).toBe('clean');
  });

  it('sees through basic leetspeak obfuscation', () => {
    // The recommended transformers normalise common substitutions.
    expect(screen.screen('what a piece of sh1t').severity).toBe('mild');
  });
});
