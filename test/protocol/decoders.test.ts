import { describe, expect, it } from 'vitest';

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
} from '../../src/protocol/decoders.js';

/** Build a synthetic 203-byte frame and set selected bytes. */
function makeFrame(length: number, overrides: Record<number, number> = {}): Uint8Array {
  const frame = new Uint8Array(length);
  for (const [indexStr, value] of Object.entries(overrides)) {
    frame[Number(indexStr)] = value;
  }
  return frame;
}

describe('getBit1 (top bit)', () => {
  it('returns 0 for 0x00', () => {
    expect(getBit1(Uint8Array.of(0x00), 0)).toBe(0);
  });

  it('returns 1 for 0xFF', () => {
    expect(getBit1(Uint8Array.of(0xff), 0)).toBe(1);
  });

  it('returns 1 for 0x80 (only top bit set)', () => {
    expect(getBit1(Uint8Array.of(0x80), 0)).toBe(1);
  });
});

describe('getBit1and2 (top two bits, -1)', () => {
  it('returns -1 for 0x00', () => {
    expect(getBit1and2(Uint8Array.of(0x00), 0)).toBe(-1);
  });

  it('returns 2 for 0xFF (top bits = 3, then -1)', () => {
    expect(getBit1and2(Uint8Array.of(0xff), 0)).toBe(2);
  });

  it('returns 0 for 0x40 (top bits = 01)', () => {
    expect(getBit1and2(Uint8Array.of(0x40), 0)).toBe(0);
  });
});

describe('getBit3and4', () => {
  it('extracts bits 3 and 4 minus 1', () => {
    // 0b00110000 -> (>>4 & 0b11) = 0b11 = 3 -> 2
    expect(getBit3and4(Uint8Array.of(0b0011_0000), 0)).toBe(2);
  });

  it('returns -1 when bits 3 and 4 are zero', () => {
    expect(getBit3and4(Uint8Array.of(0b1100_1111), 0)).toBe(-1);
  });
});

describe('getBit3and4and5', () => {
  it('extracts three middle bits minus 1', () => {
    // 0b00111000 -> (>>3 & 0b111) = 7 -> 6
    expect(getBit3and4and5(Uint8Array.of(0b0011_1000), 0)).toBe(6);
  });

  it('returns -1 when target bits are zero', () => {
    expect(getBit3and4and5(Uint8Array.of(0b1100_0111), 0)).toBe(-1);
  });
});

describe('getBit5and6', () => {
  it('extracts bits 5 and 6 minus 1', () => {
    // 0b00001100 -> (>>2 & 0b11) = 3 -> 2
    expect(getBit5and6(Uint8Array.of(0b0000_1100), 0)).toBe(2);
  });

  it('returns -1 when target bits are zero', () => {
    expect(getBit5and6(Uint8Array.of(0b1111_0011), 0)).toBe(-1);
  });
});

describe('getBit7and8 (bottom two bits, -1)', () => {
  it('returns -1 for 0x00', () => {
    expect(getBit7and8(Uint8Array.of(0x00), 0)).toBe(-1);
  });

  it('returns 2 for 0xFF', () => {
    expect(getBit7and8(Uint8Array.of(0xff), 0)).toBe(2);
  });

  it('returns 1 for 0x56 (lowest two bits = 10b = 2)', () => {
    expect(getBit7and8(Uint8Array.of(0x56), 0)).toBe(1);
  });
});

describe('getRight3bits', () => {
  it('returns -1 for 0x00', () => {
    expect(getRight3bits(Uint8Array.of(0x00), 0)).toBe(-1);
  });

  it('returns 6 for 0xFF (low 3 bits = 7)', () => {
    expect(getRight3bits(Uint8Array.of(0xff), 0)).toBe(6);
  });
});

describe('getIntMinus1', () => {
  it('returns -1 for 0x00', () => {
    expect(getIntMinus1(Uint8Array.of(0x00), 0)).toBe(-1);
  });

  it('returns 254 for 0xFF', () => {
    expect(getIntMinus1(Uint8Array.of(0xff), 0)).toBe(254);
  });
});

describe('getIntMinus128', () => {
  it('returns -128 for 0x00', () => {
    expect(getIntMinus128(Uint8Array.of(0x00), 0)).toBe(-128);
  });

  it('returns 127 for 0xFF', () => {
    expect(getIntMinus128(Uint8Array.of(0xff), 0)).toBe(127);
  });

  it('returns 0 for 0x80 (signed zero)', () => {
    expect(getIntMinus128(Uint8Array.of(0x80), 0)).toBe(0);
  });
});

describe('getIntMinus1Div5', () => {
  it('returns 0 for byte=1', () => {
    expect(getIntMinus1Div5(Uint8Array.of(1), 0)).toBe(0);
  });

  it('returns 50.8 for byte=255 (raw float, no rounding)', () => {
    expect(getIntMinus1Div5(Uint8Array.of(255), 0)).toBeCloseTo(50.8, 5);
  });
});

