import { describe, expect, it } from 'vitest';

import { ConnectionStats } from '../../src/connection-stats.js';

describe('ConnectionStats — initial state', () => {
  it('starts with all counters zero and quality at 0', () => {
    const stats = new ConnectionStats();
    const snap = stats.snapshot();
    expect(snap.framesSent).toBe(0);
    expect(snap.framesReceived).toBe(0);
    expect(snap.framesCrcOk).toBe(0);
    expect(snap.framesCrcFail).toBe(0);
    expect(snap.connectionQuality).toBe(0);
  });

  it('rejects a non-positive window size', () => {
    expect(() => new ConnectionStats({ windowSize: 0 })).toThrow();
    expect(() => new ConnectionStats({ windowSize: -1 })).toThrow();
    expect(() => new ConnectionStats({ windowSize: 1.5 })).toThrow();
  });
});

describe('ConnectionStats — normal mode (sent + received)', () => {
  it('counts a successful ping-pong as a 100 %% slot during warm-up', () => {
    const stats = new ConnectionStats();
    for (let i = 0; i < 5; i++) {
      stats.recordSent();
      stats.recordReceived(true);
    }
    const snap = stats.snapshot();
    expect(snap.framesSent).toBe(5);
    expect(snap.framesReceived).toBe(5);
    expect(snap.framesCrcOk).toBe(5);
    expect(snap.framesCrcFail).toBe(0);
    expect(snap.connectionQuality).toBe(100);
  });

  it('computes 50 %% after five goods followed by five CRC-fails', () => {
    const stats = new ConnectionStats();
    for (let i = 0; i < 5; i++) {
      stats.recordSent();
      stats.recordReceived(true);
    }
    for (let i = 0; i < 5; i++) {
      stats.recordSent();
      stats.recordReceived(false);
    }
    const snap = stats.snapshot();
    expect(snap.framesSent).toBe(10);
    expect(snap.framesReceived).toBe(10);
    expect(snap.framesCrcOk).toBe(5);
    expect(snap.framesCrcFail).toBe(5);
    expect(snap.connectionQuality).toBe(50);
  });

  it('marks an unresolved sent as a timeout, dropping quality', () => {
    const stats = new ConnectionStats();
    stats.recordSent();
    // No response arrived; the next poll signals the previous as timeout.
    stats.markPendingAsTimeout();
    stats.recordSent();
    stats.recordReceived(true);

    const snap = stats.snapshot();
    expect(snap.framesSent).toBe(2);
    expect(snap.framesReceived).toBe(1);
    expect(snap.framesCrcOk).toBe(1);
    expect(snap.framesCrcFail).toBe(0);
    // Two slots: one timeout (false), one good (true) → 50 %%.
    expect(snap.connectionQuality).toBe(50);
  });

  it('rolls older fails out of the window after enough good pongs', () => {
    const stats = new ConnectionStats({ windowSize: 20 });
    // First five sent without a response, each timed out by the next poll.
    for (let i = 0; i < 5; i++) {
      stats.recordSent();
      stats.markPendingAsTimeout();
    }
    // Then 20 good ping-pongs — the oldest five fails roll out of the window.
    for (let i = 0; i < 20; i++) {
      stats.recordSent();
      stats.recordReceived(true);
    }
    const snap = stats.snapshot();
    expect(snap.framesSent).toBe(25);
    expect(snap.framesReceived).toBe(20);
    expect(snap.framesCrcOk).toBe(20);
    expect(snap.connectionQuality).toBe(100);
  });

  it('opens exactly one slot per ping-pong (first pong after first sent)', () => {
    const stats = new ConnectionStats();
    stats.recordSent();
    stats.recordReceived(true);
    const snap = stats.snapshot();
    // Exactly one slot in the buffer means 100 % (1/1).
    expect(snap.connectionQuality).toBe(100);
    expect(snap.framesSent).toBe(1);
    expect(snap.framesReceived).toBe(1);
  });

  it('treats markPendingAsTimeout as a no-op when nothing is pending', () => {
    const stats = new ConnectionStats();
    stats.markPendingAsTimeout();
    stats.markPendingAsTimeout();
    expect(stats.snapshot().connectionQuality).toBe(0);
    expect(stats.snapshot().framesSent).toBe(0);
  });

  it('rounds the quality percentage to the nearest integer', () => {
    const stats = new ConnectionStats();
    // 3 good out of 7 → 42.857… → rounds to 43.
    for (let i = 0; i < 3; i++) {
      stats.recordSent();
      stats.recordReceived(true);
    }
    for (let i = 0; i < 4; i++) {
      stats.recordSent();
      stats.recordReceived(false);
    }
    expect(stats.snapshot().connectionQuality).toBe(43);
  });
});

describe('ConnectionStats — listen-only mode (received only)', () => {
  it('appends one slot per received frame and never increments framesSent', () => {
    const stats = new ConnectionStats();
    for (let i = 0; i < 4; i++) {
      stats.recordReceived(true);
    }
    for (let i = 0; i < 4; i++) {
      stats.recordReceived(false);
    }
    const snap = stats.snapshot();
    expect(snap.framesSent).toBe(0);
    expect(snap.framesReceived).toBe(8);
    expect(snap.framesCrcOk).toBe(4);
    expect(snap.framesCrcFail).toBe(4);
    expect(snap.connectionQuality).toBe(50);
  });

  it('rolls received-frame slots through the window', () => {
    const stats = new ConnectionStats({ windowSize: 20 });
    for (let i = 0; i < 10; i++) {
      stats.recordReceived(false);
    }
    for (let i = 0; i < 20; i++) {
      stats.recordReceived(true);
    }
    const snap = stats.snapshot();
    expect(snap.framesReceived).toBe(30);
    expect(snap.framesCrcOk).toBe(20);
    expect(snap.framesCrcFail).toBe(10);
    expect(snap.connectionQuality).toBe(100);
  });
});

describe('ConnectionStats — custom window size', () => {
  it('respects a non-default window size', () => {
    const stats = new ConnectionStats({ windowSize: 4 });
    stats.recordSent();
    stats.recordReceived(true);
    stats.recordSent();
    stats.recordReceived(true);
    stats.recordSent();
    stats.recordReceived(false);
    stats.recordSent();
    stats.recordReceived(false);
    expect(stats.snapshot().connectionQuality).toBe(50);

    // Roll one fresh good in; the oldest true drops out.
    stats.recordSent();
    stats.recordReceived(true);
    // Window now contains [true, false, false, true] → 50 %.
    expect(stats.snapshot().connectionQuality).toBe(50);
  });
});
