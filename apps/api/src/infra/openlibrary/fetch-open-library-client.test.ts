import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchOpenLibraryClient } from './fetch-open-library-client.js';

// Recorded Open Library JSON (trimmed to the fields we read) — so these tests never
// touch the network ([08] M3 slice 5).
const fixtures: Record<string, unknown> = {
  '/search.json': {
    docs: [
      {
        key: '/works/OL1W',
        title: 'Moby-Dick',
        author_name: ['Herman Melville'],
        first_publish_year: 1851,
        cover_i: 12345,
      },
      { key: '/works/OL2W', title: 'No Author Work' }, // sparse doc still maps
    ],
  },
  '/works/OL1W.json': {
    title: 'Moby-Dick',
    description: { value: 'A whaling voyage.' }, // object form of description
    covers: [-1, 12345], // OL uses -1 for "no cover"; we skip it
    subjects: ['Whaling', 'Sea stories'],
    first_publish_date: 'October 1851',
    authors: [{ author: { key: '/authors/OLA1' } }],
  },
  '/authors/OLA1.json': { name: 'Herman Melville' },
};

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: URL | string) => {
      const path = new URL(String(input)).pathname;
      const body = fixtures[path];
      if (!body) return Promise.resolve({ ok: false, status: 404 } as Response);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
    }),
  );
}

describe('FetchOpenLibraryClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps search docs, normalising the work key', async () => {
    mockFetch();
    const client = new FetchOpenLibraryClient('https://openlibrary.org');
    const results = await client.search('moby dick', 10);
    expect(results[0]).toEqual({
      workKey: 'OL1W',
      title: 'Moby-Dick',
      authorNames: ['Herman Melville'],
      firstPublishYear: 1851,
      coverId: 12345,
    });
    // The sparse second doc still maps, with empty/nulled fields.
    expect(results[1]).toMatchObject({ workKey: 'OL2W', authorNames: [], coverId: null });
  });

  it('assembles a work, resolving author names and the description object', async () => {
    mockFetch();
    const client = new FetchOpenLibraryClient('https://openlibrary.org');
    const work = await client.fetchWork('OL1W');
    expect(work).toEqual({
      workKey: 'OL1W',
      title: 'Moby-Dick',
      description: 'A whaling voyage.',
      authorNames: ['Herman Melville'],
      firstPublishYear: 1851, // parsed out of "October 1851"
      coverId: 12345, // the -1 sentinel is skipped
      subjects: ['Whaling', 'Sea stories'],
    });
  });

  it('returns null for an unknown work', async () => {
    mockFetch();
    const client = new FetchOpenLibraryClient('https://openlibrary.org');
    expect(await client.fetchWork('OL999W')).toBeNull();
  });

  it('returns an empty list when search fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 } as Response)));
    const client = new FetchOpenLibraryClient('https://openlibrary.org');
    expect(await client.search('anything', 10)).toEqual([]);
  });
});
