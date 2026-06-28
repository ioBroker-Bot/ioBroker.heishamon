/**
 * Response-driven, retrying bus exchange for the half-duplex CN-CNT line.
 *
 * The user's site bridges RS232→RS485, which makes the bus strictly
 * half-duplex: the adapter must never push a new frame before the heat
 * pump's reply to the previous one has arrived or the wait has timed out.
 * `BusExchange` turns a single "send a frame" into a full transaction:
 * write the frame, wait for the WP to answer (via an externally-fed
 * response gate), and retry the whole thing a bounded number of times if
 * the reply never comes.
 *
 * Two failure modes are handled distinctly:
 *
 *  - **Timeout** (no reply within `responseTimeoutMs`): the WP simply did
 *    not answer. Retry by re-sending the same frame.
 *  - **CRC error** (a garbled frame was seen on the bus): on a multi-master
 *    bus (an Option-PCB acting as a second master) a checksum failure can
 *    mean a *collision*. We arm a randomised quiet window before the next
 *    bus access so two masters that collided do not re-collide in lockstep.
 *    A garbled reply does NOT resolve the gate — the attempt is left to time
 *    out and retry, which is the conservative choice.
 *
 * The class is pure logic — no ioBroker, no transport. The `send` callback,
 * the clock (`now`/`sleep`) and the RNG (`random`) are all injectable so
 * tests drive the exchange deterministically. Because the surrounding
 * `WireQueue` serialises every wire operation, at most one `runExchange` is
 * ever in flight, so a single response gate suffices.
 */

import type { Logger } from './transport.js';

export type SleepFn = (ms: number) => Promise<void>;
export type NowFn = () => number;
export type RandomFn = () => number;
export type SendFn = (frame: Uint8Array) => Promise<void>;

/** Result of a single {@link BusExchange.runExchange} transaction. */
export interface ExchangeOutcome {
  /** True when a reply arrived before the retry budget was exhausted. */
  readonly ok: boolean;
  /** Number of send attempts made (1 = succeeded first try). */
  readonly attempts: number;
}

/**
 * Per-call observation hooks. Polls feed the connection-stats tracker
 * through these; set-commands pass nothing (sets do not feed stats today)
 * or use `onSend` to arm the diagnostic SET-response probe.
 */
export interface ExchangeHooks {
  /** Fires synchronously right before each send attempt hits the wire. */
  readonly onSend?: (attempt: number) => void;
  /** Fires when an attempt times out without a reply. */
  readonly onTimeout?: (attempt: number) => void;
}

export interface BusExchangeOptions {
  /** Writes one complete frame to the wire (caller wraps `transport.send`). */
  readonly send: SendFn;
  /**
   * How long to wait for the WP reply after a send, in ms. Defaults to
   * {@link DEFAULT_RESPONSE_TIMEOUT_MS}. Observed replies arrive in ~450 ms;
   * the original HeishaMon firmware used a 2000 ms serial timeout. 1000 ms
   * gives a comfortable 2x margin over the observed latency.
   */
  readonly responseTimeoutMs?: number;
  /**
   * Number of RETRIES after the first attempt, so up to `maxRetries + 1`
   * total sends. Defaults to {@link DEFAULT_MAX_RETRIES}. Must be a
   * non-negative integer.
   */
  readonly maxRetries?: number;
  /**
   * Lower bound (ms) of the randomised quiet window inserted before the
   * next bus access after a CRC error. Defaults to
   * {@link DEFAULT_CRC_BACKOFF_MIN_MS}.
   */
  readonly crcBackoffMinMs?: number;
  /**
   * Upper bound (ms) of the randomised CRC backoff window. Defaults to
   * {@link DEFAULT_CRC_BACKOFF_MAX_MS}.
   */
  readonly crcBackoffMaxMs?: number;
  /**
   * Required seam — an adapter-managed sleep. `main.ts` supplies the ioBroker
   * base-class `this.delay(ms)`; tests inject a deterministic fake.
   */
  readonly sleep: SleepFn;
  /**
   * Test seam — defaults to Date.now. Accepted for parity with the other
   * pure modules; the response/timeout race is driven purely by `sleep`, so
   * this is currently informational only.
   */
  readonly now?: NowFn;
  /** Test seam — defaults to Math.random. */
  readonly random?: RandomFn;
  /** Optional structured logger (same contract as transport.ts). */
  readonly log?: Logger;
}

