/**
 * HeishaMon datapoint table.
 *
 * This module is a pure data table. It mirrors `docs/protocol/datapoints.md`
 * 1:1 (157 datapoints across three frames). Decoder logic lives elsewhere.
 *
 * Datapoint names are identical to the HeishaMon MQTT topic suffixes
 * (case-sensitive) — this is a hard project convention.
 */

/**
 * Identifies which frame a datapoint originates from.
 *
 * - `'main'`     — main response frame (`0x71 0xC8 ... 0x01 0x10`), 203 bytes.
 * - `'extra'`    — extra-block response (`0x71 0xC8 ... 0x01 0x21`), 203 bytes,
 *                  K/L-series only. XTOP values are little-endian 16-bit
 *                  pairs spanning `byte` and `byte + 1`.
 * - `'optional'` — optional-PCB frame (`0xF1 0x11 ... 0x01 0x50`), 20 bytes.
 */
export type FrameSource = 'main' | 'extra' | 'optional';

/**
 * Decoder function names from HeishaMon's `decode.h`. The union is the set of
 * values that actually appear in `docs/protocol/datapoints.md`.
 *
 * `'unknown'` marks the seven main-frame datapoints whose decoder is a
 * special-case dispatch in HeishaMon (see `getDataValue()` in `decode.cpp`):
 * Pump_Flow, Operations_Hours, Operations_Counter, Error,
 * Room_Heater_Operations_Hours, DHW_Heater_Operations_Hours, Heat_Pump_Model.
 */
export type DecoderKind =
  | 'getBit1'
  | 'getBit1and2'
  | 'getBit3and4'
  | 'getBit3and4and5'
  | 'getBit5and6'
  | 'getBit7and8'
  | 'getRight3bits'
  | 'getIntMinus1'
  | 'getIntMinus128'
  | 'getIntMinus1Div5'
  | 'getIntMinus1Div50'
  | 'getIntMinus1Times10'
  | 'getIntMinus1Times50'
  | 'getOpMode'
  | 'getPower'
  | 'getUintt16'
  | 'getErrorInfo'
  | 'getPumpFlow'
  | 'getValvePID'
  | 'getFirstByte'
  | 'getSecondByte'
  | 'getOptDataValue'
  | 'getDataValue'
  | 'unknown';

export interface DataPoint {
  /** Stable identifier from the upstream tables: `TOPnn`, `OPTn`, `XTOPn`. */
  readonly id: string;
  /** Topic suffix used in MQTT and as the ioBroker state key. Case-sensitive. */
  readonly name: string;
  readonly source: FrameSource;
  /** Byte offset within the source frame. For XTOPs the value spans `byte` and `byte + 1`. */
  readonly byte: number;
  readonly decoder: DecoderKind;
  /** True if HeishaMon exposes a `set_*` command for this topic. */
  readonly writable: boolean;
  /** Physical unit ("°C", "Watt", "min", ...). Omitted when the upstream table shows "—". */
  readonly unit?: string;
  /** Short English description (< 80 chars). Omitted when no useful description exists. */
  readonly description?: string;
}

/**
 * Main-frame datapoints (TOP0–TOP143). Byte offsets refer to the 203-byte
 * main response frame, including the 4-byte header. The checksum is at
 * offset 202, so all offsets are < 203.
 *
 * Order matches `docs/protocol/datapoints.md`, table 1.
 */
