/**
 * ioBroker adapter entry point — wires the protocol building blocks
 * (`SerialAdapterTransport`, `Poller`, `StateApplier`, `buildObjectTree`)
 * together with the `utils.Adapter` lifecycle.
 *
 * This file is the single boundary against `@iobroker/adapter-core`. All
 * protocol-specific logic lives in the other modules under `src/` and is
 * fully unit-tested without an ioBroker runtime.
 */
import * as utils from '@iobroker/adapter-core';
declare const AdapterBase: new (options: utils.AdapterOptions | string) => ioBroker.Adapter;
declare class HeishamonAdapter extends AdapterBase {
    private transport;
    private poller;
    private applier;
    private nativeConfig;
    private wireQueue;
    private busExchange;
    private readonly connectionStats;
    private lastStatsFlushAt;
    private statsFlushTimer;
    private lastWrittenSnapshot;
    private invalidRunActive;
    private setResponseProbe;
    private setProbeLoggingEnabled;
    constructor(options?: Partial<utils.AdapterOptions>);
    private onReady;
    private validateConfig;
    /**
     * Validate an optional millisecond value and clamp it into `[min, MAX_TIMER_MS]`.
     * Returns `undefined` when unset (caller keeps the default), the clamped
     * number when valid, or `null` when the value is present but not a finite
     * number — in which case the adapter has already been terminated.
     */
    private clampOptionalMs;
    /**
     * Validate the optional retry count: a non-negative integer, clamped to
     * {@link MAX_SEND_RETRIES}. Same return contract as {@link clampOptionalMs}.
     */
    private clampRetries;
    private ensureObjectTree;
    private buildLogger;
    private handleFramerEvent;
    private isResponseFrame;
    /**
     * Diagnostic logging for the (not-yet-reverse-engineered) Panasonic SET
     * acknowledgement. When a probe is armed (a `mainSet` was just written),
     * log every inbound framer event with its delay since the send, frame
     * type/length and a full hexdump. The first *complete* frame is taken to
     * be the reply and disarms the probe; CRC-garbage that precedes it is
     * logged but does not disarm, so a corrupted reply still shows up. The
     * probe also self-clears once SET_PROBE_WINDOW_MS has elapsed.
     *
     * This never touches wire behaviour — it only observes. Once we know what
     * the reply looks like, this feeds the response-driven queue + retry work.
     */
    private logSetResponseProbe;
    /** Space-separated lower-case hexdump of a byte buffer, for diagnostics. */
    private toHexString;
    /**
     * Throttled flush of the connection-stats snapshot to ioBroker. Writes
     * immediately when the last flush is older than `STATS_FLUSH_THROTTLE_MS`,
     * otherwise schedules a single trailing-edge write.
     */
    private scheduleStatsFlush;
    private flushStatsNow;
    private writeInfoState;
    private onStateChange;
    private onUnload;
}
export default function createAdapter(options?: Partial<utils.AdapterOptions>): HeishamonAdapter;
export {};
//# sourceMappingURL=main.d.ts.map