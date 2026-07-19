// Aggregated schema — drizzle-kit reads this to generate migrations, and the
// repositories import tables from here.
export * from './users.js';
// M3 catalogue (docs/03).
export * from './subjects.js';
export * from './authors.js';
export * from './series.js';
export * from './books.js';
export * from './book-authors.js';
export * from './book-subjects.js';
export * from './lists.js';
export * from './list-items.js';
// M4 member features (docs/03).
export * from './reading-statuses.js';
export * from './reviews.js';
export * from './review-reports.js';
export * from './tracked-lists.js';
