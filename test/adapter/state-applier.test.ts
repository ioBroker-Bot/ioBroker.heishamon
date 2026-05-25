import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { EXTRA_DATAPOINTS, MAIN_DATAPOINTS } from '../../src/protocol/index.js';

import { StateApplier } from '../../src/state-applier.js';

/**
 * Real mainResponse frame captured by HeishaMon upstream. Source:
 * `vendor/heishamon-upstream/Tools/chksumChecker.js`, packet with desc 'ans'.
 *
 * 203 bytes including the 4-byte header (`71 c8 01 10`) and trailing checksum.
 */
const MAIN_RESPONSE_HEX =
  '71c801105655624900050000000000000000000019151155165e550509000000000000000000808f808ab27171979900000000000000000000008085158a8585d07b781f7e1f1f79798d8d9e96718fb7a37b8f8e85808f8a949e8a8a949e82908b056578c10b00000000000000005556552153155a051212190000000000000000e2ce0d718172ce0c9281b000aa7cabb032329cb632323280b7afcd9aac79807780ff9101295900003b0b1c51590136790101c30200dd02000500000100000601010101010a1400000077';

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

function buildExtraResponseFrame(): Uint8Array {
  // The decoder reads up to byte 197 (XTOP5 + 1). 203 bytes total with a
  // valid `71 c8 01 21` header is enough to satisfy `decodeExtraFrame`.
  const frame = new Uint8Array(203);
  frame[0] = 0x71;
  frame[1] = 0xc8;
  frame[2] = 0x01;
  frame[3] = 0x21;
  // Fill the XTOP offsets with non-zero data so the assertions don't depend
  // on a default-zero result.
  for (const datapoint of EXTRA_DATAPOINTS) {
    frame[datapoint.byte] = 0x12;
    frame[datapoint.byte + 1] = 0x34;
  }
  return frame;
}

describe('StateApplier.applyMainResponse', () => {
  it('writes every main datapoint to ioBroker via setState', async () => {
    const frame = hexToBytes(MAIN_RESPONSE_HEX);
    expect(frame.length).toBe(203);

    const setState = vi.fn();
    const applier = new StateApplier({ setState });

    await applier.applyMainResponse(frame);

    expect(setState).toHaveBeenCalledTimes(MAIN_DATAPOINTS.length);
    expect(MAIN_DATAPOINTS.length).toBe(144);

    const ids = new Set(setState.mock.calls.map((call) => call[0]));
    expect(ids.has('main.Heatpump_State')).toBe(true);
    expect(ids.has('main.Outside_Temp')).toBe(true);
    expect(ids.has('main.Operating_Mode_State')).toBe(true);
    expect(ids.size).toBe(MAIN_DATAPOINTS.length);

    // Every call uses ack=true.
    for (const call of setState.mock.calls) {
      expect(call[2]).toBe(true);
    }
  });

  it('logs an error and skips when frame length is wrong', async () => {
    const setState = vi.fn();
    const log = vi.fn();
    const applier = new StateApplier({ setState, log });

    await applier.applyMainResponse(new Uint8Array(10));

    expect(setState).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('error', expect.stringContaining('203 bytes'));
  });

  it('logs a warning when an individual setState rejects but writes the rest', async () => {
    const frame = hexToBytes(MAIN_RESPONSE_HEX);
    const failingId = 'main.Outside_Temp';
    const log = vi.fn();
    const setState = vi.fn(async (id: string) => {
      if (id === failingId) {
        throw new Error('boom');
      }
    });
    const applier = new StateApplier({ setState, log });

    await applier.applyMainResponse(frame);

    expect(setState).toHaveBeenCalledTimes(MAIN_DATAPOINTS.length);
    expect(log).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining(`setState ${failingId} failed`),
    );
  });
});

describe('StateApplier.applyExtraResponse', () => {
  it('writes every extra datapoint to ioBroker via setState', async () => {
    const frame = buildExtraResponseFrame();
    const setState = vi.fn();
    const applier = new StateApplier({ setState });

    await applier.applyExtraResponse(frame);

    expect(setState).toHaveBeenCalledTimes(EXTRA_DATAPOINTS.length);
    const ids = new Set(setState.mock.calls.map((call) => call[0]));
    for (const datapoint of EXTRA_DATAPOINTS) {
      expect(ids.has(`extra.${datapoint.name}`)).toBe(true);
    }
  });

  it('logs an error and skips when frame length is wrong', async () => {
    const setState = vi.fn();
    const log = vi.fn();
    const applier = new StateApplier({ setState, log });

    await applier.applyExtraResponse(new Uint8Array(10));

    expect(setState).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('error', expect.stringContaining('203 bytes'));
  });
});