describe('getIntMinus1Div50', () => {
  it('returns 0 for byte=1', () => {
    expect(getIntMinus1Div50(Uint8Array.of(1), 0)).toBe(0);
  });

  it('returns 5.08 for byte=255', () => {
    expect(getIntMinus1Div50(Uint8Array.of(255), 0)).toBeCloseTo(5.08, 5);
  });
});

describe('getIntMinus1Times10', () => {
  it('returns -10 for 0x00', () => {
    expect(getIntMinus1Times10(Uint8Array.of(0x00), 0)).toBe(-10);
  });

  it('returns 2540 for 0xFF', () => {
    expect(getIntMinus1Times10(Uint8Array.of(0xff), 0)).toBe(2540);
  });
});

describe('getIntMinus1Times50', () => {
  it('returns -50 for 0x00', () => {
    expect(getIntMinus1Times50(Uint8Array.of(0x00), 0)).toBe(-50);
  });

  it('returns 12700 for 0xFF', () => {
    expect(getIntMinus1Times50(Uint8Array.of(0xff), 0)).toBe(12700);
  });
});

describe('getPower (Watt)', () => {
  it('returns 0 for byte=1', () => {
    expect(getPower(Uint8Array.of(1), 0)).toBe(0);
  });

  it('returns 200 for byte=2', () => {
    expect(getPower(Uint8Array.of(2), 0)).toBe(200);
  });

  it('returns -200 for byte=0', () => {
    expect(getPower(Uint8Array.of(0), 0)).toBe(-200);
  });
});

describe('getUintt16 (little-endian uint16 minus 1)', () => {
  it('decodes [0x01, 0x00] as 0', () => {
    expect(getUintt16(Uint8Array.of(0x01, 0x00), 0)).toBe(0);
  });

  it('decodes [0x00, 0x01] as 255 (256 - 1)', () => {
    expect(getUintt16(Uint8Array.of(0x00, 0x01), 0)).toBe(255);
  });

  it('decodes [0xFF, 0xFF] as 65534', () => {
    expect(getUintt16(Uint8Array.of(0xff, 0xff), 0)).toBe(65534);
  });
});

describe('getFirstByte (high nibble - 1)', () => {
  it('returns -1 for 0x0F (high nibble = 0)', () => {
    expect(getFirstByte(Uint8Array.of(0x0f), 0)).toBe(-1);
  });

  it('returns 14 for 0xFF (high nibble = 0xF)', () => {
    expect(getFirstByte(Uint8Array.of(0xff), 0)).toBe(14);
  });
});

describe('getSecondByte (low nibble - 1)', () => {
  it('returns -1 for 0xF0 (low nibble = 0)', () => {
    expect(getSecondByte(Uint8Array.of(0xf0), 0)).toBe(-1);
  });

  it('returns 14 for 0xFF (low nibble = 0xF)', () => {
    expect(getSecondByte(Uint8Array.of(0xff), 0)).toBe(14);
  });
});

describe('getValvePID', () => {
  it('returns 0 for byte=1', () => {
    expect(getValvePID(Uint8Array.of(1), 0)).toBe(0);
  });

  it('returns 127 for byte=255', () => {
    expect(getValvePID(Uint8Array.of(255), 0)).toBe(127);
  });
});

describe('getOpMode (enum mapping)', () => {
  const cases: ReadonlyArray<readonly [number, number, string]> = [
    [18, 0, 'Heat only'],
    [19, 1, 'Cool only'],
    [25, 2, 'Auto Heat'],
    [33, 3, 'DHW only'],
    [34, 4, 'Heat + DHW'],
    [35, 5, 'Cool + DHW'],
    [41, 6, 'Auto Heat + DHW'],
    [26, 7, 'Auto Cool'],
    [42, 8, 'Auto Cool + DHW'],
  ];

  for (const [byteValue, expected, label] of cases) {
    it(`maps byte ${byteValue} to ${expected} (${label})`, () => {
      expect(getOpMode(Uint8Array.of(byteValue), 0)).toBe(expected);
    });
  }

  it('returns -1 for an unknown mode byte (e.g. 0)', () => {
    expect(getOpMode(Uint8Array.of(0x00), 0)).toBe(-1);
  });

  it('masks upper bits before matching (0x62 → 34 → 4 = Heat+DHW)', () => {
    // Real frames carry zone bits in the upper two bits of byte 6, so
    // masking is required to recover the operating mode.
    expect(getOpMode(Uint8Array.of(0x62), 0)).toBe(4);
  });
});

describe('getPumpFlow', () => {
  it('returns 11.226... for byte169=0x3B, byte170=0x0B (from real frame)', () => {
    const frame = makeFrame(203, { 169: 0x3b, 170: 0x0b });
    expect(getPumpFlow(frame)).toBeCloseTo(11 + (0x3b - 1) / 256, 6);
  });

  it('returns 0 for byte169=1, byte170=0 (no flow)', () => {
    const frame = makeFrame(203, { 169: 1, 170: 0 });
    expect(getPumpFlow(frame)).toBe(0);
  });
});

