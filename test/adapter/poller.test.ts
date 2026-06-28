import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFrame } from '../../src/protocol/index.js';

import { Poller } from '../../src/poller.js';
import type { AdapterTransport } from '../../src/transport.js';

class FakeTransport implements AdapterTransport {
  sent: Uint8Array[] = [];
  failNext = false;

  async open(): Promise<void> {}
  async send(frame: Uint8Array): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('boom');
    }
    this.sent.push(frame);
  }
  async close(): Promise<void> {}
}

interface FakeTimerHarness {
  readonly timers: {
    readonly setTimeout: (fn: () => void, ms: number) => unknown;
    readonly clearTimeout: (handle: unknown) => void;
  };
  /** Fire the single pending one-shot timer (the scheduled next cycle). */
  readonly fire: () => void;
  readonly hasActiveTimer: () => boolean;
}

/**
 * Models a one-shot timer: at most one is pending at a time (the poller
 * schedules the next cycle only at the end of the current one). `fire()`
 * runs and consumes it, mirroring real `setTimeout` semantics.
 */
function createFakeTimerHarness(): FakeTimerHarness {
  let pending: { id: number; fn: () => void } | null = null;
  let nextId = 1;

  return {
    timers: {
      setTimeout: (fn) => {
        const id = nextId++;
        pending = { id, fn };
        return id;
      },
      clearTimeout: (handle) => {
        if (pending !== null && pending.id === handle) {
          pending = null;
        }
      },
    },
    fire: () => {
      if (pending !== null) {
        const { fn } = pending;
        pending = null;
        fn();
      }
    },
    hasActiveTimer: () => pending !== null,
  };
}

/** Drain microtasks so the end-of-tick reschedule (an awaited send) settles. */
function flush(): Promise<void> {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

describe('Poller', () => {
  const mainPollFrame = buildFrame('mainPoll');
  const extraPollFrame = buildFrame('extraPoll');

  let transport: FakeTransport;

  beforeEach(() => {
    transport = new FakeTransport();
  });

  it('sends mainPoll synchronously on start()', async () => {
    const harness = createFakeTimerHarness();
    const poller = new Poller({
      pollIntervalMs: 5000,
      extraPollEnabled: false,
      transport,
      timers: harness.timers,
    });

    poller.start();
    // Allow the queued micro-tasks from the synchronous send() to settle.
    await flush();

    expect(transport.sent.length).toBe(1);
    expect(bytesEqual(transport.sent[0]!, mainPollFrame)).toBe(true);

    poller.stop();
  });

  it('keeps sending mainPoll every cycle when extraPollEnabled is false', async () => {
    const harness = createFakeTimerHarness();
    const poller = new Poller({
      pollIntervalMs: 5000,
      extraPollEnabled: false,
      transport,
      timers: harness.timers,
    });

    poller.start();
    await flush();
    harness.fire();
    await flush();
    harness.fire();
    await flush();

    expect(transport.sent.length).toBe(3);
    for (const sent of transport.sent) {
      expect(bytesEqual(sent, mainPollFrame)).toBe(true);
    }

    poller.stop();
  });

  it('alternates between mainPoll and extraPoll when extraPollEnabled is true', async () => {
    const harness = createFakeTimerHarness();
    const poller = new Poller({
      pollIntervalMs: 5000,
      extraPollEnabled: true,
      transport,
      timers: harness.timers,
    });

    poller.start();        // cycle 1 -> main
    await flush();
    harness.fire();        // cycle 2 -> extra
    await flush();
    harness.fire();        // cycle 3 -> main
    await flush();
    harness.fire();        // cycle 4 -> extra
    await flush();

    expect(transport.sent.length).toBe(4);
    expect(bytesEqual(transport.sent[0]!, mainPollFrame)).toBe(true);
    expect(bytesEqual(transport.sent[1]!, extraPollFrame)).toBe(true);
    expect(bytesEqual(transport.sent[2]!, mainPollFrame)).toBe(true);
    expect(bytesEqual(transport.sent[3]!, extraPollFrame)).toBe(true);

    poller.stop();
  });

  it('stop() prevents further ticks', async () => {
    const harness = createFakeTimerHarness();
    const poller = new Poller({
      pollIntervalMs: 5000,
      extraPollEnabled: false,
      transport,
      timers: harness.timers,
    });

    poller.start();
    await flush();
    poller.stop();

    expect(harness.hasActiveTimer()).toBe(false);
    const sentBeforeTick = transport.sent.length;
    harness.fire(); // no-op: the pending timer was cleared
    await flush();
    expect(transport.sent.length).toBe(sentBeforeTick);
  });

  it('logs an error and continues when send() rejects', async () => {
    const log = vi.fn();
    const harness = createFakeTimerHarness();
    transport.failNext = true;

    const poller = new Poller({
      pollIntervalMs: 5000,
      extraPollEnabled: false,
      transport,
      log,
      timers: harness.timers,
    });

    poller.start();
    // Wait for the rejected promise's catch handler to run.
    await flush();

    expect(log).toHaveBeenCalledWith('error', expect.stringContaining('boom'));

    // The next cycle should still go through.
    harness.fire();
    await flush();
    expect(transport.sent.length).toBe(1);
    expect(bytesEqual(transport.sent[0]!, mainPollFrame)).toBe(true);

    poller.stop();
  });

  it('stop() is a no-op when never started', () => {
    const harness = createFakeTimerHarness();
    const poller = new Poller({
      pollIntervalMs: 5000,
      extraPollEnabled: false,
      transport,
      timers: harness.timers,
    });

    expect(() => poller.stop()).not.toThrow();
    expect(harness.hasActiveTimer()).toBe(false);
  });

  it('fires onBeforeSend once per tick, before transport.send', async () => {
    const harness = createFakeTimerHarness();
    const order: string[] = [];

    const recordingTransport: AdapterTransport = {
      open: async () => {},
      send: async (frame: Uint8Array) => {
        order.push('send');
        transport.sent.push(frame);
      },
      close: async () => {},
    };

    const poller = new Poller({
      pollIntervalMs: 5000,
      extraPollEnabled: false,
      transport: recordingTransport,
      onBeforeSend: (frameType) => {
        order.push(`before:${frameType}`);
      },
      timers: harness.timers,
    });

    poller.start();
    await flush();
    harness.fire();
    await flush();

    expect(order).toEqual(['before:mainPoll', 'send', 'before:mainPoll', 'send']);

    poller.stop();
  });

  it('skips the send when onBeforeSend throws', async () => {
    const harness = createFakeTimerHarness();
    const log = vi.fn();

    const poller = new Poller({
      pollIntervalMs: 5000,
      extraPollEnabled: false,
      transport,
      log,
      onBeforeSend: () => {
        throw new Error('hook-boom');
      },
      timers: harness.timers,
    });

    poller.start();
    await flush();

    expect(transport.sent.length).toBe(0);
    expect(log).toHaveBeenCalledWith('error', expect.stringContaining('hook-boom'));

    poller.stop();
  });

  it('start() is idempotent — does not schedule a second timer', async () => {
    const harness = createFakeTimerHarness();
    const poller = new Poller({
      pollIntervalMs: 5000,
      extraPollEnabled: false,
      transport,
      timers: harness.timers,
    });

    poller.start();
    poller.start();
    await flush();

    // Only one immediate send from the first start().
    expect(transport.sent.length).toBe(1);

    harness.fire();
    await flush();
    // One additional send from the single scheduled cycle.
    expect(transport.sent.length).toBe(2);

    poller.stop();
  });
});
