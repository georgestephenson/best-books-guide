/**
 * Conventional Commits, per CONTRIBUTING.md.
 * Scopes mirror the monorepo layout; empty scope is allowed for repo-wide changes.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['api', 'web', 'shared', 'db', 'terraform', 'ansible', 'deps', 'infra', 'ci', 'repo'],
    ],
  },
};