export const MAIN_DATAPOINTS: readonly DataPoint[] = [
  { id: 'TOP0', name: 'Heatpump_State', source: 'main', byte: 4, decoder: 'getBit7and8', writable: true, unit: 'On/Off', description: 'Heatpump on/off state' },
  { id: 'TOP1', name: 'Pump_Flow', source: 'main', byte: 0, decoder: 'unknown', writable: false, unit: 'l/min', description: 'Circulation pump flow rate' },
  { id: 'TOP2', name: 'Force_DHW_State', source: 'main', byte: 4, decoder: 'getBit1and2', writable: true, description: 'Force DHW production' },
  { id: 'TOP3', name: 'Quiet_Mode_Schedule', source: 'main', byte: 7, decoder: 'getBit1and2', writable: false, description: 'Quiet mode schedule active' },
  { id: 'TOP4', name: 'Operating_Mode_State', source: 'main', byte: 6, decoder: 'getOpMode', writable: true, description: 'Operating mode (heat/cool/auto/DHW/combinations)' },
  { id: 'TOP5', name: 'Main_Inlet_Temp', source: 'main', byte: 143, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Main inlet water temperature' },
  { id: 'TOP6', name: 'Main_Outlet_Temp', source: 'main', byte: 144, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Main outlet water temperature' },
  { id: 'TOP7', name: 'Main_Target_Temp', source: 'main', byte: 153, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Main outlet target temperature' },
  { id: 'TOP8', name: 'Compressor_Freq', source: 'main', byte: 166, decoder: 'getIntMinus1', writable: false, unit: 'Hz', description: 'Compressor frequency' },
  { id: 'TOP9', name: 'DHW_Target_Temp', source: 'main', byte: 42, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'DHW target temperature' },
  { id: 'TOP10', name: 'DHW_Temp', source: 'main', byte: 141, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'DHW actual temperature' },
  { id: 'TOP11', name: 'Operations_Hours', source: 'main', byte: 0, decoder: 'unknown', writable: false, unit: 'h', description: 'Heatpump operating hours' },
  { id: 'TOP12', name: 'Operations_Counter', source: 'main', byte: 0, decoder: 'unknown', writable: false, unit: 'count', description: 'Heatpump start counter' },
  { id: 'TOP13', name: 'Main_Schedule_State', source: 'main', byte: 5, decoder: 'getBit1and2', writable: true, description: 'Main thermostat schedule active' },
  { id: 'TOP14', name: 'Outside_Temp', source: 'main', byte: 142, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Outdoor temperature' },
  { id: 'TOP15', name: 'Heat_Power_Production', source: 'main', byte: 194, decoder: 'getPower', writable: false, unit: 'Watt', description: 'Thermal heating power produced' },
  { id: 'TOP16', name: 'Heat_Power_Consumption', source: 'main', byte: 193, decoder: 'getPower', writable: false, unit: 'Watt', description: 'Electrical heating power consumed' },
  { id: 'TOP17', name: 'Powerful_Mode_Time', source: 'main', byte: 7, decoder: 'getRight3bits', writable: true, unit: 'min', description: 'Powerful mode duration' },
  { id: 'TOP18', name: 'Quiet_Mode_Level', source: 'main', byte: 7, decoder: 'getBit3and4and5', writable: true, description: 'Quiet mode level' },
  { id: 'TOP19', name: 'Holiday_Mode_State', source: 'main', byte: 5, decoder: 'getBit3and4', writable: true, description: 'Holiday mode state' },
  { id: 'TOP20', name: 'ThreeWay_Valve_State', source: 'main', byte: 111, decoder: 'getBit7and8', writable: false, description: 'Three-way valve position (room/DHW)' },
  { id: 'TOP21', name: 'Outside_Pipe_Temp', source: 'main', byte: 158, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Outside pipe temperature' },
  { id: 'TOP22', name: 'DHW_Heat_Delta', source: 'main', byte: 99, decoder: 'getIntMinus128', writable: true, unit: 'K', description: 'DHW heating delta-T' },
  { id: 'TOP23', name: 'Heat_Delta', source: 'main', byte: 84, decoder: 'getIntMinus128', writable: true, unit: 'K', description: 'Floor heating delta-T' },
  { id: 'TOP24', name: 'Cool_Delta', source: 'main', byte: 94, decoder: 'getIntMinus128', writable: true, unit: 'K', description: 'Floor cooling delta-T' },
  { id: 'TOP25', name: 'DHW_Holiday_Shift_Temp', source: 'main', byte: 44, decoder: 'getIntMinus128', writable: false, unit: 'K', description: 'DHW holiday shift offset' },
  { id: 'TOP26', name: 'Defrosting_State', source: 'main', byte: 111, decoder: 'getBit5and6', writable: false, description: 'Defrosting active' },
  { id: 'TOP27', name: 'Z1_Heat_Request_Temp', source: 'main', byte: 38, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Zone 1 heat request (shift or direct)' },
  { id: 'TOP28', name: 'Z1_Cool_Request_Temp', source: 'main', byte: 39, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Zone 1 cool request (shift or direct)' },
  { id: 'TOP29', name: 'Z1_Heat_Curve_Target_High_Temp', source: 'main', byte: 75, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z1 heat curve target high' },
  { id: 'TOP30', name: 'Z1_Heat_Curve_Target_Low_Temp', source: 'main', byte: 76, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z1 heat curve target low' },
  { id: 'TOP31', name: 'Z1_Heat_Curve_Outside_High_Temp', source: 'main', byte: 78, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z1 heat curve outside high' },
  { id: 'TOP32', name: 'Z1_Heat_Curve_Outside_Low_Temp', source: 'main', byte: 77, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z1 heat curve outside low' },
  { id: 'TOP33', name: 'Room_Thermostat_Temp', source: 'main', byte: 156, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Room temperature (remote sensor)' },
  { id: 'TOP34', name: 'Z2_Heat_Request_Temp', source: 'main', byte: 40, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Zone 2 heat request (shift or direct)' },
  { id: 'TOP35', name: 'Z2_Cool_Request_Temp', source: 'main', byte: 41, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Zone 2 cool request (shift or direct)' },
  { id: 'TOP36', name: 'Z1_Water_Temp', source: 'main', byte: 145, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Zone 1 water outlet temperature' },
  { id: 'TOP37', name: 'Z2_Water_Temp', source: 'main', byte: 146, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Zone 2 water outlet temperature' },
  { id: 'TOP38', name: 'Cool_Power_Production', source: 'main', byte: 196, decoder: 'getPower', writable: false, unit: 'Watt', description: 'Thermal cooling power produced' },
  { id: 'TOP39', name: 'Cool_Power_Consumption', source: 'main', byte: 195, decoder: 'getPower', writable: false, unit: 'Watt', description: 'Electrical cooling power consumed' },
  { id: 'TOP40', name: 'DHW_Power_Production', source: 'main', byte: 198, decoder: 'getPower', writable: false, unit: 'Watt', description: 'Thermal DHW power produced' },
  { id: 'TOP41', name: 'DHW_Power_Consumption', source: 'main', byte: 197, decoder: 'getPower', writable: false, unit: 'Watt', description: 'Electrical DHW power consumed' },
  { id: 'TOP42', name: 'Z1_Water_Target_Temp', source: 'main', byte: 147, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Zone 1 water target temperature' },
  { id: 'TOP43', name: 'Z2_Water_Target_Temp', source: 'main', byte: 148, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Zone 2 water target temperature' },
  { id: 'TOP44', name: 'Error', source: 'main', byte: 0, decoder: 'unknown', writable: false, description: 'Last error code (Fxx, Hxx, or none)' },
  { id: 'TOP45', name: 'Room_Holiday_Shift_Temp', source: 'main', byte: 43, decoder: 'getIntMinus128', writable: false, unit: 'K', description: 'Room holiday shift offset' },
  { id: 'TOP46', name: 'Buffer_Temp', source: 'main', byte: 149, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Buffer tank temperature' },
  { id: 'TOP47', name: 'Solar_Temp', source: 'main', byte: 150, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Solar collector temperature' },
  { id: 'TOP48', name: 'Pool_Temp', source: 'main', byte: 151, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Pool temperature' },
  { id: 'TOP49', name: 'Main_Hex_Outlet_Temp', source: 'main', byte: 154, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Heat exchanger outlet temperature' },
  { id: 'TOP50', name: 'Discharge_Temp', source: 'main', byte: 155, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Compressor discharge temperature' },
  { id: 'TOP51', name: 'Inside_Pipe_Temp', source: 'main', byte: 157, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Inside pipe temperature' },
  { id: 'TOP52', name: 'Defrost_Temp', source: 'main', byte: 159, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Defrost temperature' },
  { id: 'TOP53', name: 'Eva_Outlet_Temp', source: 'main', byte: 160, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Evaporator outlet temperature' },
  { id: 'TOP54', name: 'Bypass_Outlet_Temp', source: 'main', byte: 161, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Bypass outlet temperature' },
  { id: 'TOP55', name: 'Ipm_Temp', source: 'main', byte: 162, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'IPM (power module) temperature' },
  { id: 'TOP56', name: 'Z1_Temp', source: 'main', byte: 139, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Zone 1 actual temperature' },
  { id: 'TOP57', name: 'Z2_Temp', source: 'main', byte: 140, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Zone 2 actual temperature' },
  { id: 'TOP58', name: 'DHW_Heater_State', source: 'main', byte: 9, decoder: 'getBit5and6', writable: true, description: 'DHW backup heater enabled' },
  { id: 'TOP59', name: 'Room_Heater_State', source: 'main', byte: 9, decoder: 'getBit7and8', writable: true, description: 'Room backup heater enabled' },
  { id: 'TOP60', name: 'Internal_Heater_State', source: 'main', byte: 112, decoder: 'getBit7and8', writable: false, description: 'Internal heater active' },
  { id: 'TOP61', name: 'External_Heater_State', source: 'main', byte: 112, decoder: 'getBit5and6', writable: false, description: 'External heater active' },
  { id: 'TOP62', name: 'Fan1_Motor_Speed', source: 'main', byte: 173, decoder: 'getIntMinus1Times10', writable: false, unit: 'r/min', description: 'Fan 1 motor speed' },
  { id: 'TOP63', name: 'Fan2_Motor_Speed', source: 'main', byte: 174, decoder: 'getIntMinus1Times10', writable: false, unit: 'r/min', description: 'Fan 2 motor speed' },
  { id: 'TOP64', name: 'High_Pressure', source: 'main', byte: 163, decoder: 'getIntMinus1Div5', writable: false, unit: 'Kgf/cm²', description: 'Compressor high-side pressure' },
  { id: 'TOP65', name: 'Pump_Speed', source: 'main', byte: 171, decoder: 'getIntMinus1Times50', writable: false, unit: 'r/min', description: 'Circulation pump speed' },
  { id: 'TOP66', name: 'Low_Pressure', source: 'main', byte: 164, decoder: 'getIntMinus1Times50', writable: false, unit: 'Kgf/cm²', description: 'Evaporator low-side pressure' },
  { id: 'TOP67', name: 'Compressor_Current', source: 'main', byte: 165, decoder: 'getIntMinus1Div5', writable: false, unit: 'Ampere', description: 'Compressor current draw' },
  { id: 'TOP68', name: 'Force_Heater_State', source: 'main', byte: 5, decoder: 'getBit5and6', writable: false, description: 'Force heater active' },
  { id: 'TOP69', name: 'Sterilization_State', source: 'main', byte: 117, decoder: 'getBit5and6', writable: true, description: 'Sterilization cycle active' },
  { id: 'TOP70', name: 'Sterilization_Temp', source: 'main', byte: 100, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Sterilization target temperature' },
  { id: 'TOP71', name: 'Sterilization_Max_Time', source: 'main', byte: 101, decoder: 'getIntMinus1', writable: false, unit: 'min', description: 'Maximum sterilization time' },
  { id: 'TOP72', name: 'Z1_Cool_Curve_Target_High_Temp', source: 'main', byte: 86, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z1 cool curve target high' },
  { id: 'TOP73', name: 'Z1_Cool_Curve_Target_Low_Temp', source: 'main', byte: 87, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z1 cool curve target low' },
  { id: 'TOP74', name: 'Z1_Cool_Curve_Outside_High_Temp', source: 'main', byte: 89, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z1 cool curve outside high' },
  { id: 'TOP75', name: 'Z1_Cool_Curve_Outside_Low_Temp', source: 'main', byte: 88, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z1 cool curve outside low' },
  { id: 'TOP76', name: 'Heating_Mode', source: 'main', byte: 28, decoder: 'getBit7and8', writable: false, description: 'Heating mode (compensation curve or direct)' },
  { id: 'TOP77', name: 'Heating_Off_Outdoor_Temp', source: 'main', byte: 83, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Outdoor temp threshold to stop heating' },
  { id: 'TOP78', name: 'Heater_On_Outdoor_Temp', source: 'main', byte: 85, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Outdoor temp threshold to enable heater' },
  { id: 'TOP79', name: 'Heat_To_Cool_Temp', source: 'main', byte: 95, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Auto switch threshold heat to cool' },
  { id: 'TOP80', name: 'Cool_To_Heat_Temp', source: 'main', byte: 96, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Auto switch threshold cool to heat' },
  { id: 'TOP81', name: 'Cooling_Mode', source: 'main', byte: 28, decoder: 'getBit5and6', writable: false, description: 'Cooling mode (compensation curve or direct)' },
  { id: 'TOP82', name: 'Z2_Heat_Curve_Target_High_Temp', source: 'main', byte: 79, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z2 heat curve target high' },
  { id: 'TOP83', name: 'Z2_Heat_Curve_Target_Low_Temp', source: 'main', byte: 80, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z2 heat curve target low' },
  { id: 'TOP84', name: 'Z2_Heat_Curve_Outside_High_Temp', source: 'main', byte: 82, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z2 heat curve outside high' },
  { id: 'TOP85', name: 'Z2_Heat_Curve_Outside_Low_Temp', source: 'main', byte: 81, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z2 heat curve outside low' },
  { id: 'TOP86', name: 'Z2_Cool_Curve_Target_High_Temp', source: 'main', byte: 90, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z2 cool curve target high' },
  { id: 'TOP87', name: 'Z2_Cool_Curve_Target_Low_Temp', source: 'main', byte: 91, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z2 cool curve target low' },
  { id: 'TOP88', name: 'Z2_Cool_Curve_Outside_High_Temp', source: 'main', byte: 93, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z2 cool curve outside high' },
  { id: 'TOP89', name: 'Z2_Cool_Curve_Outside_Low_Temp', source: 'main', byte: 92, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Z2 cool curve outside low' },
  { id: 'TOP90', name: 'Room_Heater_Operations_Hours', source: 'main', byte: 0, decoder: 'unknown', writable: false, unit: 'h', description: 'Room backup heater operating hours' },
  { id: 'TOP91', name: 'DHW_Heater_Operations_Hours', source: 'main', byte: 0, decoder: 'unknown', writable: false, unit: 'h', description: 'DHW backup heater operating hours' },
  { id: 'TOP92', name: 'Heat_Pump_Model', source: 'main', byte: 0, decoder: 'unknown', writable: false, description: 'Heat pump model identifier (hex)' },
  { id: 'TOP93', name: 'Pump_Duty', source: 'main', byte: 172, decoder: 'getIntMinus1', writable: false, unit: '%', description: 'Circulation pump duty cycle' },
  { id: 'TOP94', name: 'Zones_State', source: 'main', byte: 6, decoder: 'getBit1and2', writable: true, description: 'Active zones (Z1, Z2, or both)' },
  { id: 'TOP95', name: 'Max_Pump_Duty', source: 'main', byte: 45, decoder: 'getIntMinus1', writable: true, unit: '%', description: 'Maximum pump duty cycle' },
  { id: 'TOP96', name: 'Heater_Delay_Time', source: 'main', byte: 104, decoder: 'getIntMinus1', writable: true, unit: 'min', description: 'Backup heater start delay' },
  { id: 'TOP97', name: 'Heater_Start_Delta', source: 'main', byte: 105, decoder: 'getIntMinus128', writable: true, unit: 'K', description: 'Backup heater start delta-T' },
  { id: 'TOP98', name: 'Heater_Stop_Delta', source: 'main', byte: 106, decoder: 'getIntMinus128', writable: true, unit: 'K', description: 'Backup heater stop delta-T' },
  { id: 'TOP99', name: 'Buffer_Installed', source: 'main', byte: 24, decoder: 'getBit5and6', writable: true, description: 'Buffer tank installed' },
  { id: 'TOP100', name: 'DHW_Installed', source: 'main', byte: 24, decoder: 'getBit7and8', writable: false, description: 'DHW tank installed' },
  { id: 'TOP101', name: 'Solar_Mode', source: 'main', byte: 24, decoder: 'getBit3and4', writable: false, description: 'Solar integration mode' },
  { id: 'TOP102', name: 'Solar_On_Delta', source: 'main', byte: 61, decoder: 'getIntMinus128', writable: false, unit: 'K', description: 'Solar pump on delta-T' },
  { id: 'TOP103', name: 'Solar_Off_Delta', source: 'main', byte: 62, decoder: 'getIntMinus128', writable: false, unit: 'K', description: 'Solar pump off delta-T' },
  { id: 'TOP104', name: 'Solar_Frost_Protection', source: 'main', byte: 63, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Solar frost protection temperature' },
  { id: 'TOP105', name: 'Solar_High_Limit', source: 'main', byte: 64, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Solar maximum temperature limit' },
  { id: 'TOP106', name: 'Pump_Flowrate_Mode', source: 'main', byte: 29, decoder: 'getBit3and4', writable: true, description: 'Pump flow rate control mode' },
  { id: 'TOP107', name: 'Liquid_Type', source: 'main', byte: 20, decoder: 'getBit1', writable: false, description: 'Heat transfer fluid type (water or glycol)' },
  { id: 'TOP108', name: 'Alt_External_Sensor', source: 'main', byte: 20, decoder: 'getBit3and4', writable: true, description: 'Alternative external outdoor sensor active' },
  { id: 'TOP109', name: 'Anti_Freeze_Mode', source: 'main', byte: 20, decoder: 'getBit5and6', writable: false, description: 'Anti-freeze mode enabled' },
  { id: 'TOP110', name: 'Optional_PCB', source: 'main', byte: 20, decoder: 'getBit7and8', writable: false, description: 'Optional PCB installed' },
  { id: 'TOP111', name: 'Z1_Sensor_Settings', source: 'main', byte: 22, decoder: 'getSecondByte', writable: false, description: 'Zone 1 sensor configuration' },
  { id: 'TOP112', name: 'Z2_Sensor_Settings', source: 'main', byte: 22, decoder: 'getFirstByte', writable: false, description: 'Zone 2 sensor configuration' },
  { id: 'TOP113', name: 'Buffer_Tank_Delta', source: 'main', byte: 59, decoder: 'getIntMinus128', writable: true, unit: 'K', description: 'Buffer tank delta-T' },
  { id: 'TOP114', name: 'External_Pad_Heater', source: 'main', byte: 25, decoder: 'getBit3and4', writable: true, description: 'External pad heater configuration' },
  { id: 'TOP115', name: 'Water_Pressure', source: 'main', byte: 125, decoder: 'getIntMinus1Div50', writable: false, unit: 'bar', description: 'Water pressure' },
  { id: 'TOP116', name: 'Second_Inlet_Temp', source: 'main', byte: 126, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Second inlet temperature' },
  { id: 'TOP117', name: 'Economizer_Outlet_Temp', source: 'main', byte: 127, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Economizer outlet temperature' },
  { id: 'TOP118', name: 'Second_Room_Thermostat_Temp', source: 'main', byte: 128, decoder: 'getIntMinus128', writable: false, unit: '°C', description: 'Second room thermostat temperature' },
  { id: 'TOP119', name: 'External_Control', source: 'main', byte: 23, decoder: 'getBit7and8', writable: true, description: 'External control input enabled' },
  { id: 'TOP120', name: 'External_Heat_Cool_Control', source: 'main', byte: 23, decoder: 'getBit5and6', writable: true, description: 'External heat/cool control enabled' },
  { id: 'TOP121', name: 'External_Error_Signal', source: 'main', byte: 23, decoder: 'getBit3and4', writable: true, description: 'External error signal enabled' },
  { id: 'TOP122', name: 'External_Compressor_Control', source: 'main', byte: 23, decoder: 'getBit1and2', writable: true, description: 'External compressor control enabled' },
  { id: 'TOP123', name: 'Z1_Pump_State', source: 'main', byte: 116, decoder: 'getBit1and2', writable: false, description: 'Zone 1 pump on/off' },
  { id: 'TOP124', name: 'Z2_Pump_State', source: 'main', byte: 116, decoder: 'getBit3and4', writable: false, description: 'Zone 2 pump on/off' },
  { id: 'TOP125', name: 'TwoWay_Valve_State', source: 'main', byte: 116, decoder: 'getBit5and6', writable: false, description: 'Two-way valve position (cool/heat)' },
  { id: 'TOP126', name: 'ThreeWay_Valve_State2', source: 'main', byte: 116, decoder: 'getBit7and8', writable: false, description: 'Three-way valve position (second source)' },
  { id: 'TOP127', name: 'Z1_Valve_PID', source: 'main', byte: 177, decoder: 'getValvePID', writable: false, unit: '%', description: 'Z1 mixing valve PID output' },
  { id: 'TOP128', name: 'Z2_Valve_PID', source: 'main', byte: 178, decoder: 'getValvePID', writable: false, unit: '%', description: 'Z2 mixing valve PID output' },
  { id: 'TOP129', name: 'Bivalent_Control', source: 'main', byte: 26, decoder: 'getBit7and8', writable: true, description: 'Bivalent control enabled' },
  { id: 'TOP130', name: 'Bivalent_Mode', source: 'main', byte: 26, decoder: 'getBit5and6', writable: true, description: 'Bivalent operating mode' },
  { id: 'TOP131', name: 'Bivalent_Start_Temp', source: 'main', byte: 65, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Bivalent start temperature' },
  { id: 'TOP132', name: 'Bivalent_Advanced_Heat', source: 'main', byte: 26, decoder: 'getBit3and4', writable: false, description: 'Bivalent advanced heating enabled' },
  { id: 'TOP133', name: 'Bivalent_Advanced_DHW', source: 'main', byte: 26, decoder: 'getBit1and2', writable: false, description: 'Bivalent advanced DHW enabled' },
  { id: 'TOP134', name: 'Bivalent_Advanced_Start_Temp', source: 'main', byte: 66, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Bivalent advanced start temperature' },
  { id: 'TOP135', name: 'Bivalent_Advanced_Stop_Temp', source: 'main', byte: 68, decoder: 'getIntMinus128', writable: true, unit: '°C', description: 'Bivalent advanced stop temperature' },
  { id: 'TOP136', name: 'Bivalent_Advanced_Start_Delay', source: 'main', byte: 67, decoder: 'getIntMinus1', writable: false, unit: 'min', description: 'Bivalent advanced start delay' },
  { id: 'TOP137', name: 'Bivalent_Advanced_Stop_Delay', source: 'main', byte: 69, decoder: 'getIntMinus1', writable: false, unit: 'min', description: 'Bivalent advanced stop delay' },
  { id: 'TOP138', name: 'Bivalent_Advanced_DHW_Delay', source: 'main', byte: 70, decoder: 'getIntMinus1', writable: false, unit: 'min', description: 'Bivalent advanced DHW delay' },
  { id: 'TOP139', name: 'Heating_Control', source: 'main', byte: 30, decoder: 'getBit5and6', writable: true, description: 'Heating control mode (comfort/efficiency)' },
  { id: 'TOP140', name: 'Smart_DHW', source: 'main', byte: 24, decoder: 'getBit1and2', writable: true, description: 'Smart DHW mode (variable/standard)' },
  { id: 'TOP141', name: 'Quiet_Mode_Priority', source: 'main', byte: 11, decoder: 'getBit3and4', writable: true, description: 'Quiet mode priority (sound/capacity)' },
  { id: 'TOP142', name: 'Expansion_Valve', source: 'main', byte: 175, decoder: 'getIntMinus1', writable: false, unit: 'Steps', description: 'Expansion valve position' },
  { id: 'TOP143', name: 'DHW_Sensor_Selection', source: 'main', byte: 11, decoder: 'getBit7and8', writable: true, description: 'DHW tank sensor selection (top/center)' },
];

/**
 * Optional-PCB datapoints (OPT0–OPT6).
 *
 * These represent the control outputs HeishaMon writes when emulating the
 * optional PCB; they are not commands the heat pump accepts. All OPTs are
 * therefore read-only from the adapter's perspective.
 *
 * The `byte` offsets refer to the 20-byte optional-PCB frame; the decoder
 * is uniformly `getOptDataValue` since the upstream code extracts these
 * fields via bit masks inside `getOptDataValue()` rather than per-byte
 * decoders.
 */
export const OPTIONAL_DATAPOINTS: readonly DataPoint[] = [
  { id: 'OPT0', name: 'Z1_Water_Pump', source: 'optional', byte: 4, decoder: 'getOptDataValue', writable: false, description: 'Zone 1 water pump action request' },
  { id: 'OPT1', name: 'Z1_Mixing_Valve', source: 'optional', byte: 4, decoder: 'getOptDataValue', writable: false, description: 'Zone 1 mixing valve action request' },
  { id: 'OPT2', name: 'Z2_Water_Pump', source: 'optional', byte: 4, decoder: 'getOptDataValue', writable: false, description: 'Zone 2 water pump action request' },
  { id: 'OPT3', name: 'Z2_Mixing_Valve', source: 'optional', byte: 4, decoder: 'getOptDataValue', writable: false, description: 'Zone 2 mixing valve action request' },
  { id: 'OPT4', name: 'Pool_Water_Pump', source: 'optional', byte: 4, decoder: 'getOptDataValue', writable: false, description: 'Pool water pump action request' },
  { id: 'OPT5', name: 'Solar_Water_Pump', source: 'optional', byte: 4, decoder: 'getOptDataValue', writable: false, description: 'Solar water pump action request' },
  { id: 'OPT6', name: 'Alarm_State', source: 'optional', byte: 5, decoder: 'getOptDataValue', writable: false, description: 'Alarm state from optional PCB' },
];

/**
 * Extra-block datapoints (XTOP0–XTOP5) — K/L-series only.
 *
 * Each value is a little-endian 16-bit unsigned integer spanning `byte` and
 * `byte + 1` in the 203-byte extra-block response frame.
 */
export const EXTRA_DATAPOINTS: readonly DataPoint[] = [
  { id: 'XTOP0', name: 'Heat_Power_Consumption_Extra', source: 'extra', byte: 14, decoder: 'getUintt16', writable: false, unit: 'Watt', description: 'Additional heating power consumption data' },
  { id: 'XTOP1', name: 'Cool_Power_Consumption_Extra', source: 'extra', byte: 16, decoder: 'getUintt16', writable: false, unit: 'Watt', description: 'Additional cooling power consumption data' },
  { id: 'XTOP2', name: 'DHW_Power_Consumption_Extra', source: 'extra', byte: 18, decoder: 'getUintt16', writable: false, unit: 'Watt', description: 'Additional DHW power consumption data' },
  { id: 'XTOP3', name: 'Heat_Power_Production_Extra', source: 'extra', byte: 20, decoder: 'getUintt16', writable: false, unit: 'Watt', description: 'Additional heating power production data' },
  { id: 'XTOP4', name: 'Cool_Power_Production_Extra', source: 'extra', byte: 22, decoder: 'getUintt16', writable: false, unit: 'Watt', description: 'Additional cooling power production data' },
  { id: 'XTOP5', name: 'DHW_Power_Production_Extra', source: 'extra', byte: 24, decoder: 'getUintt16', writable: false, unit: 'Watt', description: 'Additional DHW power production data' },
];

/**
 * Union of all datapoint tables, in section order: main, optional, extra.
 * Use this as the default iteration source unless you specifically need a
 * single frame's datapoints.
 */
export const ALL_DATAPOINTS: readonly DataPoint[] = [
  ...MAIN_DATAPOINTS,
  ...OPTIONAL_DATAPOINTS,
  ...EXTRA_DATAPOINTS,
];

const DATAPOINTS_BY_NAME: ReadonlyMap<string, DataPoint> = new Map(
  ALL_DATAPOINTS.map((datapoint) => [datapoint.name, datapoint]),
);

/**
 * Look up a datapoint by its HeishaMon MQTT topic suffix (case-sensitive).
 *
 * @returns the matching `DataPoint`, or `undefined` if no datapoint has that name.
 */
export function findByName(name: string): DataPoint | undefined {
  return DATAPOINTS_BY_NAME.get(name);
}
