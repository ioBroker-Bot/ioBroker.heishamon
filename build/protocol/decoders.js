/**
 * Pure decoder primitives for HeishaMon CN-CNT response frames.
 *
 * Each primitive maps one (frame, offset) tuple to a decoded `number` (or
 * `string` for the seven special-case main-frame datapoints). All functions
 * are pure — no I/O, no shared state.
 *
 * Numeric outputs are returned as floats (no rounding) so consumers can
 * format with the precision they need. HeishaMon's reference implementation
 * rounds Div5/Div50/ValvePID values when stringifying; we deliberately do
 * not, since the canonical project type is `number`.
 *
 * Contract: callers MUST pre-validate that `frame` is long enough for the
 * offsets touched by a given primitive. The `decode*Frame` dispatchers in
 * `decoder.ts` enforce this with a single length check before iterating, so
 * the non-null assertions on `frame[i]` below are safe inside that path.
 */
/** Top bit, no offset. Used by `Liquid_Type`. */
export function getBit1(frame, offset) {
    return frame[offset] >> 7;
}
/** Top two bits, minus 1. */
export function getBit1and2(frame, offset) {
    return (frame[offset] >> 6) - 1;
}
/** Bits 3 and 4 (counting from MSB), minus 1. */
export function getBit3and4(frame, offset) {
    return ((frame[offset] >> 4) & 0b11) - 1;
}
/** Bits 3, 4 and 5 (counting from MSB), minus 1. */
export function getBit3and4and5(frame, offset) {
    return ((frame[offset] >> 3) & 0b111) - 1;
}
/** Bits 5 and 6 (counting from MSB), minus 1. */
export function getBit5and6(frame, offset) {
    return ((frame[offset] >> 2) & 0b11) - 1;
}
/** Bottom two bits, minus 1. */
export function getBit7and8(frame, offset) {
    return (frame[offset] & 0b11) - 1;
}
/** Bottom three bits, minus 1. */
export function getRight3bits(frame, offset) {
    return (frame[offset] & 0b111) - 1;
}
/** Byte value minus 1. */
export function getIntMinus1(frame, offset) {
    return frame[offset] - 1;
}
/** Byte value minus 128 (signed temperature offset). */
export function getIntMinus128(frame, offset) {
    return frame[offset] - 128;
}
/** (Byte - 1) / 5. HeishaMon rounds to 1 decimal; we return the raw float. */
export function getIntMinus1Div5(frame, offset) {
    return (frame[offset] - 1) / 5;
}
/** (Byte - 1) / 50. HeishaMon rounds to 2 decimals; we return the raw float. */
export function getIntMinus1Div50(frame, offset) {
    return (frame[offset] - 1) / 50;
}
/** (Byte - 1) * 10. */
export function getIntMinus1Times10(frame, offset) {
    return (frame[offset] - 1) * 10;
}
/** (Byte - 1) * 50. */
export function getIntMinus1Times50(frame, offset) {
    return (frame[offset] - 1) * 50;
}
/** (Byte - 1) * 200, in watts. */
export function getPower(frame, offset) {
    return (frame[offset] - 1) * 200;
}
/**
 * Operating-mode enum decode.
 *
 * Mirrors HeishaMon's `getOpMode()`, which masks the input to the lower
 * 6 bits before matching. The mask is required: in real frames the upper
 * two bits of byte 6 carry the zone-state flag (e.g. byte 6 = 0x62 → 0b01100010,
 * lower 6 bits = 34 → Heat+DHW). Without the mask the raw byte (98) would
 * fall through to -1, which is wrong.
 */
export function getOpMode(frame, offset) {
    const masked = frame[offset] & 0b111111;
    switch (masked) {
        case 18:
            return 0;
        case 19:
            return 1;
        case 25:
            return 2;
        case 33:
            return 3;
        case 34:
            return 4;
        case 35:
            return 5;
        case 41:
            return 6;
        case 26:
            return 7;
        case 42:
            return 8;
        default:
            return -1;
    }
}
/** Little-endian 16-bit unsigned int at `offset`, minus 1. */
export function getUintt16(frame, offset) {
    return ((frame[offset + 1] << 8) | frame[offset]) - 1;
}
/** High nibble of the byte, minus 1. */
export function getFirstByte(frame, offset) {
    return (frame[offset] >> 4) - 1;
}
/** Low nibble of the byte, minus 1. */
export function getSecondByte(frame, offset) {
    return (frame[offset] & 0x0f) - 1;
}
/** (Byte - 1) / 2 — three-way valve PID output as percentage. */
export function getValvePID(frame, offset) {
    return (frame[offset] - 1) / 2;
}
// --- Main-frame special cases ---------------------------------------------
/**
 * Pump flow rate (l/min) — TOP1.
 *
 * Integer part is byte 170, fractional part is `(byte169 - 1) / 256`.
 */
