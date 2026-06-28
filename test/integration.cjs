'use strict';

// Standard ioBroker integration test: starts a real js-controller, installs
// this adapter into it and verifies it starts up and stays alive. Run by
// `@iobroker/testing-action-adapter` via `npm run test:integration`.
//
// In CI there is no serial device, so the adapter logs an open error, sets
// info.connection=false and keeps running (see connectSerial() in src/main.ts).
// The harness therefore sees the adapter start and remain alive, which is the
// pass condition.
//
// CommonJS (.cjs) on purpose: @iobroker/testing is CommonJS and this package
// is ESM, so the standard mocha test file uses require().
const path = require('node:path');
const { tests } = require('@iobroker/testing');

tests.integration(path.join(__dirname, '..'));
