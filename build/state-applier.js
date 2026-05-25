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
import { EXTRA_DATAPOINTS, MAIN_DATAPOINTS, decodeExtraFrame, decodeMainFrame, } from './protocol/index.js';
import { stateId } from './object-tree.js';
const MAIN_FRAME_LENGTH = 203;
const EXTRA_FRAME_LENGTH = 203;
export class StateApplier {
    setState;
    logger;
    constructor(options) {
        this.setState = options.setState;
        if (options.log !== undefined) {
            this.logger = options.log;
        }
    }
    /**
     * Decode a mainResponse frame (203 bytes) and push every main datapoint
     * to ioBroker. Logs and skips when the frame is the wrong length.
     */
    async applyMainResponse(frame) {
        if (frame.length !== MAIN_FRAME_LENGTH) {
            this.log('error', `mainResponse frame must be ${MAIN_FRAME_LENGTH} bytes, got ${frame.length}`);
            return;
        }
        const decoded = decodeMainFrame(frame);
        await this.applyDecoded('main', MAIN_DATAPOINTS, decoded);
    }
    /**
     * Decode an extraResponse frame (203 bytes) and push every extra
     * datapoint to ioBroker. Logs and skips when the frame is the wrong length.
     */
    async applyExtraResponse(frame) {
        if (frame.length !== EXTRA_FRAME_LENGTH) {
            this.log('error', `extraResponse frame must be ${EXTRA_FRAME_LENGTH} bytes, got ${frame.length}`);
            return;
        }
        const decoded = decodeExtraFrame(frame);
        await this.applyDecoded('extra', EXTRA_DATAPOINTS, decoded);
    }
    async applyDecoded(source, datapoints, decoded) {
        // Fire every setState in parallel and use `allSettled` so a single
        // failing topic does not abort the whole frame. ioBroker's setState
        // is async; awaiting in a loop would serialise 144 round-trips.
        const writes = datapoints.map(async (datapoint) => {
            const value = decoded[datapoint.name];
            if (value === undefined) {
                // Should never happen — decoder is the source of truth. Defensive.
                this.log('warn', `decoder produced no value for ${datapoint.name}`);
                return;
            }
            const id = stateId(source, datapoint.name);
            try {
                await this.setState(id, value, true);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                this.log('warn', `setState ${id} failed: ${message}`);
            }
        });
        await Promise.allSettled(writes);
    }
    log(level, message) {
        if (this.logger !== undefined) {
            this.logger(level, message);
        }
    }
}
//# sourceMappingURL=state-applier.js.map