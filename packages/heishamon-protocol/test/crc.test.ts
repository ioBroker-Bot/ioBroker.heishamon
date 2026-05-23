import { describe, expect, it } from 'vitest';

import { computeChecksum, verifyFrame } from '../src/crc.js';
import vectors from './fixtures/checksum-vectors.json' with { type: 'json' };

interface ChecksumVector {
  readonly description: string;
  readonly frameHex: string;
}

const fixtures: readonly ChecksumVector[] = vectors;

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`hex string has odd length: ${hex.length}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`invalid hex pair at offset ${i * 2}: ${hex.slice(i * 2, i * 2 + 2)}`);
    }
    out[i] = byte;
  }
  return out;
}

describe('computeChecksum', () => {
  it('returns 0 for an empty payload', () => {
    expect(computeChecksum(new Uint8Array(0))).toBe(0);
  });

  it('returns 0 for a single zero byte', () => {
    expect(computeChecksum(Uint8Array.of(0x00))).toBe(0);
  });

  it('returns 1 for a single 0xFF byte (two\'s complement of 255)', () => {
    expect(computeChecksum(Uint8Array.of(0xff))).toBe(1);
  });

  it('returns 0 when the payload sum is exactly 256', () => {
    expect(computeChecksum(Uint8Array.of(0x80, 0x80))).toBe(0);
  });

  it('returns 0x12 for the documented [0x71, 0x6C, 0x01, 0x10] payload', () => {
    expect(computeChecksum(Uint8Array.of(0x71, 0x6c, 0x01, 0x10))).toBe(0x12);
  });
});

describe('verifyFrame', () => {
  // Mathematically the sum over zero bytes is zero, so an empty frame
  // is "valid". This will never occur in practice (a real CN-CNT frame
  // is at least the 4-byte header plus one checksum byte), but we
  // assert the mathematical contract here to avoid surprising callers.
  it('accepts an empty frame (vacuously valid)', () => {
    expect(verifyFrame(new Uint8Array(0))).toBe(true);
  });

  it.each(fixtures)('accepts fixture frame: $description', ({ frameHex }) => {
    const frame = hexToBytes(frameHex);
    expect(verifyFrame(frame)).toBe(true);
  });

  it('rejects a frame with a single flipped bit', () => {
    const firstFixture = fixtures[0];
    if (firstFixture === undefined) {
      throw new Error('fixture file is empty');
    }
    const frame = hexToBytes(firstFixture.frameHex);
    // Flip the lowest bit of an arbitrary middle byte. The flip must
    // change the 8-bit sum by an odd number, guaranteeing detection.
    const flipIndex = Math.floor(frame.length / 2);
    const original = frame[flipIndex];
    if (original === undefined) {
      throw new Error('frame too short to flip a middle byte');
    }
    frame[flipIndex] = original ^ 0x01;
    expect(verifyFrame(frame)).toBe(false);
  });
});

describe('round-trip', () => {
  // Pick three fixtures from across the file (start, middle, end) so we
  // exercise different frame shapes without depending on a real RNG.
  const sampleIndices = [0, Math.floor(fixtures.length / 2), fixtures.length - 1];
  const samples = sampleIndices
    .map((index) => fixtures[index])
    .filter((vector): vector is ChecksumVector => vector !== undefined);

  it.each(samples)(
    'computeChecksum reproduces the trailing byte of fixture: $description',
    ({ frameHex }) => {
      const frame = hexToBytes(frameHex);
      expect(frame.length).toBeGreaterThan(0);
      const payload = frame.subarray(0, frame.length - 1);
      const expected = frame[frame.length - 1];
      const computed = computeChecksum(payload);
      expect(computed).toBe(expected);

      const reconstructed = new Uint8Array(frame.length);
      reconstructed.set(payload, 0);
      reconstructed[frame.length - 1] = computed;
      expect(reconstructed).toEqual(frame);
      expect(verifyFrame(reconstructed)).toBe(true);
    },
  );
});
