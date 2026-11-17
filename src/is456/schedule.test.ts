import { describe, expect, it } from 'vitest';
import { developmentLength, lapLength } from './anchorage';
import { DEFAULT_BEAM, designBeam } from './beam';
import { DEFAULT_COLUMN, designColumn } from './column';
import { DEFAULT_FOOTING, designFooting } from './footing';
import { findSteel } from './materials';
import {
  beamSchedule,
  columnSchedule,
  footingSchedule,
  linkLength,
  scheduleWeight,
  slabSchedule,
  unitWeight,
} from './schedule';
import { DEFAULT_SLAB, designSlab } from './slab';

const Fe415 = findSteel('Fe415');

describe('bar schedules', () => {
  it('uses the standard unit weights', () => {
    // d²/162: 8 mm → 0.395, 12 → 0.889, 16 → 1.58, 20 → 2.47, 25 → 3.86 kg/m.
    expect(unitWeight(8)).toBeCloseTo(0.395, 3);
    expect(unitWeight(12)).toBeCloseTo(0.889, 3);
    expect(unitWeight(16)).toBeCloseTo(1.58, 2);
    expect(unitWeight(20)).toBeCloseTo(2.469, 3);
    expect(unitWeight(25)).toBeCloseTo(3.858, 3);
    // 2(250 + 450) + 20×8 − 6×8 − 6×8 = 1464 mm.
    expect(linkLength(250, 450, 8)).toBe(1464);
  });

  it('schedules a beam', () => {
    const design = designBeam(DEFAULT_BEAM);
    const rows = beamSchedule(design);
    expect(rows.map((r) => r.mark)).toEqual(['a', 'b', 'c']);
    const main = rows[0];
    expect(main.count).toBe(design.tension.count);
    expect(main.length).toBe(
      Math.ceil((6000 + 2 * developmentLength(design.tension.diameter, 25, Fe415)) / 10) * 10,
    );
    expect(main.weight).toBeCloseTo(main.total * unitWeight(main.diameter), 9);
    expect(rows[2].count).toBe(Math.floor(6000 / design.shear.spacing) + 1);
    expect(rows[2].length).toBe(Math.ceil(linkLength(250, 450, 8) / 10) * 10);
    expect(scheduleWeight(rows)).toBeCloseTo(
      rows.reduce((s, r) => s + r.weight, 0),
      9,
    );
    const cantilever = beamSchedule(
      designBeam({ ...DEFAULT_BEAM, support: 'cantilever', span: 2 }),
    );
    expect(cantilever[0].description).toBe('Top main bars');
    const heavy = beamSchedule(
      designBeam({
        ...DEFAULT_BEAM,
        loading: { kind: 'forces', Mu: 420, Vu: 200 },
        stirrupLegs: 4,
      }),
    );
    expect(heavy[1].description).toBe('Compression bars');
    expect(heavy[2].count % 2).toBe(0);
  });

  it('schedules columns, slabs and footings', () => {
    const column = columnSchedule(designColumn(DEFAULT_COLUMN));
    expect(column[0].count).toBe(8);
    expect(column[0].length).toBe(Math.ceil((3200 + lapLength(20, 25, Fe415, true)) / 10) * 10);
    expect(column[1].count).toBe(Math.floor(3200 / 300) + 1);
    const round = columnSchedule(designColumn({ ...DEFAULT_COLUMN, shape: 'circular', D: 500 }));
    expect(round[1].length).toBe(Math.ceil((Math.PI * 420 + 160) / 10) * 10);

    const slab = designSlab(DEFAULT_SLAB);
    const rows = slabSchedule(slab);
    expect(rows).toHaveLength(4);
    // Short-span midspan bars run 4 m and are spaced along the 5 m side.
    const mid = rows[1];
    expect(mid.length).toBe(4000);
    expect(mid.count).toBe(Math.floor(5000 / slab.steel[1].spacing) + 1);
    expect(rows[0].length).toBe(1200);
    const oneWay = slabSchedule(designSlab({ ...DEFAULT_SLAB, type: 'one-way', lx: 3 }));
    expect(oneWay[oneWay.length - 1].description).toBe('Distribution bars');

    const footing = designFooting(DEFAULT_FOOTING);
    const fr = footingSchedule(footing);
    expect(fr).toHaveLength(2);
    expect(fr[0].length).toBe(footing.L - 100);
    expect(fr[0].count).toBe(footing.steel[0].count);
  });
});
