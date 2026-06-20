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
export declare const DEFAULT_RESPONSE_TIMEOUT_MS = 1000;
export declare const DEFAULT_MAX_RETRIES = 3;
export declare const DEFAULT_CRC_BACKOFF_MIN_MS = 50;
export declare const DEFAULT_CRC_BACKOFF_MAX_MS = 300;
export declare class BusExchange {
    private readonly send;
    private readonly responseTimeoutMs;
    private readonly maxRetries;
    private readonly crcBackoffMinMs;
    private readonly crcBackoffMaxMs;
    private readonly sleep;
    private readonly random;
    private readonly log;
    private pendingGate;
    private crcBackoffArmed;
    constructor(options: BusExchangeOptions);
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
    runExchange(frame: Uint8Array, label?: string, hooks?: ExchangeHooks): Promise<ExchangeOutcome>;
    /**
     * Notify the exchange that a valid frame arrived from the WP. Resolves the
     * in-flight response gate so the current attempt succeeds. A no-op when no
     * gate is open — a stray frame outside any transaction is simply ignored.
     */
    onResponse(): void;
    /**
     * Notify the exchange that an invalid (checksum) frame was seen on the
     * bus. Arms the randomised CRC backoff applied before the next send. Does
     * NOT resolve the gate — a garbled reply is left to time out and retry, so
     * the in-flight attempt keeps waiting for a clean frame. Safe to call at
     * any time, including with no exchange in flight.
     */
    onCrcError(): void;
    /**
     * Install a fresh response gate and return the awaitable that
     * {@link onResponse} resolves. The gate is opened *before* the send so an
     * early reply is never missed; the timeout race is wired up separately by
     * {@link raceGateAgainstTimeout} only after the send has completed.
     */
    private openResponseGate;
    /**
     * Race the already-open response gate against the response timeout. The
     * timeout starts counting from *after* the send (when this is called).
     * Whichever side fires first wins; the gate is then nulled out so a late
     * `onResponse()` after a timeout cannot resolve a stale gate or leak into
     * the next attempt.
     */
    private raceGateAgainstTimeout;
    /** Random integer-ish backoff in `[crcBackoffMinMs, crcBackoffMaxMs]`. */
    private randomBackoffMs;
}
//# sourceMappingURL=bus-exchange.d.ts.map