import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFrame } from 'heishamon-protocol';

import { Poller } from '../src/poller.js';
import type { AdapterTransport } from '../src/transport.js';

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
    readonly setInterval: (fn: () => void, ms: number) => number;
    readonly clearInterval: (handle: number) => void;
  };
  readonly tick: () => void;
  readonly hasActiveTimer: () => boolean;
}

function createFakeTimerHarness(): FakeTimerHarness {
  const callbacks = new Map<number, () => void>();
  let nextId = 1;

  return {
    timers: {
      setInterval: (fn) => {
        const id = nextId++;
        callbacks.set(id, fn);
        return id;
      },
      clearInterval: (handle) => {
        callbacks.delete(handle);
      },
    },
    tick: () => {
      for (const fn of callbacks.values()) {
        fn();
      }
    },
    hasActiveTimer: () => callbacks.size > 0,
  };
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
    await Promise.resolve();

    expect(transport.sent.length).toBe(1);
    expect(bytesEqual(transport.sent[0]!, mainPollFrame)).toBe(true);

    poller.stop();
  });

  it('keeps sending mainPoll every tick when extraPollEnabled is false', async () => {
    const harness = createFakeTimerHarness();
    const poller = new Poller({
      pollIntervalMs: 5000,
      extraPollEnabled: false,
      transport,
      timers: harness.timers,
    });

    poller.start();
    harness.tick();
    harness.tick();
    await Promise.resolve();

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

    poller.start();        // tick 1 -> main
    harness.tick();        // tick 2 -> extra
    harness.tick();        // tick 3 -> main
    harness.tick();        // tick 4 -> extra
    await Promise.resolve();

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
    await Promise.resolve();
    poller.stop();

    expect(harness.hasActiveTimer()).toBe(false);
    const sentBeforeTick = transport.sent.length;
    harness.tick(); // no-op: callbacks were cleared
    await Promise.resolve();
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
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(log).toHaveBeenCalledWith('error', expect.stringContaining('boom'));

    // The next tick should still go through.
    harness.tick();
    await Promise.resolve();
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
    await Promise.resolve();

    // Only one immediate send from the first start().
    expect(transport.sent.length).toBe(1);

    harness.tick();
    await Promise.resolve();
    // One additional send from the single registered interval.
    expect(transport.sent.length).toBe(2);

    poller.stop();
  });
});
