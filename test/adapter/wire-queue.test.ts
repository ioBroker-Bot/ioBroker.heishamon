import { describe, expect, it } from 'vitest';

import { WireQueue, type SleepFn } from '../../src/wire-queue.js';

/**
 * Build a deterministic sleep mock that records every requested gap value
 * and resolves immediately so tests do not depend on real time.
 */
function createSleepRecorder(): { sleep: SleepFn; gaps: number[] } {
  const gaps: number[] = [];
  const sleep: SleepFn = (ms) => {
    gaps.push(ms);
    return Promise.resolve();
  };
  return { sleep, gaps };
}

/** Helper that flushes pending micro/macro tasks. */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('WireQueue', () => {
  it('runs a single enqueued task and resolves the returned promise', async () => {
    const { sleep, gaps } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 100, sleep });

    let ran = false;
    await queue.enqueue(async () => {
      ran = true;
    });

    expect(ran).toBe(true);
    expect(gaps).toEqual([]);
  });

  it('runs multiple tasks in FIFO order', async () => {
    const { sleep } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 50, sleep });

    const order: number[] = [];
    const p1 = queue.enqueue(async () => {
      order.push(1);
    });
    const p2 = queue.enqueue(async () => {
      order.push(2);
    });
    const p3 = queue.enqueue(async () => {
      order.push(3);
    });

    await Promise.all([p1, p2, p3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('serialises tasks — never runs two in parallel', async () => {
    const { sleep } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 0, sleep });

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
    const { sleep, gaps } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 200, sleep });

    await Promise.all([
      queue.enqueue(async () => {}),
      queue.enqueue(async () => {}),
      queue.enqueue(async () => {}),
    ]);

    // Two gaps for three tasks: gap fires between #1->#2 and #2->#3.
    expect(gaps).toEqual([200, 200]);
  });

  it('does not insert a gap before the first task', async () => {
    const { sleep, gaps } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 500, sleep });

    await queue.enqueue(async () => {});

    expect(gaps).toEqual([]);
  });

  it('rejects the caller promise when the task throws but keeps the queue running', async () => {
    const { sleep } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 0, sleep });

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
    const { sleep, gaps } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 300, sleep });

    const failing = queue.enqueue(async () => {
      throw new Error('nope');
    });
    const after = queue.enqueue(async () => {});

    await expect(failing).rejects.toThrow('nope');
    await after;

    expect(gaps).toEqual([300]);
  });

  it('reports pendingCount correctly before, during and after execution', async () => {
    const { sleep } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 0, sleep });

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

    // Three enqueued; the drain loop has already picked one to run.
    await Promise.resolve();
    expect(queue.pendingCount()).toBe(2);

    release();
    await Promise.all([p1, p2, p3]);
    expect(queue.pendingCount()).toBe(0);
  });

  it('with minSendGapMs=0 does not request any sleeps but still runs FIFO', async () => {
    const { sleep, gaps } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 0, sleep });

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

  it('handles enqueue() while the queue is draining', async () => {
    const { sleep, gaps } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 10, sleep });

    const order: string[] = [];

    const first = queue.enqueue(async () => {
      order.push('first');
    });

    // Append while the first task is still in flight (resolves microtask later).
    const second = queue.enqueue(async () => {
      order.push('second');
    });

    await first;
    const late = queue.enqueue(async () => {
      order.push('late');
    });

    await Promise.all([second, late]);
    expect(order).toEqual(['first', 'second', 'late']);
    // Two gaps: between first->second and second->late.
    expect(gaps).toEqual([10, 10]);
  });

  it('restarts the drain loop when a new task is enqueued after the queue idled', async () => {
    const { sleep, gaps } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 25, sleep });

    let ran1 = false;
    await queue.enqueue(async () => {
      ran1 = true;
    });
    expect(ran1).toBe(true);

    let ran2 = false;
    await queue.enqueue(async () => {
      ran2 = true;
    });
    expect(ran2).toBe(true);

    // Queue went idle between the two enqueue() calls, so no gap is needed
    // before the second standalone task.
    expect(gaps).toEqual([]);
  });

  it('continues after a rejection followed by a fresh enqueue', async () => {
    const { sleep } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 0, sleep });

    await expect(
      queue.enqueue(async () => {
        throw new Error('first-fail');
      }),
    ).rejects.toThrow('first-fail');

    let ran = false;
    await queue.enqueue(async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it('propagates the original error object to the caller', async () => {
    const { sleep } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 0, sleep });

    const sentinel = new Error('sentinel');
    await expect(
      queue.enqueue(async () => {
        throw sentinel;
      }),
    ).rejects.toBe(sentinel);
  });

  it('uses the default sleep when no override is provided (smoke test)', async () => {
    const queue = new WireQueue({ minSendGapMs: 1 });

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
    expect(() => new WireQueue({ minSendGapMs: -1 })).toThrow();
  });

  it('throws when minSendGapMs is not finite', () => {
    expect(() => new WireQueue({ minSendGapMs: Number.NaN })).toThrow();
    expect(() => new WireQueue({ minSendGapMs: Number.POSITIVE_INFINITY })).toThrow();
  });

  it('preserves FIFO order across a many-task burst', async () => {
    const { sleep } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 0, sleep });

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
    const { sleep } = createSleepRecorder();
    const queue = new WireQueue({ minSendGapMs: 0, sleep });

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

  it('flush helper is available for integration-style waits', async () => {
    // Sanity check the shared flush helper used by other tests.
    await flush();
    expect(true).toBe(true);
  });
});
