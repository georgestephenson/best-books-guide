import { describe, expect, it } from 'vitest';
import { slugify } from './slug.js';
import { API_BASE_PATH, HEALTH_PATH } from './constants.js';

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('The Making of the Atomic Bomb')).toBe('the-making-of-the-atomic-bomb');
  });

  it('strips diacritics to ASCII', () => {
    expect(slugify('Gödel, Escher, Bach')).toBe('godel-escher-bach');
  });

  it('collapses runs of punctuation and whitespace into a single hyphen', () => {
    expect(slugify('Slaughterhouse-Five  —  or,   The Children’s Crusade')).toBe(
      'slaughterhouse-five-or-the-children-s-crusade',
    );
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  !!!Hello!!!  ')).toBe('hello');
  });

  it('returns an empty string when there is nothing slug-worthy', () => {
    expect(slugify('———')).toBe('');
  });
});

describe('constants', () => {
  it('exposes the versioned API base path and health path', () => {
    expect(API_BASE_PATH).toBe('/api/v1');
    expect(HEALTH_PATH).toBe('/healthz');
  });
});
