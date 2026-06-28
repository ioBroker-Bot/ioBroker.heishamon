'use strict';

// Standard ioBroker package validation: checks that package.json and
// io-package.json are present, consistent and well-formed. Run by
// `@iobroker/testing-action-check` via `npm run test:package`.
//
// CommonJS (.cjs) on purpose: @iobroker/testing is a CommonJS module and this
// package is ESM ("type": "module"), so the standard mocha test files use the
// .cjs extension to load it with require().
const path = require('node:path');
const { tests } = require('@iobroker/testing');

tests.packageFiles(path.join(__dirname, '..'));