export const DEFAULT_RESPONSE_TIMEOUT_MS = 1000;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_CRC_BACKOFF_MIN_MS = 50;
export const DEFAULT_CRC_BACKOFF_MAX_MS = 300;

/**
 * Largest delay Node.js `setTimeout` accepts. A `responseTimeoutMs` above this
 * would wrap around and fire almost immediately. The adapter clamps the
 * configured value up front; the constructor enforces the ceiling too.
 */
const MAX_RESPONSE_TIMEOUT_MS = 2_147_483_647;

const defaultRandom: RandomFn = () => Math.random();

/** Internal sentinel object distinguishing the two race outcomes. */
type GateOutcome = 'frame' | 'timeout';

interface PendingGate {
  /** Resolves the gate; the argument decides which side of the race won. */
  readonly resolve: (outcome: GateOutcome) => void;
}

export class BusExchange {
  private readonly send: SendFn;
  private readonly responseTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly crcBackoffMinMs: number;
  private readonly crcBackoffMaxMs: number;
  private readonly sleep: SleepFn;
  private readonly random: RandomFn;
  private readonly log: Logger | undefined;

  // The currently in-flight response gate, or null when no attempt is
  // waiting for a reply. `onResponse()` resolves it from outside; it is
  // nulled out the moment an attempt concludes so a late reply after a
  // timeout cannot corrupt the next attempt.
  private pendingGate: PendingGate | null = null;
  // Set by `onCrcError()`, consumed (and cleared) before the next send so a
  // randomised quiet window separates us from a possible collision partner.
  private crcBackoffArmed = false;

  constructor(options: BusExchangeOptions) {
    if (typeof options.send !== 'function') {
      throw new Error('BusExchange: send must be a function');
    }
    const responseTimeoutMs = options.responseTimeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS;
    if (!Number.isFinite(responseTimeoutMs) || responseTimeoutMs <= 0) {
      throw new Error(
        `BusExchange: responseTimeoutMs must be a positive finite number, got ${responseTimeoutMs}`,
      );
    }
    if (responseTimeoutMs > MAX_RESPONSE_TIMEOUT_MS) {
      throw new Error(
        `BusExchange: responseTimeoutMs must not exceed ${MAX_RESPONSE_TIMEOUT_MS} ms, got ${responseTimeoutMs}`,
      );
    }
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    if (!Number.isInteger(maxRetries) || maxRetries < 0) {
      throw new Error(`BusExchange: maxRetries must be a non-negative integer, got ${maxRetries}`);
    }
    const crcBackoffMinMs = options.crcBackoffMinMs ?? DEFAULT_CRC_BACKOFF_MIN_MS;
    const crcBackoffMaxMs = options.crcBackoffMaxMs ?? DEFAULT_CRC_BACKOFF_MAX_MS;
    if (!Number.isFinite(crcBackoffMinMs) || crcBackoffMinMs < 0) {
      throw new Error(
        `BusExchange: crcBackoffMinMs must be a non-negative finite number, got ${crcBackoffMinMs}`,
      );
    }
    if (!Number.isFinite(crcBackoffMaxMs) || crcBackoffMaxMs < crcBackoffMinMs) {
      throw new Error(
        `BusExchange: crcBackoffMaxMs must be a finite number >= crcBackoffMinMs, got ${crcBackoffMaxMs}`,
      );
    }

    this.send = options.send;
    this.responseTimeoutMs = responseTimeoutMs;
    this.maxRetries = maxRetries;
    this.crcBackoffMinMs = crcBackoffMinMs;
    this.crcBackoffMaxMs = crcBackoffMaxMs;
    this.sleep = options.sleep;
    this.random = options.random ?? defaultRandom;
    this.log = options.log;
  }

