/**
 * Heat-pump simulator state model.
 *
 * Holds the current value for each HeishaMon datapoint (157 in total:
 * 144 main + 7 optional-PCB + 6 extra). Keys are identical to the
 * HeishaMon MQTT topic suffixes (case-sensitive), matching the
 * `name` field of every entry in `MAIN_DATAPOINTS`, `OPTIONAL_DATAPOINTS`
 * and `EXTRA_DATAPOINTS` from `heishamon-protocol`.
 *
 * The simulator's response builders read values out of this record and
 * serialise them back into wire frames; the router writes into it when
 * a set-command arrives.
 */

import {
  ALL_DATAPOINTS,
  EXTRA_DATAPOINTS,
  MAIN_DATAPOINTS,
  OPTIONAL_DATAPOINTS,
} from 'heishamon-protocol';

/**
 * Mutable map from datapoint topic suffix to its current value. String
 * values are only used for the three string-typed special-case topics
 * (`Error`, `Heat_Pump_Model`); every other datapoint stores a number.
 */
export type HeatPumpState = Record<string, number | string>;

/**
 * 10-byte heat-pump model identifier used as the simulator default.
 * Matches the value carried in the project's golden test frames.
 */
const DEFAULT_HEAT_PUMP_MODEL_HEX = 'E2 CE 0D 71 81 72 CE 0C 92 81';

/**
 * Plausible starting values for selected datapoints. Anything not listed
 * here defaults to 0 (numeric topics) or '' (string topics) — see
 * `createDefaultState()` below.
 */
const EXPLICIT_DEFAULTS: Readonly<Record<string, number | string>> = {
  // High-level state: pump is running in heating mode, no holiday/quiet/etc.
  Heatpump_State: 1,
  Operating_Mode_State: 0,
  Main_Schedule_State: 0,
  Holiday_Mode_State: 0,
  Force_DHW_State: 0,
  Quiet_Mode_Schedule: 0,
  Quiet_Mode_Level: 0,
  Powerful_Mode_Time: 0,
  Quiet_Mode_Priority: 0,
  Zones_State: 0,
  Heating_Mode: 0,
  Cooling_Mode: 0,

  // Core water-loop temperatures — typical mid-load heating point.
  Main_Inlet_Temp: 30,
  Main_Outlet_Temp: 35,
  Main_Target_Temp: 35,
  Main_Hex_Outlet_Temp: 36,
  Outside_Temp: 5,
  Outside_Pipe_Temp: 3,
  Inside_Pipe_Temp: 28,
  Z1_Water_Temp: 35,
  Z2_Water_Temp: 35,
  Z1_Water_Target_Temp: 35,
  Z2_Water_Target_Temp: 35,
  Z1_Temp: 21,
  Z2_Temp: 21,
  Room_Thermostat_Temp: 21,
  Second_Room_Thermostat_Temp: 21,
  Second_Inlet_Temp: 30,
  Economizer_Outlet_Temp: 25,
  Buffer_Temp: 35,
  Solar_Temp: 20,
  Pool_Temp: 25,
  Discharge_Temp: 60,
  Defrost_Temp: 0,
  Eva_Outlet_Temp: -2,
  Bypass_Outlet_Temp: 30,
  Ipm_Temp: 40,

  // DHW: tank at 50 °C, target 48 °C.
  DHW_Temp: 50,
  DHW_Target_Temp: 48,
  DHW_Holiday_Shift_Temp: 0,
  Room_Holiday_Shift_Temp: 0,

  // Deltas — all zero unless we have a documented default.
  DHW_Heat_Delta: 5,
  Heat_Delta: 5,
  Cool_Delta: 5,
  Buffer_Tank_Delta: 5,
  Heater_Start_Delta: -5,
  Heater_Stop_Delta: 5,

  // Pump / compressor — heat pump is "running" lightly.
  Compressor_Freq: 30,
  Compressor_Current: 5,
  High_Pressure: 30,
  Low_Pressure: 10,
  Pump_Flow: 15.0,
  Pump_Speed: 2500,
  Pump_Duty: 50,
  Max_Pump_Duty: 100,
  Fan1_Motor_Speed: 500,
  Fan2_Motor_Speed: 0,
  Expansion_Valve: 200,

  // Operating counters start fresh.
  Operations_Hours: 0,
  Operations_Counter: 0,
  Room_Heater_Operations_Hours: 0,
  DHW_Heater_Operations_Hours: 0,

  // Power — idle / minimal heating contribution.
  Heat_Power_Production: 0,
  Heat_Power_Consumption: 0,
  Cool_Power_Production: 0,
  Cool_Power_Consumption: 0,
  DHW_Power_Production: 0,
  DHW_Power_Consumption: 0,

  // Configuration / installed equipment flags.
  Buffer_Installed: 0,
  DHW_Installed: 1,
  Solar_Mode: 0,
  Optional_PCB: 0,
  Liquid_Type: 0,
  Alt_External_Sensor: 0,
  Anti_Freeze_Mode: 0,
  Smart_DHW: 0,

  // Error topic — empty string decodes back to "No error".
  Error: 'No error',
  Heat_Pump_Model: DEFAULT_HEAT_PUMP_MODEL_HEX,

  // Sterilization off.
  Sterilization_State: 0,
  Sterilization_Temp: 65,
  Sterilization_Max_Time: 30,

  // Water pressure ~2 bar.
  Water_Pressure: 2.0,

  // Curve / external controls all off / neutral.
  Heating_Off_Outdoor_Temp: 20,
  Heater_On_Outdoor_Temp: 0,
  Heat_To_Cool_Temp: 18,
  Cool_To_Heat_Temp: 17,
};

/**
 * Datapoint names whose decoder produces a string. Used to pick the
 * correct fallback default for topics not in `EXPLICIT_DEFAULTS`.
 */
const STRING_TOPICS: ReadonlySet<string> = new Set(['Error', 'Heat_Pump_Model']);

/**
 * Build a fresh `HeatPumpState` with plausible defaults for every
 * datapoint. Each invocation returns an independent object — callers
 * are free to mutate it without affecting other states.
 */
export function createDefaultState(): HeatPumpState {
  const state: HeatPumpState = {};
  for (const datapoint of ALL_DATAPOINTS) {
    const explicit = EXPLICIT_DEFAULTS[datapoint.name];
    if (explicit !== undefined) {
      state[datapoint.name] = explicit;
      continue;
    }
    state[datapoint.name] = STRING_TOPICS.has(datapoint.name) ? '' : 0;
  }
  return state;
}

/**
 * Convenience constant: the number of datapoints any complete state
 * should contain (144 main + 7 optional + 6 extra = 157).
 */
export const TOTAL_DATAPOINT_COUNT =
  MAIN_DATAPOINTS.length + OPTIONAL_DATAPOINTS.length + EXTRA_DATAPOINTS.length;
