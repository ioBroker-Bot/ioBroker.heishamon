Thank you for the detailed review, @mcm1957 — much appreciated. Everything has been addressed in **v0.0.12**. Summary below.

## Claude-based checklist — the 6 issues

- **INSTALL.md (German / npm-bypass install):** removed entirely. The install path is now the admin UI only; the genuinely useful bits (serial `dialout` prerequisites, troubleshooting) were folded into the (English) README. No `npm install` / `iobroker url` instructions remain.
- **`info` channel `common.name` not fully i18n:** now provided in all 11 languages.
- **`responseTimeoutMs` / `sendMaxRetries` not validated:** `validateConfig()` now validates and clamps them (and `setCommandGapMs`) before any object is created, with the Node.js `setTimeout` ceiling (2,147,483,647 ms) as the hard upper bound. The `WireQueue` / `BusExchange` constructors enforce the ceiling too.
- **`setCommandGapMs` not clamped:** clamped in `validateConfig()` and in the `WireQueue` constructor.
- **`setInterval` polling can overrun:** reworked to a `setTimeout`-at-end-of-tick scheme — the next poll is scheduled only after the current one completes (including bus retries), so ticks can never overrun or pile up.

## Repository-checker warnings

- **Standard CI / testing (W3015, W3017):** the workflow now uses the standard ioBroker actions with **no `continue-on-error`** — `testing-action-check` (type-check + lint), `testing-action-adapter` on {ubuntu, windows, macos} × Node {22, 24}, and `testing-action-deploy` (npm publish + GitHub release). Standard `@iobroker/testing` package + integration tests were added (`test:package`, `test:integration`); unit tests run via Vitest.
- **`@iobroker/eslint-config` (W0062, W0072, S0071):** migrated. ESLint 8 and the separate `@typescript-eslint/*` packages were dropped in favour of the shared flat config.
- **README language / state names:** README is English; state ids/names are English (ids come straight from the HeishaMon protocol topics).

### Won't-fix / commented (non-blocking)

- **W0062 `@alcalzone/release-script`, `@iobroker/adapter-dev`:** not used by design — the release runs through the standard `testing-action-deploy`.
- **W0083 `serialport` 12→13, `typescript` 5→6, `vitest` 1→4:** evaluated and deferred to a follow-up release; these are major bumps on the core hardware dependency / toolchain and I want to verify them against the real heat pump first.
- **W5051 (custom sleep in `wire-queue.ts`):** false positive — the `sleep` is an injectable seam; `main.ts` supplies the base-class `this.delay(ms)` at runtime, and the tests inject a deterministic fake. Calling `this.delay()` directly inside the pure module would break test determinism.

The adapter is published as **v0.0.12** and a fresh object dump from a running installation is attached. From my side everything requested has been addressed — **ready for re-review.** Thanks again!
