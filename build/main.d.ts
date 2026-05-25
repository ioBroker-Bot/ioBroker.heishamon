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
    private readonly connectionStats;
    private lastStatsFlushAt;
    private statsFlushTimer;
    private lastWrittenSnapshot;
    private invalidRunActive;
    constructor(options?: Partial<utils.AdapterOptions>);
    private onReady;
    private validateConfig;
    private ensureObjectTree;
    private buildLogger;
    private handleFramerEvent;
    private isResponseFrame;
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