  /**
   * Run one full request/response transaction for `frame`.
   *
   * Sends the frame, waits up to `responseTimeoutMs` for the WP reply (fed
   * externally via {@link onResponse}), and retries the whole exchange up to
   * `maxRetries` additional times on timeout. A CRC error seen between
   * attempts (via {@link onCrcError}) prepends a randomised quiet window to
   * the next send to break multi-master collision lockstep.
   *
   * Resolves to `{ ok, attempts }`; never rejects on a timeout (a failed
   * exchange is a normal outcome on a flaky bus). A throwing `send` rejects.
   *
   * @param frame  The complete frame to write.
   * @param label  Short identifier for log lines (e.g. `poll`, `set:foo`).
   * @param hooks  Optional per-call observation hooks (stats, probe arming).
   */
  async runExchange(
    frame: Uint8Array,
    label = 'frame',
    hooks?: ExchangeHooks,
  ): Promise<ExchangeOutcome> {
    const totalAttempts = this.maxRetries + 1;
    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      if (this.crcBackoffArmed) {
        this.crcBackoffArmed = false;
        await this.sleep(this.randomBackoffMs());
      }

      // Open the response gate BEFORE the send so a reply that races the
      // send's completion (or arrives synchronously in a test fake) still
      // resolves this attempt rather than slipping through as a stray frame.
      const gatePromise = this.openResponseGate();
      hooks?.onSend?.(attempt);
      await this.send(frame);

      const outcome = await this.raceGateAgainstTimeout(gatePromise);
      if (outcome === 'frame') {
        return { ok: true, attempts: attempt };
      }

      hooks?.onTimeout?.(attempt);
      this.log?.(
        'warn',
        `bus-exchange: ${label} attempt ${attempt}/${totalAttempts} timed out after ${this.responseTimeoutMs}ms`,
      );
    }

    this.log?.('warn', `bus-exchange: ${label} giving up after ${totalAttempts} attempts`);
    return { ok: false, attempts: totalAttempts };
  }

  /**
   * Notify the exchange that a valid frame arrived from the WP. Resolves the
   * in-flight response gate so the current attempt succeeds. A no-op when no
   * gate is open — a stray frame outside any transaction is simply ignored.
   */
  onResponse(): void {
    const gate = this.pendingGate;
    if (gate === null) {
      return;
    }
    this.pendingGate = null;
    gate.resolve('frame');
  }

  /**
   * Notify the exchange that an invalid (checksum) frame was seen on the
   * bus. Arms the randomised CRC backoff applied before the next send. Does
   * NOT resolve the gate — a garbled reply is left to time out and retry, so
   * the in-flight attempt keeps waiting for a clean frame. Safe to call at
   * any time, including with no exchange in flight.
   */
  onCrcError(): void {
    this.crcBackoffArmed = true;
  }

  /**
   * Install a fresh response gate and return the awaitable that
   * {@link onResponse} resolves. The gate is opened *before* the send so an
   * early reply is never missed; the timeout race is wired up separately by
   * {@link raceGateAgainstTimeout} only after the send has completed.
   */
  private openResponseGate(): Promise<GateOutcome> {
    return new Promise<GateOutcome>((resolve) => {
      const gate: PendingGate = {
        resolve: (outcome) => {
          resolve(outcome);
        },
      };
      this.pendingGate = gate;
    });
  }

  /**
   * Race the already-open response gate against the response timeout. The
   * timeout starts counting from *after* the send (when this is called).
   * Whichever side fires first wins; the gate is then nulled out so a late
   * `onResponse()` after a timeout cannot resolve a stale gate or leak into
   * the next attempt.
   */
  private async raceGateAgainstTimeout(gatePromise: Promise<GateOutcome>): Promise<GateOutcome> {
    const gate = this.pendingGate;
    const timeoutPromise = this.sleep(this.responseTimeoutMs).then<GateOutcome>(() => {
      // Only the timeout for the still-open gate may resolve it; a gate that
      // onResponse() already closed must not be reopened/double-resolved.
      if (gate !== null && this.pendingGate === gate) {
        this.pendingGate = null;
        gate.resolve('timeout');
      }
      return 'timeout';
    });
    return Promise.race([gatePromise, timeoutPromise]);
  }

  /** Random integer-ish backoff in `[crcBackoffMinMs, crcBackoffMaxMs]`. */
  private randomBackoffMs(): number {
    const span = this.crcBackoffMaxMs - this.crcBackoffMinMs;
    return Math.round(this.crcBackoffMinMs + this.random() * span);
  }
}
