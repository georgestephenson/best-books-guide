/**
 * Curated "severe" wordlist for the automated review screen (docs/01 F5). A hit here
 * auto-hides the review on submission (pending a moderator's confirmation) rather than
 * merely queueing it — reserved for slurs and hate terms, not ordinary profanity,
 * which `obscenity`'s general English dataset handles as a *mild* hit.
 *
 * The terms are stored **base64-encoded, not as plain text**, deliberately: this is a
 * public repository, and a readable list of slurs would surface in code search,
 * content scanners, and casual browsing for no benefit. Encoding keeps the source
 * clean while the runtime list is identical. It is editorial data, kept small and
 * extended by moderators over time (`base64 <<< 'term'` to add one). Matching is
 * boundary- and leetspeak-aware via the same transformers as the general screen, and
 * the general dataset's whitelist still guards the Scunthorpe problem.
 */
const ENCODED_SEVERE_TERMS: readonly string[] = [
  'bmlnZ2Vy',
  'ZmFnZ290',
  'a2lrZQ==',
  'Y2hpbms=',
  'c3BpYw==',
  'Y29vbg==',
  'cmV0YXJk',
];

export const SEVERE_TERMS: readonly string[] = ENCODED_SEVERE_TERMS.map((t) =>
  Buffer.from(t, 'base64').toString('utf8'),
);
