/**
 * Frame-level decoders.
 *
 * Translates the three HeishaMon CN-CNT response frame types into a
 * `Record<topic, DecodedValue>`. Topic names are identical to the
 * HeishaMon MQTT topic suffixes (case-sensitive).
 *
 * These decoders intentionally do NOT verify the frame's checksum or
 * inspect the header bytes — that is the caller's responsibility (see
 * `verifyFrame` in `crc.ts`). Decoders only require that the frame is
 * long enough for the highest byte offset they read.
 */

import {
  EXTRA_DATAPOINTS,
  MAIN_DATAPOINTS,
  OPTIONAL_DATAPOINTS,
  type DataPoint,
  type DecoderKind,
} from './datapoints.js';
import {
  getBit1,
  getBit1and2,
  getBit3and4,
  getBit3and4and5,
  getBit5and6,
  getBit7and8,
  getDhwHeaterOperationsHours,
  getErrorInfo,
  getFirstByte,
  getHeatPumpModel,
  getIntMinus1,
  getIntMinus1Div5,
  getIntMinus1Div50,
  getIntMinus1Times10,
  getIntMinus1Times50,
  getIntMinus128,
  getOpMode,
  getOperationsCounter,
  getOperationsHours,
  getOptAlarmState,
  getOptPoolWaterPump,
  getOptSolarWaterPump,
  getOptZ1MixingValve,
  getOptZ1WaterPump,
  getOptZ2MixingValve,
  getOptZ2WaterPump,
  getPower,
  getPumpFlow,
  getRight3bits,
  getRoomHeaterOperationsHours,
  getSecondByte,
  getUintt16,
  getValvePID,
  type DecodedValue,
} from './decoders.js';

/** Mapping from HeishaMon topic suffix to its decoded value. */
export type DecodedFrame = Record<string, DecodedValue>;

const MAIN_FRAME_LENGTH = 203;
const EXTRA_FRAME_LENGTH = 203;
const OPTIONAL_FRAME_LENGTH = 20;

/**
 * Standard byte-decoder type: takes the frame and a byte offset, returns a
 * number. Used by all main-frame topics except the seven special cases.
 */
type ByteDecoder = (frame: Uint8Array, offset: number) => number;

const BYTE_DECODERS: Record<
  Exclude<
    DecoderKind,
    'unknown' | 'getOptDataValue' | 'getDataValue' | 'getErrorInfo' | 'getPumpFlow'
  >,
  ByteDecoder
> = {
  getBit1,
  getBit1and2,
  getBit3and4,
  getBit3and4and5,
  getBit5and6,
  getBit7and8,
  getRight3bits,
  getIntMinus1,
  getIntMinus128,
  getIntMinus1Div5,
  getIntMinus1Div50,
  getIntMinus1Times10,
  getIntMinus1Times50,
  getOpMode,
  getPower,
  getUintt16,
  getFirstByte,
  getSecondByte,
  getValvePID,
};

/**
 * Dispatcher for the seven main-frame special cases (decoder === 'unknown').
 * Keyed by the canonical datapoint name.
 */
const SPECIAL_MAIN_DECODERS: Record<string, (frame: Uint8Array) => DecodedValue> = {
  Pump_Flow: getPumpFlow,
  Operations_Hours: getOperationsHours,
  Operations_Counter: getOperationsCounter,
  Error: getErrorInfo,
  Room_Heater_Operations_Hours: getRoomHeaterOperationsHours,
  DHW_Heater_Operations_Hours: getDhwHeaterOperationsHours,
  Heat_Pump_Model: getHeatPumpModel,
};

/**
 * Dispatcher for the seven optional-PCB topics. Keyed by datapoint name
 * because the per-bit extraction differs per topic and is not encoded in
 * the datapoint table.
 */
const OPTIONAL_DECODERS: Record<string, (frame: Uint8Array) => number> = {
  Z1_Water_Pump: getOptZ1WaterPump,
  Z1_Mixing_Valve: getOptZ1MixingValve,
  Z2_Water_Pump: getOptZ2WaterPump,
  Z2_Mixing_Valve: getOptZ2MixingValve,
  Pool_Water_Pump: getOptPoolWaterPump,
  Solar_Water_Pump: getOptSolarWaterPump,
  Alarm_State: getOptAlarmState,
};

/**
 * Decode a main-frame response.
 *
 * @param frame  the 203-byte main-frame buffer (header + payload + checksum)
 * @throws RangeError if the buffer is shorter than 203 bytes
 */
export function decodeMainFrame(frame: Uint8Array): DecodedFrame {
  requireLength(frame, MAIN_FRAME_LENGTH, 'main');
  const result: DecodedFrame = {};
  for (const datapoint of MAIN_DATAPOINTS) {
    result[datapoint.name] = decodeMainDatapoint(frame, datapoint);
  }
  return result;
}

/**
 * Decode an extra-block response (K/L-series).
 *
 * @param frame  the 203-byte extra-block buffer
 * @throws RangeError if the buffer is shorter than 203 bytes
 */
export function decodeExtraFrame(frame: Uint8Array): DecodedFrame {
  requireLength(frame, EXTRA_FRAME_LENGTH, 'extra');
  const result: DecodedFrame = {};
  for (const datapoint of EXTRA_DATAPOINTS) {
    // All XTOPs use getUintt16 over a fixed byte offset.
    result[datapoint.name] = getUintt16(frame, datapoint.byte);
  }
  return result;
}

/**
 * Decode an optional-PCB frame.
 *
 * @param frame  the 20-byte optional-PCB buffer
 * @throws RangeError if the buffer is shorter than 20 bytes
 */
export function decodeOptionalFrame(frame: Uint8Array): DecodedFrame {
  requireLength(frame, OPTIONAL_FRAME_LENGTH, 'optional');
  const result: DecodedFrame = {};
  for (const datapoint of OPTIONAL_DATAPOINTS) {
    const decoder = OPTIONAL_DECODERS[datapoint.name];
    if (decoder === undefined) {
      // The datapoint table is the source of truth; an entry without a
      // matching decoder is a programming error, not bad input.
      throw new Error(`missing optional-PCB decoder for ${datapoint.name}`);
    }
    result[datapoint.name] = decoder(frame);
  }
  return result;
}

function decodeMainDatapoint(frame: Uint8Array, datapoint: DataPoint): DecodedValue {
  if (datapoint.decoder === 'unknown') {
    const special = SPECIAL_MAIN_DECODERS[datapoint.name];
    if (special === undefined) {
      throw new Error(`missing special-case main decoder for ${datapoint.name}`);
    }
    return special(frame);
  }
  const decoder = BYTE_DECODERS[datapoint.decoder as keyof typeof BYTE_DECODERS];
  if (decoder === undefined) {
    throw new Error(
      `decoder kind ${datapoint.decoder} is not valid for main-frame datapoint ${datapoint.name}`,
    );
  }
  return decoder(frame, datapoint.byte);
}

function requireLength(frame: Uint8Array, expected: number, label: string): void {
  if (frame.length < expected) {
    throw new RangeError(`${label} frame must be at least ${expected} bytes, got ${frame.length}`);
  }
}