describe('getOperationsHours / Counter / Heater hours', () => {
  it('reads operations hours as LE uint16 minus 1 at bytes 182/183', () => {
    const frame = makeFrame(203, { 182: 0xdd, 183: 0x02 });
    expect(getOperationsHours(frame)).toBe(((0x02 << 8) | 0xdd) - 1);
  });

  it('reads operations counter as LE uint16 minus 1 at bytes 179/180', () => {
    const frame = makeFrame(203, { 179: 0xc3, 180: 0x02 });
    expect(getOperationsCounter(frame)).toBe(((0x02 << 8) | 0xc3) - 1);
  });

  it('reads room heater hours at bytes 185/186', () => {
    const frame = makeFrame(203, { 185: 0x05, 186: 0x00 });
    expect(getRoomHeaterOperationsHours(frame)).toBe(4);
  });

  it('reads DHW heater hours at bytes 188/189', () => {
    const frame = makeFrame(203, { 188: 0x01, 189: 0x00 });
    expect(getDhwHeaterOperationsHours(frame)).toBe(0);
  });
});

describe('getErrorInfo', () => {
  it('returns "No error" when type byte is neither 0xA1 nor 0xB1', () => {
    const frame = makeFrame(203, { 113: 0x00, 114: 0x00 });
    expect(getErrorInfo(frame)).toBe('No error');
  });

  it('decodes an F-type error (0xB1)', () => {
    // number = 0x20 - 17 = 15 = 0x0F
    const frame = makeFrame(203, { 113: 0xb1, 114: 0x20 });
    expect(getErrorInfo(frame)).toBe('F0F');
  });

  it('decodes an H-type error (0xA1)', () => {
    // number = 0x30 - 17 = 31 = 0x1F
    const frame = makeFrame(203, { 113: 0xa1, 114: 0x30 });
    expect(getErrorInfo(frame)).toBe('H1F');
  });
});

describe('getHeatPumpModel', () => {
  it('formats bytes 129..138 as uppercase space-separated hex pairs', () => {
    const frame = makeFrame(203, {
      129: 0xe2,
      130: 0xce,
      131: 0x0d,
      132: 0x71,
      133: 0x81,
      134: 0x72,
      135: 0xce,
      136: 0x0c,
      137: 0x92,
      138: 0x81,
    });
    expect(getHeatPumpModel(frame)).toBe('E2 CE 0D 71 81 72 CE 0C 92 81');
  });

  it('zero-pads single-digit hex values', () => {
    const frame = makeFrame(203, {
      129: 0x01,
      130: 0x02,
      131: 0x03,
      132: 0x04,
      133: 0x05,
      134: 0x06,
      135: 0x07,
      136: 0x08,
      137: 0x09,
      138: 0x0a,
    });
    expect(getHeatPumpModel(frame)).toBe('01 02 03 04 05 06 07 08 09 0A');
  });
});

describe('optional-PCB decoders', () => {
  it('extracts Z1_Water_Pump from byte 4 bit 7', () => {
    expect(getOptZ1WaterPump(makeFrame(20, { 4: 0b1000_0000 }))).toBe(1);
    expect(getOptZ1WaterPump(makeFrame(20, { 4: 0b0111_1111 }))).toBe(0);
  });

  it('extracts Z1_Mixing_Valve from byte 4 bits 5-6', () => {
    expect(getOptZ1MixingValve(makeFrame(20, { 4: 0b0110_0000 }))).toBe(3);
    expect(getOptZ1MixingValve(makeFrame(20, { 4: 0b0010_0000 }))).toBe(1);
  });

  it('extracts Z2_Water_Pump from byte 4 bit 4', () => {
    expect(getOptZ2WaterPump(makeFrame(20, { 4: 0b0001_0000 }))).toBe(1);
    expect(getOptZ2WaterPump(makeFrame(20, { 4: 0b1110_1111 }))).toBe(0);
  });

  it('extracts Z2_Mixing_Valve from byte 4 bits 2-3', () => {
    expect(getOptZ2MixingValve(makeFrame(20, { 4: 0b0000_1100 }))).toBe(3);
    expect(getOptZ2MixingValve(makeFrame(20, { 4: 0b0000_0100 }))).toBe(1);
  });

  it('extracts Pool_Water_Pump from byte 4 bit 1', () => {
    expect(getOptPoolWaterPump(makeFrame(20, { 4: 0b0000_0010 }))).toBe(1);
    expect(getOptPoolWaterPump(makeFrame(20, { 4: 0b1111_1101 }))).toBe(0);
  });

  it('extracts Solar_Water_Pump from byte 4 bit 0', () => {
    expect(getOptSolarWaterPump(makeFrame(20, { 4: 0b0000_0001 }))).toBe(1);
    expect(getOptSolarWaterPump(makeFrame(20, { 4: 0b1111_1110 }))).toBe(0);
  });

  it('extracts Alarm_State from byte 5 bit 0', () => {
    expect(getOptAlarmState(makeFrame(20, { 5: 0b0000_0001 }))).toBe(1);
    expect(getOptAlarmState(makeFrame(20, { 5: 0b1111_1110 }))).toBe(0);
  });
});
