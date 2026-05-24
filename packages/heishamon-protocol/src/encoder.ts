/**
 * Encoder for HeishaMon `mainSet` write-command frames.
 *
 * One public entry point: `encodeSetCommand(name, value)` returns a complete
 * 111-byte frame (110-byte payload + checksum) ready to be transmitted.
 *
 * Each writable datapoint is represented by a rule that knows how to translate
 * the user-facing value into a byte offset and byte value within the payload.
 * Rules are small and explicit — one per topic — so the encoding for any
 * given topic is easy to audit against HeishaMon's `commands.cpp` and the
 * goldvectors in `test/fixtures/checksum-vectors.json`.
 *
 * Out of scope:
 * - Optional-PCB commands (set_pool_temp, set_buffer_temp, ...): those mutate
 *   the 20-byte optional-PCB frame, not the mainSet frame, and belong in a
 *   separate encoder module.
 * - Topics whose upstream encoding is unknown or ambiguous: those are listed
 *   here with `kind: 'notImplemented'` and produce a clear error on use.
 */

import { findByName } from './datapoints.js';
import { buildFrame } from './frames.js';

/**
 * Translation rule for a single writable topic. Discriminated by `kind` so
 * every rule documents its encoding strategy and inputs locally.
 */
type EncoderRule =
  | TempOffsetRule
  | EnumByteRule
  | LinearRule
  | NotImplementedRule;

/**
 * Group A: signed temperature offset. byte = value + 128. Range -128..+127.
 */
interface TempOffsetRule {
  readonly kind: 'tempOffset';
  readonly byte: number;
  readonly min?: number;
  readonly max?: number;
}

/**
 * Group B / C: small enum or flag value mapped to a fixed byte literal.
 *
 * `mapping[i]` is the byte value to emit when the user passes integer value `i`.
 * Values outside the array range are rejected with a clear error.
 */
interface EnumByteRule {
  readonly kind: 'enumByte';
  readonly byte: number;
  readonly mapping: readonly number[];
}

/**
 * `byte = value + offset`. Used for `Heater_Delay_Time`, `Max_Pump_Duty`,
 * etc. — wherever HeishaMon writes `value + 1`.
 */
interface LinearRule {
  readonly kind: 'linear';
  readonly byte: number;
  readonly offset: number;
  readonly min: number;
  readonly max: number;
}

/**
 * Placeholder for writable topics we have not yet reverse-engineered.
 * Calling the encoder with such a topic throws a descriptive error.
 */
interface NotImplementedRule {
  readonly kind: 'notImplemented';
  readonly reason: string;
}

/**
 * Default signed-temperature bounds for Group A. The wire byte is one
 * unsigned byte, value + 128, so the natural range is -128..+127. Individual
 * topics may tighten the range below; we keep the default permissive because
 * HeishaMon's `commands.cpp` does not enforce stricter limits either.
 */
const SIGNED_TEMP_MIN = -128;
const SIGNED_TEMP_MAX = 127;

