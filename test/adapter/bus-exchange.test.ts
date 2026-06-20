import { describe, expect, it } from 'vitest';

import {
  BusExchange,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RESPONSE_TIMEOUT_MS,
  type ExchangeHooks,
  type ExchangeOutcome,
  type NowFn,
  type RandomFn,
  type SleepFn,
} from '../../src/bus-exchange.js';

/** Local alias so the `settled` accumulators read cleanly. */
type ExchangeOutcomeT = ExchangeOutcome;

/**
 * Deterministic clock for BusExchange tests.
 *
 * Unlike the WireQueue clock, sleeps here do NOT auto-resolve: the response
 * gate races a sleep against an external `onResponse()`, so the test must
 * control which side wins. Every requested sleep is parked and exposed via
 * `pending`; the test resolves it explicitly to simulate a timeout firing,
 * or leaves it parked (and instead calls `onResponse()`) to simulate a
 * reply arriving first. `gaps` records every requested duration in order.
 */
function createClock(): {
  sleep: SleepFn;
  now: NowFn;
  gaps: number[];
  pending: Array<() => void>;
  resolveNext: () => void;
} {
  const gaps: number[] = [];
  const pending: Array<() => void> = [];
  let virtualNow = 0;
  const sleep: SleepFn = (ms) => {
    gaps.push(ms);
    virtualNow += ms;
    return new Promise<void>((resolve) => {
      pending.push(resolve);
    });
  };
  const now: NowFn = () => virtualNow;
  const resolveNext = (): void => {
    const next = pending.shift();
    if (next !== undefined) {
      next();
    }
  };
  return { sleep, now, gaps, pending, resolveNext };
}

/** Fixed-value RNG so the random backoff is deterministic. */
function fixedRandom(value: number): RandomFn {
  return () => value;
}

/** No-op sleep for tests that never drive the timeout/backoff race. */
const noopSleep: SleepFn = () => Promise.resolve();

