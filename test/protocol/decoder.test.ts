import { describe, expect, it } from 'vitest';

import {
  decodeExtraFrame,
  decodeMainFrame,
  decodeOptionalFrame,
  type DecodedFrame,
} from '../../src/protocol/decoder.js';
import { verifyFrame } from '../../src/protocol/crc.js';

/**
 * Real `ans` (heatpump response) frame copied verbatim from
 * `vendor/heishamon-upstream/Tools/chksumChecker.js`. This is a known-good
 * 203-byte main-frame captured from a Panasonic Aquarea heat pump.
 */
const REAL_MAIN_FRAME_HEX =
  '71c801105655624900050000000000000000000019151155165e550509000000000000000000808f808ab27171979900000000000000000000008085158a8585d07b781f7e1f1f79798d8d9e96718fb7a37b8f8e85808f8a949e8a8a949e82908b056578c10b00000000000000005556552153155a051212190000000000000000e2ce0d718172ce0c9281b000aa7cabb032329cb632323280b7afcd9aac79807780ff9101295900003b0b1c51590136790101c30200dd02000500000100000601010101010a1400000077';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe('decodeMainFrame — real captured frame', () => {
  const frame = hexToBytes(REAL_MAIN_FRAME_HEX);

  it('fixture is a checksum-valid 203-byte main frame', () => {
    expect(frame.length).toBe(203);
    expect(verifyFrame(frame)).toBe(true);
  });

  let decoded: DecodedFrame;
  it('decodes without throwing', () => {
    decoded = decodeMainFrame(frame);
    expect(decoded).toBeDefined();
  });

  it('produces 144 keys (one per main-frame datapoint)', () => {
    const out = decodeMainFrame(frame);
    expect(Object.keys(out).length).toBe(144);
  });

  it('never produces NaN or undefined values (frame is well-formed)', () => {
    const out = decodeMainFrame(frame);
    for (const [name, value] of Object.entries(out)) {
      if (typeof value === 'number') {
        expect(value, `${name} produced NaN`).not.toBeNaN();
      } else {
        expect(value, `${name} produced undefined`).toBeDefined();
      }
    }
  });

  it('Heatpump_State === 1 (byte 4 = 0x56, bottom two bits = 10b → 2 - 1)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Heatpump_State).toBe(1);
  });

  it('Operating_Mode_State === 4 (byte 6 = 0x62, masked = 34 → Heat+DHW)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Operating_Mode_State).toBe(4);
  });

  it('Outside_Temp === -4 °C (byte 142 = 0x7C = 124, minus 128)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Outside_Temp).toBe(-4);
  });

  it('Main_Inlet_Temp === 43 °C (byte 143 = 0xAB = 171, minus 128)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Main_Inlet_Temp).toBe(43);
  });

  it('Main_Outlet_Temp === 48 °C (byte 144 = 0xB0 = 176, minus 128)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Main_Outlet_Temp).toBe(48);
  });

  it('DHW_Temp === 42 °C (byte 141 = 0xAA = 170, minus 128)', () => {
    const out = decodeMainFrame(frame);
    expect(out.DHW_Temp).toBe(42);
  });

  it('Compressor_Freq === 88 Hz (byte 166 = 0x59 = 89, minus 1)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Compressor_Freq).toBe(88);
  });

  it('Pump_Flow ≈ 11.227 l/min (byte 170 + (byte 169 - 1) / 256)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Pump_Flow).toBeCloseTo(11 + (0x3b - 1) / 256, 6);
  });

  it('Operations_Hours === 732 (LE uint16 at 182/183, minus 1)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Operations_Hours).toBe(732);
  });

  it('Operations_Counter === 706 (LE uint16 at 179/180, minus 1)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Operations_Counter).toBe(706);
  });

  it('Heat_Pump_Model === "E2 CE 0D 71 81 72 CE 0C 92 81" (bytes 129..138)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Heat_Pump_Model).toBe('E2 CE 0D 71 81 72 CE 0C 92 81');
  });

  it('Error string is present and starts with a known prefix', () => {
    // Byte 113 = 0x21, byte 114 = 0x53. 0x21 is neither 0xA1 nor 0xB1, so
    // we expect the "No error" sentinel. (Documenting the path the real
    // frame takes, not a heat-pump invariant.)
    const out = decodeMainFrame(frame);
    expect(out.Error).toBe('No error');
  });

  it('Heat_Power_Consumption === 0 W (byte 193 = 1, → (1-1) * 200)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Heat_Power_Consumption).toBe(0);
  });

  it('Heat_Power_Production === 0 W (byte 194 = 1, → (1-1) * 200)', () => {
    const out = decodeMainFrame(frame);
    expect(out.Heat_Power_Production).toBe(0);
  });
});