export function getPumpFlow(frame) {
    return frame[170] + (frame[169] - 1) / 256;
}
/**
 * Operating hours of the heat pump — TOP11.
 *
 * Little-endian 16-bit value at bytes 182/183, minus 1.
 */
export function getOperationsHours(frame) {
    return ((frame[183] << 8) | frame[182]) - 1;
}
/**
 * Start-counter of the heat pump — TOP12.
 *
 * Little-endian 16-bit value at bytes 179/180, minus 1.
 */
export function getOperationsCounter(frame) {
    return ((frame[180] << 8) | frame[179]) - 1;
}
/**
 * Operating hours of the room backup heater — TOP90.
 *
 * Little-endian 16-bit value at bytes 185/186, minus 1.
 */
export function getRoomHeaterOperationsHours(frame) {
    return ((frame[186] << 8) | frame[185]) - 1;
}
/**
 * Operating hours of the DHW backup heater — TOP91.
 *
 * Little-endian 16-bit value at bytes 188/189, minus 1.
 */
export function getDhwHeaterOperationsHours(frame) {
    return ((frame[189] << 8) | frame[188]) - 1;
}
/**
 * Last error code — TOP44.
 *
 * Byte 113 is the error type, byte 114 is the error number (offset by 17).
 * Type 0xB1 → Fxx, type 0xA1 → Hxx, otherwise "No error". The numeric part
 * is rendered as uppercase hex without zero padding, matching HeishaMon's
 * `sprintf("%02X", ...)` only in upper-case but NOT in width — we keep the
 * natural hex representation since the byte minus 17 is signed there too.
 *
 * Note: HeishaMon's `sprintf("F%02X", number)` zero-pads to 2 hex digits and
 * accepts negative numbers (which produce wide signed hex). We preserve the
 * common-case behaviour (non-negative numbers, zero-padded to 2) here.
 */
export function getErrorInfo(frame) {
    const errorType = frame[113];
    const errorNumber = frame[114] - 17;
    if (errorType === 0xb1) {
        return 'F' + toUpperHex2(errorNumber);
    }
    if (errorType === 0xa1) {
        return 'H' + toUpperHex2(errorNumber);
    }
    return 'No error';
}
function toUpperHex2(value) {
    if (value < 0) {
        // Mirror C sprintf("%02X", int) on a negative int: it would render the
        // full-width two's-complement representation. We clamp to 2 chars by
        // masking, which is what callers actually expect for error codes.
        const masked = value & 0xff;
        return masked.toString(16).toUpperCase().padStart(2, '0');
    }
    return value.toString(16).toUpperCase().padStart(2, '0');
}
/**
 * Heat-pump model identifier — TOP92.
 *
 * Bytes 129..138 (10 bytes) rendered as uppercase space-separated hex pairs,
 * e.g. `"E2 CE 0D 71 81 72 CE 0C 92 81"`.
 */
export function getHeatPumpModel(frame) {
    const parts = [];
    for (let index = 129; index <= 138; index++) {
        parts.push(frame[index].toString(16).toUpperCase().padStart(2, '0'));
    }
    return parts.join(' ');
}
// --- Optional-PCB decoders ------------------------------------------------
/** Zone 1 water-pump request (OPT0). */
export function getOptZ1WaterPump(frame) {
    return (frame[4] >> 7) & 1;
}
/** Zone 1 mixing-valve request (OPT1). */
export function getOptZ1MixingValve(frame) {
    return (frame[4] >> 5) & 0b11;
}
/** Zone 2 water-pump request (OPT2). */
export function getOptZ2WaterPump(frame) {
    return (frame[4] >> 4) & 1;
}
/** Zone 2 mixing-valve request (OPT3). */
export function getOptZ2MixingValve(frame) {
    return (frame[4] >> 2) & 0b11;
}
/** Pool water-pump request (OPT4). */
export function getOptPoolWaterPump(frame) {
    return (frame[4] >> 1) & 1;
}
/** Solar water-pump request (OPT5). */
export function getOptSolarWaterPump(frame) {
    return frame[4] & 1;
}
/** Alarm state from optional PCB (OPT6). */
export function getOptAlarmState(frame) {
    return frame[5] & 1;
}
//# sourceMappingURL=decoders.js.map