/** Flush all currently-queued microtasks so awaited continuations run. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
}

describe('BusExchange — construction & validation', () => {
  it('throws when send is not a function', () => {
    // @ts-expect-error intentional bad input
    expect(() => new BusExchange({ send: undefined, sleep: noopSleep })).toThrow();
  });

  it('throws on a non-positive responseTimeoutMs', () => {
    const send = async (): Promise<void> => {};
    expect(() => new BusExchange({ send, responseTimeoutMs: 0, sleep: noopSleep })).toThrow();
    expect(() => new BusExchange({ send, responseTimeoutMs: -5, sleep: noopSleep })).toThrow();
    expect(
      () => new BusExchange({ send, responseTimeoutMs: Number.NaN, sleep: noopSleep }),
    ).toThrow();
  });

  it('throws on a bad maxRetries', () => {
    const send = async (): Promise<void> => {};
    expect(() => new BusExchange({ send, maxRetries: -1, sleep: noopSleep })).toThrow();
    expect(() => new BusExchange({ send, maxRetries: 1.5, sleep: noopSleep })).toThrow();
    expect(() => new BusExchange({ send, maxRetries: Number.NaN, sleep: noopSleep })).toThrow();
  });

  it('throws on negative or inverted CRC backoff bounds', () => {
    const send = async (): Promise<void> => {};
    expect(() => new BusExchange({ send, crcBackoffMinMs: -1, sleep: noopSleep })).toThrow();
    expect(
      () => new BusExchange({ send, crcBackoffMinMs: 200, crcBackoffMaxMs: 100, sleep: noopSleep }),
    ).toThrow();
  });

  it('accepts defaults and exposes them as constants', () => {
    expect(DEFAULT_RESPONSE_TIMEOUT_MS).toBe(1000);
    expect(DEFAULT_MAX_RETRIES).toBe(3);
    const send = async (): Promise<void> => {};
    expect(() => new BusExchange({ send, sleep: noopSleep })).not.toThrow();
  });
});

describe('BusExchange — runExchange', () => {
  const frame = new Uint8Array([0x71, 0x01, 0x02]);

  it('succeeds on the first attempt when a reply arrives before the timeout', async () => {
    const { sleep, now } = createClock();
    const sends: Uint8Array[] = [];
    const exchange = new BusExchange({
      // The reply arrives "during" the send: resolve the gate synchronously
      // so the timeout sleep never wins.
      send: async (f) => {
        sends.push(f);
        exchange.onResponse();
      },
      sleep,
      now,
    });

    const outcome = await exchange.runExchange(frame, 'poll');
    expect(outcome).toEqual({ ok: true, attempts: 1 });
    expect(sends).toHaveLength(1);
  });

  it('retries on timeout and succeeds on the third attempt', async () => {
    const { sleep, now, pending, resolveNext } = createClock();
    let sendCount = 0;
    let settled: ExchangeOutcomeT | null = null;
    const exchange = new BusExchange({
      send: async () => {
        sendCount += 1;
        // First two sends: no reply (let the timeout win). Third: reply.
        if (sendCount >= 3) {
          exchange.onResponse();
        }
      },
      sleep,
      now,
    });

    void exchange.runExchange(frame, 'poll').then((o) => {
      settled = o;
    });

    // Drive the two timeout sleeps so the loop advances to attempt 3.
    while (settled === null) {
      await flush();
      if (pending.length > 0) {
        resolveNext();
      } else {
        break;
      }
    }
    await flush();
    expect(settled).toEqual({ ok: true, attempts: 3 });
    expect(sendCount).toBe(3);
  });

  it('gives up after maxRetries+1 sends when no reply ever arrives', async () => {
    const { sleep, now, pending, resolveNext } = createClock();
    let sendCount = 0;
    let settled: ExchangeOutcomeT | null = null;
    const exchange = new BusExchange({
      send: async () => {
        sendCount += 1;
      },
      maxRetries: 3,
      sleep,
      now,
    });

    void exchange.runExchange(frame, 'poll').then((o) => {
      settled = o;
    });

    while (settled === null) {
      await flush();
      if (pending.length > 0) {
        resolveNext();
      } else {
        break;
      }
    }
    await flush();
    expect(settled).toEqual({ ok: false, attempts: 4 });
    expect(sendCount).toBe(4);
  });

  it('makes at most one send with maxRetries=0', async () => {
    const { sleep, now, pending, resolveNext } = createClock();
    let sendCount = 0;
    let settled: ExchangeOutcomeT | null = null;
    const exchange = new BusExchange({
      send: async () => {
        sendCount += 1;
      },
      maxRetries: 0,
      sleep,
      now,
    });

    void exchange.runExchange(frame, 'poll').then((o) => {
      settled = o;
    });

    while (settled === null) {
      await flush();
      if (pending.length > 0) {
        resolveNext();
      } else {
        break;
      }
    }
    await flush();
    expect(settled).toEqual({ ok: false, attempts: 1 });
    expect(sendCount).toBe(1);
  });

  it('inserts a CRC backoff within [min,max] before the next send, once', async () => {
    const { sleep, now, gaps, resolveNext } = createClock();
    let sendCount = 0;
    const exchange = new BusExchange({
      send: async () => {
        sendCount += 1;
        // Reply on the second attempt so we stop after one backoff.
        if (sendCount >= 2) {
          exchange.onResponse();
        }
      },
      crcBackoffMinMs: 50,
      crcBackoffMaxMs: 300,
      // 0.5 -> 50 + 0.5*250 = 175 ms.
      random: fixedRandom(0.5),
      sleep,
      now,
    });

    // Trigger onCrcError mid-flight: after attempt 1 times out the next send
    // must be preceded by exactly one randomised backoff sleep.
    let settled: ExchangeOutcomeT | null = null;
    void exchange.runExchange(frame, 'poll').then((o) => {
      settled = o;
    });

    // Attempt 1: send #1 parks a timeout sleep. Arm CRC, fire the timeout.
    await flush();
    exchange.onCrcError();
    resolveNext(); // attempt-1 timeout fires
    // Attempt 2 begins with the backoff sleep — release it so send #2 runs.
    await flush();
    resolveNext(); // backoff sleep fires -> send #2 -> onResponse
    await flush();

    expect(settled).not.toBeNull();
    expect((settled as ExchangeOutcomeT).ok).toBe(true);
    // gaps: [timeout(1000), backoff(175), ...]; backoff present exactly once.
    expect(gaps).toContain(175);
    expect(gaps.filter((g) => g === 175)).toHaveLength(1);
  });

  it('treats onResponse() with no open gate as a no-op', () => {
    const exchange = new BusExchange({ send: async (): Promise<void> => {}, sleep: noopSleep });
    expect(() => exchange.onResponse()).not.toThrow();
  });

  it('treats onCrcError() with no exchange in flight as a no-op', () => {
    const exchange = new BusExchange({ send: async (): Promise<void> => {}, sleep: noopSleep });
    expect(() => exchange.onCrcError()).not.toThrow();
  });

  it('does not let a late onResponse after a timeout corrupt the next attempt', async () => {
    const { sleep, now, resolveNext } = createClock();
    let sendCount = 0;
    const exchange = new BusExchange({
      send: async () => {
        sendCount += 1;
        if (sendCount >= 2) {
          exchange.onResponse();
        }
      },
      sleep,
      now,
    });

    let settled: ExchangeOutcomeT | null = null;
    void exchange.runExchange(frame, 'poll').then((o) => {
      settled = o;
    });

    // Attempt 1: send #1 (no reply), timeout parked. Fire it and let the
    // timeout handler run (it nulls the gate) BEFORE the stale onResponse.
    await flush();
    resolveNext(); // attempt-1 timeout fires
    await flush(); // let the timeout handler null the gate
    // A late reply for attempt 1 arrives now — must be a harmless no-op
    // (the gate for attempt 2 has not been opened yet at this microtask).
    exchange.onResponse();
    await flush(); // attempt 2 send #2 -> onResponse resolves it

    expect(settled).toEqual({ ok: true, attempts: 2 });
    expect(sendCount).toBe(2);
  });

  it('invokes onSend before every attempt and onTimeout on each timeout', async () => {
    const { sleep, now, pending, resolveNext } = createClock();
    let sendCount = 0;
    const sends: number[] = [];
    const timeouts: number[] = [];
    const hooks: ExchangeHooks = {
      onSend: (attempt) => sends.push(attempt),
      onTimeout: (attempt) => timeouts.push(attempt),
    };
    const exchange = new BusExchange({
      send: async () => {
        sendCount += 1;
        if (sendCount >= 3) {
          exchange.onResponse();
        }
      },
      sleep,
      now,
    });

    let settled: ExchangeOutcomeT | null = null;
    void exchange.runExchange(frame, 'poll', hooks).then((o) => {
      settled = o;
    });

    while (settled === null) {
      await flush();
      if (pending.length > 0) {
        resolveNext();
      } else {
        break;
      }
    }
    await flush();
    expect(settled).toEqual({ ok: true, attempts: 3 });
    expect(sends).toEqual([1, 2, 3]);
    expect(timeouts).toEqual([1, 2]);
  });

  it('propagates a throwing send to the caller', async () => {
    const exchange = new BusExchange({
      send: async () => {
        throw new Error('write failed');
      },
      sleep: noopSleep,
    });
    await expect(exchange.runExchange(frame, 'poll')).rejects.toThrow('write failed');
  });
});
