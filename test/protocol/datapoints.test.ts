import { describe, expect, it } from 'vitest';

import {
  ALL_DATAPOINTS,
  EXTRA_DATAPOINTS,
  MAIN_DATAPOINTS,
  OPTIONAL_DATAPOINTS,
  findByName,
} from '../../src/protocol/datapoints.js';
import type { DataPoint } from '../../src/protocol/datapoints.js';

const MAIN_FRAME_LENGTH = 203;
const OPTIONAL_FRAME_LENGTH = 20;
const EXTRA_FRAME_LENGTH = 203;

describe('datapoint table sizes', () => {
  it('contains 144 main datapoints', () => {
    expect(MAIN_DATAPOINTS.length).toBe(144);
  });

  it('contains 7 optional-PCB datapoints', () => {
    expect(OPTIONAL_DATAPOINTS.length).toBe(7);
  });

  it('contains 6 extra-block datapoints', () => {
    expect(EXTRA_DATAPOINTS.length).toBe(6);
  });

  it('exposes 157 datapoints in total', () => {
    expect(ALL_DATAPOINTS.length).toBe(157);
  });
});

describe('datapoint identifiers', () => {
  it('has unique ids across all tables', () => {
    const ids = ALL_DATAPOINTS.map((datapoint) => datapoint.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique names across all tables', () => {
    const names = ALL_DATAPOINTS.map((datapoint) => datapoint.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('numbers main datapoints TOP0..TOP143 in order', () => {
    for (let index = 0; index < MAIN_DATAPOINTS.length; index++) {
      const datapoint = MAIN_DATAPOINTS[index];
      expect(datapoint?.id).toBe(`TOP${index}`);
    }
  });

  it('numbers optional datapoints OPT0..OPT6 in order', () => {
    for (let index = 0; index < OPTIONAL_DATAPOINTS.length; index++) {
      const datapoint = OPTIONAL_DATAPOINTS[index];
      expect(datapoint?.id).toBe(`OPT${index}`);
    }
  });

  it('numbers extra datapoints XTOP0..XTOP5 in order', () => {
    for (let index = 0; index < EXTRA_DATAPOINTS.length; index++) {
      const datapoint = EXTRA_DATAPOINTS[index];
      expect(datapoint?.id).toBe(`XTOP${index}`);
    }
  });
});

describe('frame source consistency', () => {
  it('marks every TOP as source=main', () => {
    for (const datapoint of MAIN_DATAPOINTS) {
      expect(datapoint.source).toBe('main');
    }
  });

  it('marks every OPT as source=optional', () => {
    for (const datapoint of OPTIONAL_DATAPOINTS) {
      expect(datapoint.source).toBe('optional');
    }
  });

  it('marks every XTOP as source=extra', () => {
    for (const datapoint of EXTRA_DATAPOINTS) {
      expect(datapoint.source).toBe('extra');
    }
  });
});

describe('byte offsets', () => {
  it('keeps main datapoints within the 203-byte response frame (excluding checksum)', () => {
    for (const datapoint of MAIN_DATAPOINTS) {
      expect(datapoint.byte).toBeGreaterThanOrEqual(0);
      expect(datapoint.byte).toBeLessThan(MAIN_FRAME_LENGTH);
    }
  });

  it('keeps optional datapoints within the 20-byte PCB frame (excluding checksum)', () => {
    for (const datapoint of OPTIONAL_DATAPOINTS) {
      expect(datapoint.byte).toBeGreaterThanOrEqual(0);
      expect(datapoint.byte).toBeLessThan(OPTIONAL_FRAME_LENGTH - 1);
    }
  });

  it('keeps extra datapoints (16-bit pairs) within the 203-byte extra-block frame', () => {
    for (const datapoint of EXTRA_DATAPOINTS) {
      expect(datapoint.byte).toBeGreaterThanOrEqual(0);
      // XTOPs are 16-bit values spanning byte and byte + 1.
      expect(datapoint.byte + 1).toBeLessThan(EXTRA_FRAME_LENGTH);
    }
  });
});

describe('writable datapoints', () => {
  it('marks exactly 59 datapoints as writable (matches datapoints.md)', () => {
    const writable = ALL_DATAPOINTS.filter((datapoint) => datapoint.writable);
    expect(writable.length).toBe(59);
  });

  it('marks no OPT or XTOP datapoints as writable', () => {
    for (const datapoint of OPTIONAL_DATAPOINTS) {
      expect(datapoint.writable).toBe(false);
    }
    for (const datapoint of EXTRA_DATAPOINTS) {
      expect(datapoint.writable).toBe(false);
    }
  });
});

describe('findByName', () => {
  it('returns the matching datapoint for a known main-frame topic', () => {
    const datapoint = findByName('Heatpump_State');
    expect(datapoint).toBeDefined();
    expect(datapoint?.id).toBe('TOP0');
    expect(datapoint?.source).toBe('main');
    expect(datapoint?.writable).toBe(true);
  });

  it('returns the matching datapoint for a known optional-PCB topic', () => {
    const datapoint = findByName('Z1_Water_Pump');
    expect(datapoint).toBeDefined();
    expect(datapoint?.id).toBe('OPT0');
    expect(datapoint?.source).toBe('optional');
  });

  it('returns the matching datapoint for a known extra-block topic', () => {
    const datapoint = findByName('DHW_Power_Consumption_Extra');
    expect(datapoint).toBeDefined();
    expect(datapoint?.id).toBe('XTOP2');
    expect(datapoint?.source).toBe('extra');
    expect(datapoint?.byte).toBe(18);
  });

  it('returns undefined for an unknown name', () => {
    expect(findByName('Not_A_Real_Topic')).toBeUndefined();
  });

  it('is case-sensitive (heatpump topic suffixes are case-sensitive)', () => {
    expect(findByName('heatpump_state')).toBeUndefined();
  });
});

describe('object shape', () => {
  it('omits unit and description rather than setting them to undefined', () => {
    // exactOptionalPropertyTypes is enabled — verify the chosen optional-field
    // convention is "property absent" rather than "property present with
    // undefined value". This matters for consumers that use `'unit' in dp`.
    for (const datapoint of ALL_DATAPOINTS as readonly DataPoint[]) {
      if (!Object.prototype.hasOwnProperty.call(datapoint, 'unit')) {
        expect(datapoint.unit).toBeUndefined();
      } else {
        expect(typeof datapoint.unit).toBe('string');
      }
      if (!Object.prototype.hasOwnProperty.call(datapoint, 'description')) {
        expect(datapoint.description).toBeUndefined();
      } else {
        expect(typeof datapoint.description).toBe('string');
      }
    }
  });
});