const RULES: ReadonlyMap<string, EncoderRule> = new Map<string, EncoderRule>([
  // --- Group A: signed temperature offset (byte = value + 128) -------------
  ['Z1_Heat_Request_Temp', { kind: 'tempOffset', byte: 38 }],
  ['Z1_Cool_Request_Temp', { kind: 'tempOffset', byte: 39 }],
  ['Z2_Heat_Request_Temp', { kind: 'tempOffset', byte: 40 }],
  ['Z2_Cool_Request_Temp', { kind: 'tempOffset', byte: 41 }],
  ['DHW_Target_Temp', { kind: 'tempOffset', byte: 42 }],
  ['DHW_Heat_Delta', { kind: 'tempOffset', byte: 99 }],
  ['Heat_Delta', { kind: 'tempOffset', byte: 84 }],
  ['Cool_Delta', { kind: 'tempOffset', byte: 94 }],
  ['Heating_Off_Outdoor_Temp', { kind: 'tempOffset', byte: 83 }],
  ['Heater_On_Outdoor_Temp', { kind: 'tempOffset', byte: 85 }],
  ['Z1_Heat_Curve_Target_High_Temp', { kind: 'tempOffset', byte: 75 }],
  ['Z1_Heat_Curve_Target_Low_Temp', { kind: 'tempOffset', byte: 76 }],
  ['Z1_Heat_Curve_Outside_Low_Temp', { kind: 'tempOffset', byte: 77 }],
  ['Z1_Heat_Curve_Outside_High_Temp', { kind: 'tempOffset', byte: 78 }],
  ['Z2_Heat_Curve_Target_High_Temp', { kind: 'tempOffset', byte: 79 }],
  ['Z2_Heat_Curve_Target_Low_Temp', { kind: 'tempOffset', byte: 80 }],
  ['Z2_Heat_Curve_Outside_Low_Temp', { kind: 'tempOffset', byte: 81 }],
  ['Z2_Heat_Curve_Outside_High_Temp', { kind: 'tempOffset', byte: 82 }],
  ['Z1_Cool_Curve_Target_High_Temp', { kind: 'tempOffset', byte: 86 }],
  ['Z1_Cool_Curve_Target_Low_Temp', { kind: 'tempOffset', byte: 87 }],
  ['Z1_Cool_Curve_Outside_Low_Temp', { kind: 'tempOffset', byte: 88 }],
  ['Z1_Cool_Curve_Outside_High_Temp', { kind: 'tempOffset', byte: 89 }],
  ['Z2_Cool_Curve_Target_High_Temp', { kind: 'tempOffset', byte: 90 }],
  ['Z2_Cool_Curve_Target_Low_Temp', { kind: 'tempOffset', byte: 91 }],
  ['Z2_Cool_Curve_Outside_Low_Temp', { kind: 'tempOffset', byte: 92 }],
  ['Z2_Cool_Curve_Outside_High_Temp', { kind: 'tempOffset', byte: 93 }],
  ['Bivalent_Start_Temp', { kind: 'tempOffset', byte: 65 }],
  ['Bivalent_Advanced_Start_Temp', { kind: 'tempOffset', byte: 66 }],
  ['Bivalent_Advanced_Stop_Temp', { kind: 'tempOffset', byte: 68 }],
  ['Heater_Start_Delta', { kind: 'tempOffset', byte: 105 }],
  ['Heater_Stop_Delta', { kind: 'tempOffset', byte: 106 }],
  ['Buffer_Tank_Delta', { kind: 'tempOffset', byte: 59 }],

  // --- Group B: small enum mappings ---------------------------------------
  // Heatpump_State: 0 = Off (byte 4 = 1), 1 = On (byte 4 = 2).
  ['Heatpump_State', { kind: 'enumByte', byte: 4, mapping: [1, 2] }],

  // Operating_Mode_State: byte 6 enum, mirrors the decoder's getOpMode table
  // (which masks the lower 6 bits). The upstream `set_operation_mode` uses
  // 24/40 for value 2/6, but the decoder canonically maps to 25/41. We
  // follow the decoder so encode(decode(x)) == x for in-range bytes.
  ['Operating_Mode_State', {
    kind: 'enumByte',
    byte: 6,
    mapping: [18, 19, 25, 33, 34, 35, 41, 26, 42],
  }],

  // Quiet_Mode_Level: byte 7 = (value + 1) * 8. Values 0..3 -> 8, 16, 24, 32.
  ['Quiet_Mode_Level', { kind: 'enumByte', byte: 7, mapping: [8, 16, 24, 32] }],

  // Powerful_Mode_Time: byte 7 = (value + 1) & 0b111. Values 0..3 -> 1, 2, 3, 4.
  ['Powerful_Mode_Time', { kind: 'enumByte', byte: 7, mapping: [1, 2, 3, 4] }],

  // Holiday_Mode_State: 0 = Off (byte 5 = 16), 1 = On/Scheduled (byte 5 = 32).
  // The decoder also recognises a value 2 (full holiday) but upstream
  // `set_holiday_mode` only emits two values; we restrict accordingly.
  ['Holiday_Mode_State', { kind: 'enumByte', byte: 5, mapping: [16, 32] }],

  // Zones_State: 0 -> Z1 (64), 1 -> Z2 (128), 2 -> Both (192). Matches
  // upstream `set_zones`. Note: shares byte 6 with Operating_Mode_State; only
  // one is encoded per call.
  ['Zones_State', { kind: 'enumByte', byte: 6, mapping: [64, 128, 192] }],

  // --- Group C: flag bytes -------------------------------------------------
  // Force_DHW_State: 0 = Off (0x40), 1 = On (0x80). Source: set_force_DHW.
  ['Force_DHW_State', { kind: 'enumByte', byte: 4, mapping: [0x40, 0x80] }],
  // Main_Schedule_State: 0 = Off (0x40), 1 = On (0x80). Source: set_main_schedule.
  ['Main_Schedule_State', { kind: 'enumByte', byte: 5, mapping: [0x40, 0x80] }],
  // DHW_Heater_State: byte 9 = value << 2. 0 -> 4, 1 -> 8. Source:
  // set_dhw_heater_state (writes (value+1) << 2 = 0b01<<2 or 0b10<<2).
  ['DHW_Heater_State', { kind: 'enumByte', byte: 9, mapping: [0b01 << 2, 0b10 << 2] }],
  // Room_Heater_State: byte 9 = value (1 or 2). Source: set_room_heater_state.
  ['Room_Heater_State', { kind: 'enumByte', byte: 9, mapping: [0b01, 0b10] }],

  // --- Additional flag/enum topics from commands.cpp -----------------------
  // Buffer_Installed: byte 24, 0 -> 4, 1 -> 8 (set_buffer).
  ['Buffer_Installed', { kind: 'enumByte', byte: 24, mapping: [4, 8] }],
  // Smart_DHW: byte 24, value << 6. 0 -> 64, 1 -> 128 (set_smart_dhw).
  ['Smart_DHW', { kind: 'enumByte', byte: 24, mapping: [0b01 << 6, 0b10 << 6] }],
  // External_Pad_Heater: byte 25 (set_external_pad_heater). 0/1/2 -> 16/32/48.
  ['External_Pad_Heater', { kind: 'enumByte', byte: 25, mapping: [16, 32, 48] }],
  // External_Compressor_Control: byte 23, 0 -> 64, 1 -> 128.
  ['External_Compressor_Control', { kind: 'enumByte', byte: 23, mapping: [64, 128] }],
  // External_Error_Signal: byte 23, 0 -> 16, 1 -> 32.
  ['External_Error_Signal', { kind: 'enumByte', byte: 23, mapping: [16, 32] }],
  // External_Heat_Cool_Control: byte 23, 0 -> 4, 1 -> 8.
  ['External_Heat_Cool_Control', { kind: 'enumByte', byte: 23, mapping: [4, 8] }],
  // External_Control: byte 23, 0 -> 1, 1 -> 2.
  ['External_Control', { kind: 'enumByte', byte: 23, mapping: [1, 2] }],
  // Bivalent_Control: byte 26, 0 -> 1, 1 -> 2 (set_bivalent_control).
  ['Bivalent_Control', { kind: 'enumByte', byte: 26, mapping: [1, 2] }],
  // Bivalent_Mode: byte 26, 0 -> 4 (alt), 1 -> 8 (parallel), 2 -> 12 (advanced).
  ['Bivalent_Mode', { kind: 'enumByte', byte: 26, mapping: [4, 8, 12] }],
  // Heating_Control: byte 30 = value << 2. 0 -> 4, 1 -> 8.
  ['Heating_Control', { kind: 'enumByte', byte: 30, mapping: [0b01 << 2, 0b10 << 2] }],
  // Quiet_Mode_Priority: byte 11 = value << 4. 0 -> 16, 1 -> 32.
  ['Quiet_Mode_Priority', { kind: 'enumByte', byte: 11, mapping: [0b01 << 4, 0b10 << 4] }],
  // Pump_Flowrate_Mode: byte 29 = value << 4. 0 -> 16, 1 -> 32.
  ['Pump_Flowrate_Mode', { kind: 'enumByte', byte: 29, mapping: [0b01 << 4, 0b10 << 4] }],
  // Alt_External_Sensor: byte 20, 0 -> 16, 1 -> 32.
  ['Alt_External_Sensor', { kind: 'enumByte', byte: 20, mapping: [16, 32] }],
  // DHW_Sensor_Selection: byte 11, 0 -> 1, 1 -> 2 (set_dhw_sensor_selection).
  ['DHW_Sensor_Selection', { kind: 'enumByte', byte: 11, mapping: [1, 2] }],

  // --- Linear `value + 1` topics ------------------------------------------
  ['Max_Pump_Duty', { kind: 'linear', byte: 45, offset: 1, min: 0, max: 254 }],
  ['Heater_Delay_Time', { kind: 'linear', byte: 104, offset: 1, min: 0, max: 254 }],

  // --- Writable topics with no known upstream encoder ---------------------
  // Sterilization_State decodes from byte 117 but `commands.cpp` exposes only
  // `set_force_sterilization` (byte 8 = 0 or 4), which is a one-shot trigger,
  // not a state setter. Mark as not implemented to avoid a wrong guess.
  ['Sterilization_State', {
    kind: 'notImplemented',
    reason: 'no upstream HeishaMon set_* function maps to byte 117',
  }],
]);

