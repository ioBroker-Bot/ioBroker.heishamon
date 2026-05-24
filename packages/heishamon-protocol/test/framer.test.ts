/**
 * Tests for the byte-stream framer.
 *
 * The framer accumulates bytes arriving in arbitrary chunks and emits one
 * event per complete, header-recognised, checksum-validated frame — plus
 * `invalid` events for any byte it had to discard in order to resync. The
 * tests cover the happy path, chunk-boundary splits and combinations, two
 * flavours of noise (unknown header, bad checksum), truncation, reset and
 * every concrete frame type.
 */

import { describe, expect, it } from 'vitest';

import { computeChecksum } from '../src/crc.js';
import { Framer, type FramerEvent } from '../src/framer.js';
import { FRAME_LENGTHS, buildFrame, type FrameType } from '../src/frames.js';

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, part) => acc + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function frameEvents(events: readonly FramerEvent[]): readonly Extract<FramerEvent, { kind: 'frame' }>[] {
  return events.filter((event): event is Extract<FramerEvent, { kind: 'frame' }> => event.kind === 'frame');
}

function invalidEvents(events: readonly FramerEvent[]): readonly Extract<FramerEvent, { kind: 'invalid' }>[] {
  return events.filter((event): event is Extract<FramerEvent, { kind: 'invalid' }> => event.kind === 'invalid');
}

/**
 * Hand-build a checksum-valid `mainResponse` / `extraResponse` frame.
 * `buildFrame` refuses to build these (they are emitted by the heat pump,
 * not the master), so the framer test has to synthesise them itself.
 */
function buildResponseFrame(type: 'mainResponse' | 'extraResponse'): Uint8Array {
  const length = FRAME_LENGTHS[type];
  const payload = new Uint8Array(length - 1);
  const header: Record<typeof type, readonly [number, number, number, number]> = {
    mainResponse: [0x71, 0xc8, 0x01, 0x10],
    extraResponse: [0x71, 0xc8, 0x01, 0x21],
  };
  payload.set(header[type], 0);

  const frame = new Uint8Array(length);
  frame.set(payload, 0);
  frame[length - 1] = computeChecksum(payload);
  return frame;
}

describe('Framer', () => {
  it('emits one frame event when a complete frame arrives in one chunk', () => {
    const framer = new Framer();
    const frame = buildFrame('mainPoll');

    const events = framer.push(frame);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'frame', frameType: 'mainPoll', frame });
  });

  it('buffers across chunks and emits the frame only when the last byte arrives', () => {
    const framer = new Framer();
    const frame = buildFrame('mainPoll');
    const part1 = frame.slice(0, 4);
    const part2 = frame.slice(4, 50);
    const part3 = frame.slice(50);

    expect(framer.push(part1)).toEqual([]);
    expect(framer.push(part2)).toEqual([]);

    const events = framer.push(part3);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'frame', frameType: 'mainPoll' });
    expect(Array.from((events[0] as { frame: Uint8Array }).frame)).toEqual(Array.from(frame));
  });

  it('emits two frame events when two frames arrive concatenated in one chunk', () => {
    const framer = new Framer();
    const a = buildFrame('mainPoll');
    const b = buildFrame('optionalPcbPoll');

    const events = framer.push(concat(a, b));

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: 'frame', frameType: 'mainPoll' });
    expect(events[1]).toMatchObject({ kind: 'frame', frameType: 'optionalPcbPoll' });
  });

  it('discards leading garbage bytes one at a time and then emits the frame', () => {
    const framer = new Framer();
    const frame = buildFrame('mainPoll');
    const garbage = new Uint8Array([0x00, 0x00, 0x00]);

    const events = framer.push(concat(garbage, frame));

    const invalids = invalidEvents(events);
    const frames = frameEvents(events);

    expect(invalids).toHaveLength(3);
    for (const invalid of invalids) {
      expect(invalid.reason).toBe('unknownHeader');
      expect(invalid.bytes).toHaveLength(1);
      expect(invalid.bytes[0]).toBe(0x00);
    }
    expect(frames).toHaveLength(1);
    expect(frames[0].frameType).toBe('mainPoll');
    expect(Array.from(frames[0].frame)).toEqual(Array.from(frame));
  });

  it('flags a corrupted checksum as invalid and resyncs one byte at a time', () => {
    const framer = new Framer();
    const frame = buildFrame('mainPoll');
    const corrupted = new Uint8Array(frame);
    // Flip the trailing checksum byte: header still matches mainPoll but
    // verifyFrame returns false.
    corrupted[corrupted.length - 1] = (corrupted[corrupted.length - 1] ^ 0xff) & 0xff;

    const events = framer.push(corrupted);

    const invalids = invalidEvents(events);
    const frames = frameEvents(events);

    // At least one invalid event with reason 'checksum' for the dropped
    // first byte. The remaining bytes don't form a valid frame either,
    // so they trickle out as further `unknownHeader` invalids — we only
    // assert on the first invalid being the checksum failure.
    expect(invalids.length).toBeGreaterThanOrEqual(1);
    expect(invalids[0].reason).toBe('checksum');
    expect(invalids[0].bytes).toEqual(new Uint8Array([corrupted[0]]));
    expect(frames).toHaveLength(0);
  });

  it('returns no events while fewer than 4 bytes are buffered', () => {
    const framer = new Framer();

    const events = framer.push(new Uint8Array([0x71, 0x6c, 0x01]));

    expect(events).toEqual([]);
  });

  it('reset() discards a half-received frame so the next push starts fresh', () => {
    const framer = new Framer();
    const frame = buildFrame('mainPoll');

    framer.push(frame.slice(0, 10));
    framer.reset();

    const events = framer.push(frame);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'frame', frameType: 'mainPoll' });
  });

  describe('identifies every frame type', () => {
    const buildable: readonly Exclude<FrameType, 'mainResponse' | 'extraResponse'>[] = [
      'initialHandshake',
      'mainPoll',
      'extraPoll',
      'mainSet',
      'optionalPcbPoll',
    ];

    for (const type of buildable) {
      it(type, () => {
        const framer = new Framer();
        const frame = buildFrame(type);

        const events = framer.push(frame);

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ kind: 'frame', frameType: type });
      });
    }

    for (const type of ['mainResponse', 'extraResponse'] as const) {
      it(type, () => {
        const framer = new Framer();
        const frame = buildResponseFrame(type);

        const events = framer.push(frame);

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ kind: 'frame', frameType: type });
      });
    }
  });
});
