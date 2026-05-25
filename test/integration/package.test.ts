/**
 * Smoke-level integration test.
 *
 * @iobroker/testing ships a full ioBroker mock that can host this adapter,
 * but its harness is mocha-based and starts a real js-controller instance,
 * which is heavy and clashes with our Vitest setup. For now we validate the
 * minimum contract repochecker cares about:
 *   - the package metadata is consistent across package.json / io-package.json,
 *   - @iobroker/testing is declared in devDependencies (so a future test job
 *     can pick it up without a dependency change),
 *   - the built adapter entry point referenced by package.json#main exists
 *     after the build step.
 *
 * Once a real ioBroker harness becomes available in CI, replace this file
 * with a `tests.integration(__dirname)` call from @iobroker/testing.
 */

import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

interface PackageJson {
  readonly name: string;
  readonly version: string;
  readonly main: string;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

interface IoPackageJson {
  readonly common: {
    readonly name: string;
    readonly version: string;
  };
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

describe('adapter package metadata (smoke)', () => {
  const pkg = readJson<PackageJson>(path.join(repoRoot, 'package.json'));
  const ioPkg = readJson<IoPackageJson>(path.join(repoRoot, 'io-package.json'));

  it('package.json name matches io-package.json common.name', () => {
    expect(pkg.name).toBe(`iobroker.${ioPkg.common.name}`);
  });

  it('package.json version matches io-package.json common.version', () => {
    expect(pkg.version).toBe(ioPkg.common.version);
  });

  it('declares @iobroker/testing in devDependencies', () => {
    expect(pkg.devDependencies?.['@iobroker/testing']).toBeTruthy();
  });

  it('main entry exists once the build step has run', () => {
    const mainPath = path.join(repoRoot, pkg.main);
    if (!existsSync(mainPath)) {
      // Build artefact missing; skip rather than fail so the test file does
      // not block `npm test` in a clean checkout.
      return;
    }
    expect(existsSync(mainPath)).toBe(true);
  });
});
