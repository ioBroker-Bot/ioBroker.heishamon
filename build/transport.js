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
import { Buffer } from 'node:buffer';
import { Framer } from './protocol/index.js';
import { SerialPort } from 'serialport';
/** Panasonic CN-CNT line settings (see docs/protocol/code-map.md). */
const PANASONIC_BAUD_RATE = 9600;
const PANASONIC_DATA_BITS = 8;
const PANASONIC_PARITY = 'even';
const PANASONIC_STOP_BITS = 1;
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
export class SerialAdapterTransport {
    options;
    framer = new Framer();
    port = null;
    constructor(options) {
        this.options = options;
    }
    open() {
        if (this.port !== null) {
            return Promise.reject(new Error('SerialAdapterTransport is already open'));
        }
        return new Promise((resolve, reject) => {
            const port = new SerialPort({
                path: this.options.path,
                baudRate: this.options.baudRate ?? PANASONIC_BAUD_RATE,
                dataBits: PANASONIC_DATA_BITS,
                parity: PANASONIC_PARITY,
                stopBits: PANASONIC_STOP_BITS,
                autoOpen: false,
            }, (error) => {
                // Constructor callback fires only on synchronous validation errors
                // when `autoOpen` is false. We use it as a belt-and-braces guard;
                // the actual open-result comes from `port.open` below.
                if (error) {
                    this.port = null;
                    reject(error);
                }
            });
            this.port = port;
            this.attachListeners(port);
            port.open((openError) => {
                if (openError) {
                    this.port = null;
                    this.log('error', `failed to open ${this.options.path}: ${openError.message}`);
                    reject(openError);
                    return;
                }
                this.log('info', `opened ${this.options.path} @ ${port.baudRate} 8E1`);
                resolve();
            });
        });
    }
    send(frame) {
        const port = this.port;
        if (port === null || !port.isOpen) {
            return Promise.reject(new Error('SerialAdapterTransport is not open'));
        }
        return new Promise((resolve, reject) => {
            // `serialport.write` accepts Uint8Array but is typed loosely; wrapping
            // into a Buffer keeps the call site explicit and matches the
            // documented preferred input.
            port.write(Buffer.from(frame), (writeError) => {
                if (writeError) {
                    this.log('error', `write failed on ${this.options.path}: ${writeError.message}`);
                    reject(writeError);
                    return;
                }
                resolve();
            });
        });
    }
    close() {
        const port = this.port;
        if (port === null) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            if (!port.isOpen) {
                this.port = null;
                resolve();
                return;
            }
            port.close((closeError) => {
                this.port = null;
                if (closeError) {
                    this.log('error', `failed to close ${this.options.path}: ${closeError.message}`);
                    reject(closeError);
                    return;
                }
                resolve();
            });
        });
    }
    attachListeners(port) {
        port.on('data', (chunk) => {
            this.handleIncoming(chunk);
        });
        port.on('error', (error) => {
            this.log('error', `serial error on ${this.options.path}: ${error.message}`);
            if (this.options.onError !== undefined) {
                this.options.onError(error);
            }
        });
        port.on('close', () => {
            this.log('info', `closed ${this.options.path}`);
        });
    }
    handleIncoming(chunk) {
        // Node's Buffer is a Uint8Array subclass; passing it directly into the
        // framer is fine and avoids an unnecessary copy.
        const bytes = chunk;
        const events = this.framer.push(bytes);
        for (const event of events) {
            this.options.onEvent(event);
        }
    }
    log(level, message) {
        if (this.options.log !== undefined) {
            this.options.log(level, message);
        }
    }
}
//# sourceMappingURL=transport.js.map