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
      // 'deps-dev' is Dependabot's scope for devDependency bumps; 'deps' is for runtime deps.
      [
        'api',
        'web',
        'shared',
        'db',
        'terraform',
        'ansible',
        'deps',
        'deps-dev',
        'infra',
        'ci',
        'repo',
      ],
    ],
  },
};
