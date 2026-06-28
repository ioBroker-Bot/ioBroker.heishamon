import { describe, expect, it } from 'vitest';

import {
  WireQueue,
  WireQueueFullError,
  type NowFn,
  type SleepFn,
} from '../../src/wire-queue.js';

/**
 * Deterministic test harness: a virtual clock that advances exactly by the
 * `sleep()` durations the queue requests. Real wall-clock time is never read.
 */
function createClock(): {
  sleep: SleepFn;
  now: NowFn;
  gaps: number[];
  advance: (ms: number) => void;
} {
  const gaps: number[] = [];
  let virtualNow = 0;
  const sleep: SleepFn = (ms) => {
    gaps.push(ms);
    virtualNow += ms;
    return Promise.resolve();
  };
  const now: NowFn = () => virtualNow;
  const advance = (ms: number): void => {
    virtualNow += ms;
  };
  return { sleep, now, gaps, advance };
}

/** No-op sleep for tests that only exercise construction/validation. */
const noopSleep: SleepFn = () => Promise.resolve();

describe('WireQueue', () => {
  it('runs a single enqueued task and resolves the returned promise', async () => {
    const { sleep, now, gaps } = createClock();
    const queue = new WireQueue({ minSendGapMs: 100, sleep, now });

    let ran = false;
    await queue.enqueue(async () => {
      ran = true;
    });

    expect(ran).toBe(true);
    expect(gaps).toEqual([]);
  });

  it('runs multiple tasks in FIFO order', async () => {
    const { sleep, now } = createClock();
    const queue = new WireQueue({ minSendGapMs: 50, sleep, now });

    const order: number[] = [];
    await Promise.all([
      queue.enqueue(async () => {
        order.push(1);
      }),
      queue.enqueue(async () => {
        order.push(2);
      }),
      queue.enqueue(async () => {
        order.push(3);
      }),
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('serialises tasks — never runs two in parallel', async () => {
    const { sleep, now } = createClock();
    const queue = new WireQueue({ minSendGapMs: 0, sleep, now });

    let active = 0;
    let maxActive = 0;
    const makeTask = () => async (): Promise<void> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
    };

    await Promise.all([
      queue.enqueue(makeTask()),
      queue.enqueue(makeTask()),
      queue.enqueue(makeTask()),
      queue.enqueue(makeTask()),
    ]);

    expect(maxActive).toBe(1);
  });

  it('inserts the configured gap between successive tasks', async () => {
    const { sleep, now, gaps } = createClock();
    const queue = new WireQueue({ minSendGapMs: 200, sleep, now });

    await Promise.all([
      queue.enqueue(async () => {}),
      queue.enqueue(async () => {}),
      queue.enqueue(async () => {}),
    ]);

    // First task: no wait (lastSendCompletedAt = -Infinity).
    // Between #1 and #2: full 200 ms gap.
    // Between #2 and #3: full 200 ms gap.
    expect(gaps).toEqual([200, 200]);
  });

  it('does not insert a gap before the first task', async () => {
    const { sleep, now, gaps } = createClock();
    const queue = new WireQueue({ minSendGapMs: 500, sleep, now });

    await queue.enqueue(async () => {});

    expect(gaps).toEqual([]);
  });

  it('enforces the gap across queue-idle periods (the v0.0.5 fix)', async () => {
    // Regression test for the design bug in 0.0.3/0.0.4: the queue dropped
    // out of its drain loop between tasks, so a fresh enqueue right after
    // an idle period skipped the gap entirely.
    const { sleep, now, gaps } = createClock();
    const queue = new WireQueue({ minSendGapMs: 5000, sleep, now });

    await queue.enqueue(async () => {});
    // Queue went idle. Caller enqueues again much sooner than the gap.
    await queue.enqueue(async () => {});

    expect(gaps).toEqual([5000]);
  });

  it('does not wait if the configured gap has already elapsed', async () => {
    const { sleep, now, gaps, advance } = createClock();
    const queue = new WireQueue({ minSendGapMs: 1000, sleep, now });

    await queue.enqueue(async () => {});
    // Pretend a lot of real time passed.
    advance(10_000);
    await queue.enqueue(async () => {});

    expect(gaps).toEqual([]);
  });

  it('waits only the remaining time when partial gap has elapsed', async () => {
    const { sleep, now, gaps, advance } = createClock();
    const queue = new WireQueue({ minSendGapMs: 1000, sleep, now });

    await queue.enqueue(async () => {});
    // 300 ms have passed in the meantime.
    advance(300);
    await queue.enqueue(async () => {});

    // Remaining gap = 1000 - 300 = 700 ms.
    expect(gaps).toEqual([700]);
  });

  it('rejects the caller promise when the task throws but keeps the queue running', async () => {
    const { sleep, now } = createClock();
    const queue = new WireQueue({ minSendGapMs: 0, sleep, now });

    const order: string[] = [];
    const failing = queue.enqueue(async () => {
      order.push('failing');
      throw new Error('boom');
    });
    const after = queue.enqueue(async () => {
      order.push('after');
    });

    await expect(failing).rejects.toThrow('boom');
    await expect(after).resolves.toBeUndefined();
    expect(order).toEqual(['failing', 'after']);
  });

  it('inserts the gap even after a failing task', async () => {
    const { sleep, now, gaps } = createClock();
    const queue = new WireQueue({ minSendGapMs: 300, sleep, now });

    const failing = queue.enqueue(async () => {
      throw new Error('nope');
    });
    const after = queue.enqueue(async () => {});

    await expect(failing).rejects.toThrow('nope');
    await after;

    expect(gaps).toEqual([300]);
  });

  it('reports pendingCount correctly before, during and after execution', async () => {
    const { sleep, now } = createClock();
    const queue = new WireQueue({ minSendGapMs: 0, sleep, now });

    expect(queue.pendingCount()).toBe(0);

    let release = (): void => {};
    const block = new Promise<void>((resolve) => {
      release = resolve;
    });

    const p1 = queue.enqueue(async () => {
      await block;
    });
    const p2 = queue.enqueue(async () => {});
    const p3 = queue.enqueue(async () => {});

    await Promise.resolve();
    expect(queue.pendingCount()).toBe(2);

    release();
    await Promise.all([p1, p2, p3]);
    expect(queue.pendingCount()).toBe(0);
  });

  it('with minSendGapMs=0 does not request any sleeps but still runs FIFO', async () => {
    const { sleep, now, gaps } = createClock();
    const queue = new WireQueue({ minSendGapMs: 0, sleep, now });

    const order: number[] = [];
    await Promise.all([
      queue.enqueue(async () => {
        order.push(1);
      }),
      queue.enqueue(async () => {
        order.push(2);
      }),
      queue.enqueue(async () => {
        order.push(3);
      }),
    ]);

    expect(order).toEqual([1, 2, 3]);
    expect(gaps).toEqual([]);
  });

  it('propagates the original error object to the caller', async () => {
    const { sleep, now } = createClock();
    const queue = new WireQueue({ minSendGapMs: 0, sleep, now });

    const sentinel = new Error('sentinel');
    await expect(
      queue.enqueue(async () => {
        throw sentinel;
      }),
    ).rejects.toBe(sentinel);
  });

  it('uses the injected sleep and default now (smoke test)', async () => {
    const { sleep } = createClock();
    const queue = new WireQueue({ minSendGapMs: 1, sleep });

    const order: number[] = [];
    await Promise.all([
      queue.enqueue(async () => {
        order.push(1);
      }),
      queue.enqueue(async () => {
        order.push(2);
      }),
    ]);

    expect(order).toEqual([1, 2]);
  });

  it('throws synchronously when minSendGapMs is negative', () => {
    expect(() => new WireQueue({ minSendGapMs: -1, sleep: noopSleep })).toThrow();
  });

  it('throws when minSendGapMs is not finite', () => {
    expect(() => new WireQueue({ minSendGapMs: Number.NaN, sleep: noopSleep })).toThrow();
    expect(
      () => new WireQueue({ minSendGapMs: Number.POSITIVE_INFINITY, sleep: noopSleep }),
    ).toThrow();
  });

  it('throws when minSendGapMs exceeds the Node.js timer ceiling', () => {
    expect(
      () => new WireQueue({ minSendGapMs: 2_147_483_648, sleep: noopSleep }),
    ).toThrow();
    // The exact ceiling is still accepted.
    expect(
      () => new WireQueue({ minSendGapMs: 2_147_483_647, sleep: noopSleep }),
    ).not.toThrow();
  });

  it('preserves FIFO order across a many-task burst', async () => {
    const { sleep, now } = createClock();
    const queue = new WireQueue({ minSendGapMs: 0, sleep, now });

    const order: number[] = [];
    const tasks: Array<Promise<void>> = [];
    for (let i = 0; i < 20; i++) {
      const value = i;
      tasks.push(
        queue.enqueue(async () => {
          await Promise.resolve();
          order.push(value);
        }),
      );
    }
    await Promise.all(tasks);

    expect(order).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('keeps draining when one of many tasks fails', async () => {
    const { sleep, now } = createClock();
    const queue = new WireQueue({ minSendGapMs: 0, sleep, now });

    const order: number[] = [];
    const results: Array<Promise<void>> = [];
    for (let i = 0; i < 5; i++) {
      const value = i;
      results.push(
        queue.enqueue(async () => {
          order.push(value);
          if (value === 2) throw new Error('mid-fail');
        }),
      );
    }
    const settled = await Promise.allSettled(results);

    expect(order).toEqual([0, 1, 2, 3, 4]);
    expect(settled[2]?.status).toBe('rejected');
    expect(settled[0]?.status).toBe('fulfilled');
    expect(settled[4]?.status).toBe('fulfilled');
  });

  describe('capacity cap', () => {
    it('rejects new enqueues with WireQueueFullError when capacity is exceeded', async () => {
      const { sleep, now } = createClock();
      const queue = new WireQueue({ minSendGapMs: 0, maxQueueSize: 3, sleep, now });

      // Block the running task so the others actually pile up.
      let release = (): void => {};
      const block = new Promise<void>((resolve) => {
        release = resolve;
      });

      const inflight = queue.enqueue(async () => {
        await block;
      });
      const a = queue.enqueue(async () => {});
      const b = queue.enqueue(async () => {});
      const c = queue.enqueue(async () => {});

      // Queue now has the running task (not counted) + 3 pending = at capacity.
      expect(queue.pendingCount()).toBe(3);

      const rejected = queue.enqueue(async () => {});
      await expect(rejected).rejects.toBeInstanceOf(WireQueueFullError);

      release();
      await Promise.all([inflight, a, b, c]);
    });

    it('accepts new enqueues again after the queue drained below capacity', async () => {
      const { sleep, now } = createClock();
      const queue = new WireQueue({ minSendGapMs: 0, maxQueueSize: 2, sleep, now });

      let release = (): void => {};
      const block = new Promise<void>((resolve) => {
        release = resolve;
      });

      const inflight = queue.enqueue(async () => {
        await block;
      });
      const a = queue.enqueue(async () => {});
      const b = queue.enqueue(async () => {});

      await expect(queue.enqueue(async () => {})).rejects.toBeInstanceOf(WireQueueFullError);

      release();
      await Promise.all([inflight, a, b]);

      // Fresh enqueue must succeed now.
      let ran = false;
      await queue.enqueue(async () => {
        ran = true;
      });
      expect(ran).toBe(true);
    });

    it('exposes the configured capacity via capacity()', () => {
      const queue = new WireQueue({ minSendGapMs: 0, maxQueueSize: 42, sleep: noopSleep });
      expect(queue.capacity()).toBe(42);
    });

    it('defaults capacity to 100 when not explicitly set', () => {
      const queue = new WireQueue({ minSendGapMs: 0, sleep: noopSleep });
      expect(queue.capacity()).toBe(100);
    });

    it('throws synchronously for invalid maxQueueSize', () => {
      expect(() => new WireQueue({ minSendGapMs: 0, maxQueueSize: 0, sleep: noopSleep })).toThrow();
      expect(() => new WireQueue({ minSendGapMs: 0, maxQueueSize: -1, sleep: noopSleep })).toThrow();
      expect(
        () => new WireQueue({ minSendGapMs: 0, maxQueueSize: 1.5, sleep: noopSleep }),
      ).toThrow();
    });
  });
});
