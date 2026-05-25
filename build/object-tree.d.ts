/**
 * Build ioBroker-style object definitions from the HeishaMon datapoint table.
 *
 * This module is a pure function: same input (the `ALL_DATAPOINTS` table from
 * `heishamon-protocol`) always produces the same output. It does not depend on
 * `@iobroker/types` at runtime — the returned shapes mirror the subset of
 * fields that `iobroker.setObject` accepts.
 *
 * The adapter layer is responsible for calling `setObject` with each entry
 * and prefixing its instance namespace (e.g. `heishamon.0.`); this module
 * returns device-relative IDs only (`main.Outside_Temp`).
 */
import { type DecoderKind, type FrameSource } from './protocol/index.js';
export interface StateObjectDefinition {
    readonly _id: string;
    readonly type: 'state';
    readonly common: {
        readonly name: string;
        readonly type: 'number' | 'string' | 'boolean';
        readonly role: string;
        readonly read: true;
        readonly write: boolean;
        readonly unit?: string;
        readonly desc?: string;
        readonly states?: Readonly<Record<number, string>>;
    };
    readonly native: Readonly<{
        readonly datapointId: string;
        readonly datapointName: string;
        readonly frameSource: FrameSource;
        readonly decoder: DecoderKind;
    }>;
}
export interface ChannelObjectDefinition {
    readonly _id: FrameSource;
    readonly type: 'channel';
    readonly common: {
        readonly name: string;
    };
    readonly native: Record<string, never>;
}
/**
 * Connection-quality states live under the pre-existing `info` channel
 * (declared in io-package.json). They do not belong to a `FrameSource`,
 * so they get a separate, narrower type and a flat `info.<name>` ID.
 */
export interface InfoStateObjectDefinition {
    readonly _id: string;
    readonly type: 'state';
    readonly common: {
        readonly name: string;
        readonly type: 'number';
        readonly role: string;
        readonly read: true;
        readonly write: false;
        readonly unit?: string;
        readonly min?: number;
        readonly max?: number;
        readonly def?: number;
        readonly desc?: string;
    };
    readonly native: Record<string, never>;
}
export interface ObjectTree {
    readonly channels: readonly ChannelObjectDefinition[];
    readonly states: readonly StateObjectDefinition[];
    readonly infoStates: readonly InfoStateObjectDefinition[];
}
/**
 * Look up a datapoint by name. Used by tests and the adapter layer to find
 * the StateObjectDefinition matching an incoming decoded value.
 */
export declare function stateId(frameSource: FrameSource, name: string): string;
/**
 * Build the full object tree: all 157 datapoints as state objects, the
 * three frame channels they live in, plus the connection-quality states
 * under the (already-declared) `info` channel.
 */
export declare function buildObjectTree(): ObjectTree;
//# sourceMappingURL=object-tree.d.ts.map