describe('decodeMainFrame — error handling', () => {
  it('throws RangeError when frame is too short', () => {
    expect(() => decodeMainFrame(new Uint8Array(100))).toThrow(RangeError);
    expect(() => decodeMainFrame(new Uint8Array(100))).toThrow(
      /main frame must be at least 203 bytes, got 100/,
    );
  });
});

describe('decodeOptionalFrame', () => {
  it('extracts all seven optional-PCB datapoints from a synthetic frame', () => {
    const frame = new Uint8Array(20);
    // byte 4 = 0b1011_0111 → Z1_Pump=1, Z1_Mix=1, Z2_Pump=1, Z2_Mix=1, Pool=1, Solar=1
    frame[4] = 0b1011_0111;
    // byte 5 bit 0 = 1 → Alarm_State = 1
    frame[5] = 0b0000_0001;
    const out = decodeOptionalFrame(frame);

    expect(out).toEqual({
      Z1_Water_Pump: 1,
      Z1_Mixing_Valve: 1,
      Z2_Water_Pump: 1,
      Z2_Mixing_Valve: 1,
      Pool_Water_Pump: 1,
      Solar_Water_Pump: 1,
      Alarm_State: 1,
    });
  });

  it('extracts zeroes from an all-zero frame', () => {
    const out = decodeOptionalFrame(new Uint8Array(20));
    expect(out).toEqual({
      Z1_Water_Pump: 0,
      Z1_Mixing_Valve: 0,
      Z2_Water_Pump: 0,
      Z2_Mixing_Valve: 0,
      Pool_Water_Pump: 0,
      Solar_Water_Pump: 0,
      Alarm_State: 0,
    });
  });

  it('throws RangeError when frame is too short', () => {
    expect(() => decodeOptionalFrame(new Uint8Array(10))).toThrow(RangeError);
  });
});

describe('decodeExtraFrame', () => {
  it('decodes all six XTOPs as little-endian uint16 minus 1', () => {
    const frame = new Uint8Array(203);
    // XTOP0 byte 14, XTOP1 16, XTOP2 18, XTOP3 20, XTOP4 22, XTOP5 24.
    // Set each pair to encode a distinct value.
    frame[14] = 0x01; frame[15] = 0x00; // → 0
    frame[16] = 0x65; frame[17] = 0x00; // → 100
    frame[18] = 0xc9; frame[19] = 0x00; // → 200
    frame[20] = 0x01; frame[21] = 0x01; // → 256
    frame[22] = 0x00; frame[23] = 0x01; // → 255
    frame[24] = 0xff; frame[25] = 0xff; // → 65534

    const out = decodeExtraFrame(frame);
    expect(out).toEqual({
      Heat_Power_Consumption_Extra: 0,
      Cool_Power_Consumption_Extra: 100,
      DHW_Power_Consumption_Extra: 200,
      Heat_Power_Production_Extra: 256,
      Cool_Power_Production_Extra: 255,
      DHW_Power_Production_Extra: 65534,
    });
  });

  it('throws RangeError when frame is too short', () => {
    expect(() => decodeExtraFrame(new Uint8Array(50))).toThrow(RangeError);
  });
});
