import { describe, expect, it } from 'vitest';

import { verifyFrame } from '../../src/protocol/crc.js';
import { encodeSetCommand } from '../../src/protocol/encoder.js';
import { FRAME_LENGTHS, identifyFrame } from '../../src/protocol/frames.js';

import checksumVectors from './fixtures/checksum-vectors.json' with { type: 'json' };

interface ChecksumVector {
  readonly description: string;
  readonly frameHex: string;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`hex string has odd length: ${hex.length}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function fixture(description: string): Uint8Array {
  const entry = (checksumVectors as readonly ChecksumVector[]).find(
    (vector) => vector.description === description,
  );
  if (!entry) {
    throw new Error(`fixture "${description}" not found`);
  }
  return hexToBytes(entry.frameHex);
}

// Goldvector cases reproducible by a single set command, i.e. fixtures whose
// payload is otherwise all zero. The multi-byte fixtures (powerfull*,
// hollidaymodeON, HeatpumpPowerON, "heat off"/"heat on", Tankmodeonly, ...)
// are NOT pure outputs of HeishaMon's `set_*` helpers — they are field
// captures of full device state, so we exclude them and document the gap.
const SINGLE_BYTE_GOLDVECTORS: ReadonlyArray<{
  description: string;
  topic: string;
  value: number;
}> = [
  { description: 'Quietmode1', topic: 'Quiet_Mode_Level', value: 1 },
  { description: 'Quietmode2', topic: 'Quiet_Mode_Level', value: 2 },
  { description: 'Quietmode3', topic: 'Quiet_Mode_Level', value: 3 },
  { description: 'Quietoff', topic: 'Quiet_Mode_Level', value: 0 },
  { description: 'set+5C', topic: 'Z1_Heat_Request_Temp', value: 5 },
  { description: 'set+4C', topic: 'Z1_Heat_Request_Temp', value: 4 },
  { description: 'set+3C', topic: 'Z1_Heat_Request_Temp', value: 3 },
  { description: 'set+2C', topic: 'Z1_Heat_Request_Temp', value: 2 },
  { description: 'set+1C', topic: 'Z1_Heat_Request_Temp', value: 1 },
  { description: 'Set0C', topic: 'Z1_Heat_Request_Temp', value: 0 },
  { description: 'set-1C', topic: 'Z1_Heat_Request_Temp', value: -1 },
  { description: 'Set-2C', topic: 'Z1_Heat_Request_Temp', value: -2 },
  { description: 'set-3C', topic: 'Z1_Heat_Request_Temp', value: -3 },
  { description: 'set-4C', topic: 'Z1_Heat_Request_Temp', value: -4 },
  { description: 'Set-5C', topic: 'Z1_Heat_Request_Temp', value: -5 },
  { description: 'settankto48C', topic: 'DHW_Target_Temp', value: 48 },
  { description: 'settankto47C', topic: 'DHW_Target_Temp', value: 47 },
  { description: 'settankto49C', topic: 'DHW_Target_Temp', value: 49 },
  { description: 'settankto40C', topic: 'DHW_Target_Temp', value: 40 },
  // Despite the description, the actual byte 42 value in this fixture is
  // 0xCA = 202 = 74 + 128, not 75 + 128. We treat the fixture as ground
  // truth and pass value 74 to the encoder.
  { description: 'settanktomax75C', topic: 'DHW_Target_Temp', value: 74 },
  { description: 'setcoolto19C', topic: 'Z1_Cool_Request_Temp', value: 19 },
  { description: 'setcoolto18C', topic: 'Z1_Cool_Request_Temp', value: 18 },
  { description: 'setcoolto6C', topic: 'Z1_Cool_Request_Temp', value: 6 },
];

describe('encodeSetCommand — goldvector parity (single-byte fixtures)', () => {
  it.each(SINGLE_BYTE_GOLDVECTORS)(
    'reproduces fixture "$description" via $topic = $value',
    ({ description, topic, value }) => {
      const expected = fixture(description);
      const actual = encodeSetCommand(topic, value);
      expect(Array.from(actual)).toEqual(Array.from(expected));
    },
  );
});

describe('encodeSetCommand — structural invariants', () => {
  const exampleCalls: ReadonlyArray<readonly [string, number]> = [
    ['Heatpump_State', 1],
    ['Heatpump_State', 0],
    ['Force_DHW_State', 1],
    ['Force_DHW_State', 0],
    ['Quiet_Mode_Level', 0],
    ['Quiet_Mode_Level', 3],
    ['Powerful_Mode_Time', 0],
    ['Powerful_Mode_Time', 3],
    ['Holiday_Mode_State', 0],
    ['Holiday_Mode_State', 1],
    ['Main_Schedule_State', 0],
    ['Main_Schedule_State', 1],
    ['Operating_Mode_State', 0],
    ['Operating_Mode_State', 8],
    ['Zones_State', 0],
    ['Zones_State', 2],
    ['DHW_Target_Temp', 48],
    ['Z1_Heat_Request_Temp', -5],
    ['Max_Pump_Duty', 100],
    ['Heater_Delay_Time', 30],
    ['DHW_Heater_State', 0],
    ['DHW_Heater_State', 1],
    ['Room_Heater_State', 0],
    ['Room_Heater_State', 1],
    ['Bivalent_Mode', 2],
    ['External_Pad_Heater', 2],
    ['Smart_DHW', 1],
    ['Heating_Control', 1],
    ['Quiet_Mode_Priority', 1],
    ['Pump_Flowrate_Mode', 1],
    ['Buffer_Tank_Delta', 5],
  ];

  it.each(exampleCalls)(
    'produces a 111-byte frame identified as mainSet that passes verifyFrame: %s = %i',
    (topic, value) => {
      const frame = encodeSetCommand(topic, value);
      expect(frame.length).toBe(FRAME_LENGTHS.mainSet);
      expect(identifyFrame(frame)).toBe('mainSet');
      expect(verifyFrame(frame)).toBe(true);
      expect(Array.from(frame.slice(0, 4))).toEqual([0xf1, 0x6c, 0x01, 0x10]);
    },
  );
});

describe('encodeSetCommand — Group B mappings', () => {
  it('maps Heatpump_State 0 -> byte 4 = 1, 1 -> byte 4 = 2', () => {
    expect(encodeSetCommand('Heatpump_State', 0)[4]).toBe(1);
    expect(encodeSetCommand('Heatpump_State', 1)[4]).toBe(2);
  });

  it('maps Force_DHW_State 0 -> 0x40, 1 -> 0x80 at byte 4', () => {
    expect(encodeSetCommand('Force_DHW_State', 0)[4]).toBe(0x40);
    expect(encodeSetCommand('Force_DHW_State', 1)[4]).toBe(0x80);
  });

  it('maps Holiday_Mode_State 0 -> 16, 1 -> 32 at byte 5', () => {
    expect(encodeSetCommand('Holiday_Mode_State', 0)[5]).toBe(16);
    expect(encodeSetCommand('Holiday_Mode_State', 1)[5]).toBe(32);
  });

  it('maps Powerful_Mode_Time 0..3 -> byte 7 = 1..4', () => {
    expect(encodeSetCommand('Powerful_Mode_Time', 0)[7]).toBe(1);
    expect(encodeSetCommand('Powerful_Mode_Time', 1)[7]).toBe(2);
    expect(encodeSetCommand('Powerful_Mode_Time', 2)[7]).toBe(3);
    expect(encodeSetCommand('Powerful_Mode_Time', 3)[7]).toBe(4);
  });

  it('maps Main_Schedule_State 0 -> 0x40, 1 -> 0x80 at byte 5', () => {
    expect(encodeSetCommand('Main_Schedule_State', 0)[5]).toBe(0x40);
    expect(encodeSetCommand('Main_Schedule_State', 1)[5]).toBe(0x80);
  });

  it('maps Operating_Mode_State enums to the inverse of getOpMode', () => {
    const expected: ReadonlyArray<readonly [number, number]> = [
      [0, 18],
      [1, 19],
      [2, 25],
      [3, 33],
      [4, 34],
      [5, 35],
      [6, 41],
      [7, 26],
      [8, 42],
    ];
    for (const [value, byte6] of expected) {
      expect(encodeSetCommand('Operating_Mode_State', value)[6]).toBe(byte6);
    }
  });

  it('maps Zones_State 0..2 -> byte 6 = 64, 128, 192', () => {
    expect(encodeSetCommand('Zones_State', 0)[6]).toBe(64);
    expect(encodeSetCommand('Zones_State', 1)[6]).toBe(128);
    expect(encodeSetCommand('Zones_State', 2)[6]).toBe(192);
  });

  it('maps DHW_Heater_State 0 -> 4, 1 -> 8 and Room_Heater_State 0 -> 1, 1 -> 2 at byte 9', () => {
    expect(encodeSetCommand('DHW_Heater_State', 0)[9]).toBe(4);
    expect(encodeSetCommand('DHW_Heater_State', 1)[9]).toBe(8);
    expect(encodeSetCommand('Room_Heater_State', 0)[9]).toBe(1);
    expect(encodeSetCommand('Room_Heater_State', 1)[9]).toBe(2);
  });
});

describe('encodeSetCommand — temperature offset rules', () => {
  it.each([
    ['DHW_Target_Temp', 42, 74, 74 + 128],
    ['DHW_Heat_Delta', 99, 5, 5 + 128],
    ['Heat_Delta', 84, -2, -2 + 128],
    ['Cool_Delta', 94, 0, 128],
    ['Heating_Off_Outdoor_Temp', 83, 15, 15 + 128],
    ['Heater_On_Outdoor_Temp', 85, -5, -5 + 128],
    ['Z2_Heat_Request_Temp', 40, 3, 3 + 128],
    ['Bivalent_Start_Temp', 65, -10, -10 + 128],
    ['Buffer_Tank_Delta', 59, 4, 4 + 128],
  ] as const)('writes (%s, %i) -> byte %i = %i', (topic, byte, value, expectedByte) => {
    const frame = encodeSetCommand(topic, value);
    expect(frame[byte]).toBe(expectedByte);
  });

  it('covers all the heat-curve and cool-curve bytes', () => {
    const cases: ReadonlyArray<readonly [string, number]> = [
      ['Z1_Heat_Curve_Target_High_Temp', 75],
      ['Z1_Heat_Curve_Target_Low_Temp', 76],
      ['Z1_Heat_Curve_Outside_Low_Temp', 77],
      ['Z1_Heat_Curve_Outside_High_Temp', 78],
      ['Z2_Heat_Curve_Target_High_Temp', 79],
      ['Z2_Heat_Curve_Target_Low_Temp', 80],
      ['Z2_Heat_Curve_Outside_Low_Temp', 81],
      ['Z2_Heat_Curve_Outside_High_Temp', 82],
      ['Z1_Cool_Curve_Target_High_Temp', 86],
      ['Z1_Cool_Curve_Target_Low_Temp', 87],
      ['Z1_Cool_Curve_Outside_Low_Temp', 88],
      ['Z1_Cool_Curve_Outside_High_Temp', 89],
      ['Z2_Cool_Curve_Target_High_Temp', 90],
      ['Z2_Cool_Curve_Target_Low_Temp', 91],
      ['Z2_Cool_Curve_Outside_Low_Temp', 92],
      ['Z2_Cool_Curve_Outside_High_Temp', 93],
    ];
    for (const [topic, byte] of cases) {
      const frame = encodeSetCommand(topic, 7);
      expect(frame[byte]).toBe(7 + 128);
    }
  });
});

describe('encodeSetCommand — linear rules', () => {
  it('Max_Pump_Duty: byte 45 = value + 1', () => {
    expect(encodeSetCommand('Max_Pump_Duty', 0)[45]).toBe(1);
    expect(encodeSetCommand('Max_Pump_Duty', 100)[45]).toBe(101);
  });

  it('Heater_Delay_Time: byte 104 = value + 1', () => {
    expect(encodeSetCommand('Heater_Delay_Time', 30)[104]).toBe(31);
  });
});

describe('encodeSetCommand — error paths', () => {
  it('throws RangeError for unknown topics', () => {
    expect(() => encodeSetCommand('Not_A_Real_Topic', 0)).toThrow(RangeError);
    expect(() => encodeSetCommand('Not_A_Real_Topic', 0)).toThrow(/unknown datapoint/);
  });

  it('throws RangeError for read-only topics', () => {
    expect(() => encodeSetCommand('Outside_Temp', 10)).toThrow(RangeError);
    expect(() => encodeSetCommand('Outside_Temp', 10)).toThrow(/not writable/);
    expect(() => encodeSetCommand('Compressor_Freq', 0)).toThrow(/not writable/);
  });

  it('throws for notImplemented topics with a clear message', () => {
    expect(() => encodeSetCommand('Sterilization_State', 0)).toThrow(
      /not implemented yet/,
    );
  });

  it('throws on out-of-range enum values', () => {
    expect(() => encodeSetCommand('Quiet_Mode_Level', 99)).toThrow(/out of range/);
    expect(() => encodeSetCommand('Quiet_Mode_Level', -1)).toThrow(/out of range/);
    expect(() => encodeSetCommand('Operating_Mode_State', 99)).toThrow(/out of range/);
    expect(() => encodeSetCommand('Powerful_Mode_Time', 4)).toThrow(/out of range/);
  });

  it('throws on out-of-range temperature values', () => {
    expect(() => encodeSetCommand('DHW_Target_Temp', 200)).toThrow(/out of range/);
    expect(() => encodeSetCommand('Z1_Heat_Request_Temp', -200)).toThrow(/out of range/);
  });

  it('throws on out-of-range linear values', () => {
    expect(() => encodeSetCommand('Max_Pump_Duty', -1)).toThrow(/out of range/);
    expect(() => encodeSetCommand('Heater_Delay_Time', 1000)).toThrow(/out of range/);
  });

  it('throws on non-finite or non-integer values', () => {
    expect(() => encodeSetCommand('DHW_Target_Temp', Number.NaN)).toThrow(/finite integer/);
    expect(() => encodeSetCommand('DHW_Target_Temp', 1.5)).toThrow(/finite integer/);
    expect(() => encodeSetCommand('DHW_Target_Temp', Number.POSITIVE_INFINITY)).toThrow(
      /finite integer/,
    );
  });
});
