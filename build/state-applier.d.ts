/**
 * State-applier: bridge between decoded protocol frames and ioBroker states.
 *
 * Decodes a response frame using `heishamon-protocol` and pushes each
 * resulting topic to ioBroker via an injected `setState` function. The
 * indirection through the callback keeps this module decoupled from
 * `@iobroker/adapter-core` and trivially unit-testable.
 *
 * State IDs are *device-relative* (`main.Outside_Temp`, `extra.X`). The
 * adapter (main.ts) is responsible for prefixing the instance namespace
 * (e.g. `heishamon.0.`) when it binds `setState`.
 */
import type { Logger } from './transport.js';
/**
 * Signature of the ioBroker `setState` method we care about. The adapter
 * binds this from its actual `setState` so this module stays decoupled
 * from `@iobroker/adapter-core`.
 */
export type SetStateFn = (id: string, value: number | string, ack: true) => Promise<void> | void;
export interface StateApplierOptions {
    readonly setState: SetStateFn;
    readonly log?: Logger;
}
export declare class StateApplier {
    private readonly setState;
    private readonly logger?;
    constructor(options: StateApplierOptions);
    /**
     * Decode a mainResponse frame (203 bytes) and push every main datapoint
     * to ioBroker. Logs and skips when the frame is the wrong length.
     */
    applyMainResponse(frame: Uint8Array): Promise<void>;
    /**
     * Decode an extraResponse frame (203 bytes) and push every extra
     * datapoint to ioBroker. Logs and skips when the frame is the wrong length.
     */
    applyExtraResponse(frame: Uint8Array): Promise<void>;
    private applyDecoded;
    private log;
}
//# sourceMappingURL=state-applier.d.ts.map