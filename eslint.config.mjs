import config, { esmConfig } from '@iobroker/eslint-config';

// We adopt the shared ioBroker rule set, with a few project-specific overrides.
// Linting targets src/ (the shipped adapter code); the test suite runs under
// Vitest/Mocha and is not part of the lint scope.
export default [
  {
    ignores: [
      'build/**',
      'admin/**',
      'tools/**',
      'test/**',
      '**/*.config.mjs',
      '**/*.cjs',
      '.mocharc.json',
    ],
  },
  ...config,
  ...esmConfig,
  {
    rules: {
      // We write JSDoc as prose where it adds value, not mechanically on every
      // interface member / method / parameter. Turn off the "require"
      // family (otherwise the fixer stuffs empty doc blocks everywhere and the
      // linter nags for a @param on every documented function).
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-throws-type': 'off',
    },
  },
];
