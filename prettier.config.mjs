// Project Prettier settings. We adopt @iobroker/eslint-config for the lint
// *rules* (see eslint.config.mjs) but keep the formatting style this codebase
// was written in (2-space indent, 100 col, always-parens), rather than the
// shared config's defaults. eslint-plugin-prettier reads this file, so lint and
// `npm run format` stay in sync.
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
  endOfLine: 'lf',
};