/**
 * Encode a write-command (mainSet frame) for a single writable datapoint.
 * Returns a complete 111-byte frame ready to be transmitted (header +
 * payload + checksum).
 *
 * @throws RangeError if no datapoint with the given name exists, or if
 *         the datapoint is not writable.
 * @throws Error if the value is out of the documented range, or if the
 *         encoder for this topic is not yet implemented.
 */
export function encodeSetCommand(name: string, value: number): Uint8Array {
  const datapoint = findByName(name);
  if (!datapoint) {
    throw new RangeError(`unknown datapoint: ${name}`);
  }
  if (!datapoint.writable) {
    throw new RangeError(`datapoint "${name}" is not writable`);
  }

  const rule = RULES.get(name);
  if (!rule) {
    throw new Error(
      `encoder for "${name}" not implemented yet: no rule registered`,
    );
  }

  return buildFrame('mainSet', (payload) => applyRule(payload, name, rule, value));
}

function applyRule(
  payload: Uint8Array,
  name: string,
  rule: EncoderRule,
  value: number,
): void {
  switch (rule.kind) {
    case 'tempOffset':
      payload[rule.byte] = encodeTempOffset(name, rule, value);
      return;
    case 'enumByte':
      payload[rule.byte] = encodeEnumByte(name, rule, value);
      return;
    case 'linear':
      payload[rule.byte] = encodeLinear(name, rule, value);
      return;
    case 'notImplemented':
      throw new Error(
        `encoder for "${name}" not implemented yet: ${rule.reason}`,
      );
  }
}

function encodeTempOffset(name: string, rule: TempOffsetRule, value: number): number {
  requireFiniteInteger(name, value);
  const min = rule.min ?? SIGNED_TEMP_MIN;
  const max = rule.max ?? SIGNED_TEMP_MAX;
  if (value < min || value > max) {
    throw new Error(
      `value ${value} out of range for "${name}" (allowed: ${min}..${max})`,
    );
  }
  return (value + 128) & 0xff;
}

function encodeEnumByte(name: string, rule: EnumByteRule, value: number): number {
  requireFiniteInteger(name, value);
  if (value < 0 || value >= rule.mapping.length) {
    throw new Error(
      `value ${value} out of range for "${name}" (allowed: 0..${rule.mapping.length - 1})`,
    );
  }
  return rule.mapping[value]!;
}

function encodeLinear(name: string, rule: LinearRule, value: number): number {
  requireFiniteInteger(name, value);
  if (value < rule.min || value > rule.max) {
    throw new Error(
      `value ${value} out of range for "${name}" (allowed: ${rule.min}..${rule.max})`,
    );
  }
  return (value + rule.offset) & 0xff;
}

function requireFiniteInteger(name: string, value: number): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error(`value for "${name}" must be a finite integer, got ${value}`);
  }
}
