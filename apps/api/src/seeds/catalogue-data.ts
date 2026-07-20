/**
 * Catalogue seed dataset — **public-domain works only**, with demonstration blurbs.
 * This is shippable launch-adjacent content, not the editor's real curated picks
 * (those are entered via the admin UI and live in the DB, never in source control).
 * It exercises all three list shapes: a flat list, a list holding a
 * series, and a parent list with sublists.
 *
 * `applySeed` (./apply-seed) upserts this by slug, so re-running is idempotent.
 */

export interface SeedSubject {
  slug: string;
  name: string;
  description: string | null;
  position: number;
}
export interface SeedAuthor {
  slug: string;
  name: string;
}
export interface SeedSeries {
  slug: string;
  title: string;
  description: string | null;
}
export interface SeedBook {
  slug: string;
  title: string;
  subtitle?: string | null;
  authors: string[]; // author slugs, in credit order
  subjects: string[]; // subject slugs
  seriesSlug?: string;
  seriesPosition?: number;
  firstPublishedYear?: number;
  pageCount?: number;
  description?: string | null;
}
export interface SeedListItem {
  book?: string; // book slug
  series?: string; // series slug — exactly one of book/series
  blurb?: string | null;
}
export interface SeedList {
  slug: string;
  title: string;
  subject: string; // subject slug
  parent?: string; // parent list slug (makes this a sublist)
  intro?: string | null;
  published: boolean;
  items: SeedListItem[];
}
export interface SeedData {
  subjects: SeedSubject[];
  authors: SeedAuthor[];
  series: SeedSeries[];
  books: SeedBook[];
  lists: SeedList[];
}

