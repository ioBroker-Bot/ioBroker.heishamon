/**
 * Serial-port transport for the ioBroker adapter.
 *
 * Mirrors the architecture of `heishamon-sim/src/transport-serial.ts`, but in
 * the *master* role: this transport sends polls and set-commands, and the
 * incoming bytes are responses from the heat pump. Decoding is handled
 * elsewhere — the transport only feeds raw bytes through a `Framer` and
 * hands the resulting events to the caller.
 *
 * The transport contains no protocol logic of its own; it is the single
 * `serialport` boundary of the adapter package, which keeps the higher
 * layers unit-testable without any hardware or native binding.
 */
import { type FramerEvent } from './protocol/index.js';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type Logger = (level: LogLevel, message: string) => void;
/**
 * Abstract transport contract the adapter's poller and state-applier talk to.
 * Stripped down to the three operations they need so the higher layers can be
 * tested against a trivial in-memory fake.
 */
export interface AdapterTransport {
    open(): Promise<void>;
    /** Write one complete frame (header + payload + checksum) to the wire. */
    send(frame: Uint8Array): Promise<void>;
    close(): Promise<void>;
}
export interface SerialAdapterTransportOptions {
    /** Device path, e.g. `/dev/ttyUSB0`. */
    readonly path: string;
    /** Baud rate. Defaults to 9600 (Panasonic CN-CNT). */
    readonly baudRate?: number;
    /** Called for every Framer event produced by incoming bytes. */
    readonly onEvent: (event: FramerEvent) => void;
    /** Called when the wire errors (port close, read error, async write fail). */
    readonly onError?: (error: Error) => void;
    readonly log?: Logger;
}
/**
 * Serial-port transport for the adapter.
 *
 * Lifecycle:
 *  1. `new SerialAdapterTransport(options)` — does not touch the port.
 *  2. `await open()` — opens the port and starts forwarding incoming bytes
 *     through the framer. Rejects if the port cannot be opened.
 *  3. `await send(frame)` — writes a complete frame to the wire.
 *  4. `await close()` — drains and closes the port cleanly.
 *
 * The same instance is not designed to be reopened after `close()`; create
 * a new one if the caller needs to reconnect.
 */
export declare class SerialAdapterTransport implements AdapterTransport {
    private readonly options;
    private readonly framer;
    private port;
    constructor(options: SerialAdapterTransportOptions);
    open(): Promise<void>;
    send(frame: Uint8Array): Promise<void>;
    close(): Promise<void>;
    private attachListeners;
    private handleIncoming;
    private log;
}
//# sourceMappingURL=transport.d.ts.map