export const catalogueSeed: SeedData = {
  subjects: [
    {
      slug: 'fiction',
      name: 'Fiction',
      description: 'Novels that repay a lifetime of rereading.',
      position: 0,
    },
    {
      slug: 'philosophy',
      name: 'Philosophy',
      description: 'Where to start with the questions that don’t go away.',
      position: 1,
    },
    {
      slug: 'science',
      name: 'Science',
      description: 'The books that changed how we understand the world.',
      position: 2,
    },
  ],
  authors: [
    { slug: 'herman-melville', name: 'Herman Melville' },
    { slug: 'george-eliot', name: 'George Eliot' },
    { slug: 'mary-shelley', name: 'Mary Shelley' },
    { slug: 'fyodor-dostoevsky', name: 'Fyodor Dostoevsky' },
    { slug: 'jane-austen', name: 'Jane Austen' },
    { slug: 'bram-stoker', name: 'Bram Stoker' },
    { slug: 'arthur-conan-doyle', name: 'Arthur Conan Doyle' },
    { slug: 'plato', name: 'Plato' },
    { slug: 'aristotle', name: 'Aristotle' },
    { slug: 'marcus-aurelius', name: 'Marcus Aurelius' },
    { slug: 'rene-descartes', name: 'René Descartes' },
    { slug: 'david-hume', name: 'David Hume' },
    { slug: 'immanuel-kant', name: 'Immanuel Kant' },
    { slug: 'charles-darwin', name: 'Charles Darwin' },
    { slug: 'michael-faraday', name: 'Michael Faraday' },
    { slug: 'charles-lyell', name: 'Charles Lyell' },
  ],
  series: [
    {
      slug: 'sherlock-holmes',
      title: 'Sherlock Holmes',
      description:
        'The four novels of the Holmes canon, in order — the blueprint for detective fiction.',
    },
  ],
  books: [
    // Fiction
    {
      slug: 'moby-dick',
      title: 'Moby-Dick',
      subtitle: 'or, The Whale',
      authors: ['herman-melville'],
      subjects: ['fiction'],
      firstPublishedYear: 1851,
      pageCount: 635,
      description:
        'A whaling voyage that keeps breaking its banks — into natural history, theology, and one man’s grievance against the universe.',
    },
    {
      slug: 'middlemarch',
      title: 'Middlemarch',
      authors: ['george-eliot'],
      subjects: ['fiction'],
      firstPublishedYear: 1871,
    },
    {
      slug: 'frankenstein',
      title: 'Frankenstein',
      subtitle: 'or, The Modern Prometheus',
      authors: ['mary-shelley'],
      subjects: ['fiction'],
      firstPublishedYear: 1818,
    },
    {
      slug: 'crime-and-punishment',
      title: 'Crime and Punishment',
      authors: ['fyodor-dostoevsky'],
      subjects: ['fiction'],
      firstPublishedYear: 1866,
    },
    {
      slug: 'pride-and-prejudice',
      title: 'Pride and Prejudice',
      authors: ['jane-austen'],
      subjects: ['fiction'],
      firstPublishedYear: 1813,
    },
    {
      slug: 'dracula',
      title: 'Dracula',
      authors: ['bram-stoker'],
      subjects: ['fiction'],
      firstPublishedYear: 1897,
    },
    // Sherlock Holmes series
    {
      slug: 'a-study-in-scarlet',
      title: 'A Study in Scarlet',
      authors: ['arthur-conan-doyle'],
      subjects: ['fiction'],
      seriesSlug: 'sherlock-holmes',
      seriesPosition: 1,
      firstPublishedYear: 1887,
    },
    {
      slug: 'the-sign-of-the-four',
      title: 'The Sign of the Four',
      authors: ['arthur-conan-doyle'],
      subjects: ['fiction'],
      seriesSlug: 'sherlock-holmes',
      seriesPosition: 2,
      firstPublishedYear: 1890,
    },
    {
      slug: 'the-hound-of-the-baskervilles',
      title: 'The Hound of the Baskervilles',
      authors: ['arthur-conan-doyle'],
      subjects: ['fiction'],
      seriesSlug: 'sherlock-holmes',
      seriesPosition: 3,
      firstPublishedYear: 1902,
    },
    {
      slug: 'the-valley-of-fear',
      title: 'The Valley of Fear',
      authors: ['arthur-conan-doyle'],
      subjects: ['fiction'],
      seriesSlug: 'sherlock-holmes',
      seriesPosition: 4,
      firstPublishedYear: 1915,
    },
    // Philosophy — ancient
    {
      slug: 'the-republic',
      title: 'The Republic',
      authors: ['plato'],
      subjects: ['philosophy'],
      firstPublishedYear: -380,
    },
    {
      slug: 'nicomachean-ethics',
      title: 'Nicomachean Ethics',
      authors: ['aristotle'],
      subjects: ['philosophy'],
      firstPublishedYear: -340,
    },
    {
      slug: 'meditations',
      title: 'Meditations',
      authors: ['marcus-aurelius'],
      subjects: ['philosophy'],
      firstPublishedYear: 180,
    },
    // Philosophy — modern
    {
      slug: 'meditations-on-first-philosophy',
      title: 'Meditations on First Philosophy',
      authors: ['rene-descartes'],
      subjects: ['philosophy'],
      firstPublishedYear: 1641,
    },
    {
      slug: 'enquiry-human-understanding',
      title: 'An Enquiry Concerning Human Understanding',
      authors: ['david-hume'],
      subjects: ['philosophy'],
      firstPublishedYear: 1748,
    },
    {
      slug: 'groundwork-metaphysics-morals',
      title: 'Groundwork of the Metaphysics of Morals',
      authors: ['immanuel-kant'],
      subjects: ['philosophy'],
      firstPublishedYear: 1785,
    },
    // Science
    {
      slug: 'on-the-origin-of-species',
      title: 'On the Origin of Species',
      authors: ['charles-darwin'],
      subjects: ['science'],
      firstPublishedYear: 1859,
    },
    {
      slug: 'the-voyage-of-the-beagle',
      title: 'The Voyage of the Beagle',
      authors: ['charles-darwin'],
      subjects: ['science'],
      firstPublishedYear: 1839,
    },
    {
      slug: 'chemical-history-of-a-candle',
      title: 'The Chemical History of a Candle',
      authors: ['michael-faraday'],
      subjects: ['science'],
      firstPublishedYear: 1861,
    },
    {
      slug: 'principles-of-geology',
      title: 'Principles of Geology',
      authors: ['charles-lyell'],
      subjects: ['science'],
      firstPublishedYear: 1830,
    },
  ],
  lists: [
    {
      slug: 'the-essential-novels',
      title: 'The Essential Novels',
      subject: 'fiction',
      published: true,
      intro:
        'A short shelf, not a syllabus. These are the novels that repay a lifetime of rereading — chosen for the reach of their vision over the weight of their reputation. Where a writer’s whole world matters more than a single book, the series takes the slot.',
      items: [
        {
          book: 'moby-dick',
          blurb:
            'Difficult, funny, inexhaustible — the rare book that gets larger every time you return to it.',
        },
        {
          book: 'middlemarch',
          blurb:
            'The most intelligent novel in English about ordinary lives, and wise without ever preaching.',
        },
        {
          series: 'sherlock-holmes',
          blurb: 'One slot for the whole canon; the reading order lives on its own page.',
        },
        {
          book: 'crime-and-punishment',
          blurb:
            'A murder in the first act, then four hundred pages of a mind outrunning its conscience.',
        },
        {
          book: 'frankenstein',
          blurb:
            'Less a horror story than a tragedy of neglect — the monster’s eloquence is the point.',
        },
        {
          book: 'pride-and-prejudice',
          blurb: 'A comedy of manners with a steel spine; nobody has bettered its first sentence.',
        },
        {
          book: 'dracula',
          blurb: 'An epistolary thriller that invented the modern vampire and still sets the pace.',
        },
      ],
    },
    {
      slug: 'foundations-of-western-philosophy',
      title: 'Foundations of Western Philosophy',
      subject: 'philosophy',
      published: true,
      intro:
        'Where to begin. Not a history, but a route in — split into the ancients who set the questions and the moderns who reopened them. Each path is a short list you can actually finish.',
      items: [],
    },
    {
      slug: 'ancient-philosophy',
      title: 'The Ancients',
      subject: 'philosophy',
      parent: 'foundations-of-western-philosophy',
      published: true,
      intro:
        'Three books that still frame how the West argues about justice, virtue, and how to live.',
      items: [
        {
          book: 'the-republic',
          blurb:
            'Justice, the ideal city, and the cave — the argument every later philosopher answers.',
        },
        {
          book: 'nicomachean-ethics',
          blurb: 'Virtue as a practised habit, not a rule. The most practical ethics ever written.',
        },
        {
          book: 'meditations',
          blurb: 'An emperor’s private notebook — Stoicism as daily maintenance for the mind.',
        },
      ],
    },
    {
      slug: 'modern-philosophy',
      title: 'The Moderns',
      subject: 'philosophy',
      parent: 'foundations-of-western-philosophy',
      published: true,
      intro: 'The turn inward: what can we actually know, and on what authority?',
      items: [
        {
          book: 'meditations-on-first-philosophy',
          blurb: 'Doubt everything, then rebuild — the founding move of modern philosophy.',
        },
        {
          book: 'enquiry-human-understanding',
          blurb: 'Hume’s scalpel: how much of what we “know” is really just habit?',
        },
        {
          book: 'groundwork-metaphysics-morals',
          blurb: 'The categorical imperative — morality derived from reason alone.',
        },
      ],
    },
    {
      slug: 'landmarks-of-science',
      title: 'Landmarks of Science',
      subject: 'science',
      published: true,
      intro:
        'Books that didn’t just report a discovery but changed the frame — readable today, and still startling.',
      items: [
        {
          book: 'on-the-origin-of-species',
          blurb: 'The single most consequential idea in biology, argued with disarming patience.',
        },
        {
          book: 'the-voyage-of-the-beagle',
          blurb: 'The travelogue where you can watch the theory forming, island by island.',
        },
        {
          book: 'principles-of-geology',
          blurb: 'Deep time, made undeniable — the book Darwin took to sea.',
        },
        {
          book: 'chemical-history-of-a-candle',
          blurb: 'A masterclass in seeing the whole of chemistry in one small flame.',
        },
      ],
    },
  ],
};
