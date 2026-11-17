import { describe, expect, it } from 'vitest';
import { DEFAULT_FOOTING, designFooting } from './footing';
import type { FootingInput } from './footing';
import { barArea } from './materials';
import { shearStrengthConcrete } from './shear';

const withInput = (patch: Partial<FootingInput>) => designFooting({ ...DEFAULT_FOOTING, ...patch });

describe('isolated footing', () => {
  it('sizes and designs the default square footing', () => {
    const r = designFooting(DEFAULT_FOOTING);
    // A = 1.1 × 900 / 200 = 4.95 m² → side 2225 → 2250 mm.
    expect(r.L).toBe(2250);
    expect(r.B).toBe(2250);
    expect(r.pressure).toBeCloseTo(990 / 5.0625, 9);
    expect(r.Pu).toBe(1350);
    expect(r.qu).toBeCloseTo(1350 / 5.0625, 9);
    expect(r.d).toBe(r.D - 50 - 12);
    // Moment at the column face: qu × B × a² / 2 with a = (2250 − 400)/2 = 925 mm.
    expect(r.steel[0].Mu).toBeCloseTo((r.qu * 2.25 * 0.925 ** 2) / 2, 9);
    expect(r.steel[1].Mu).toBeCloseTo(r.steel[0].Mu, 9);
    expect(r.steel[0].provided).toBeGreaterThanOrEqual(r.steel[0].required - 1e-9);
    expect(r.steel[0].provided).toBeCloseTo(r.steel[0].count * barArea(12), 9);
    expect(r.status).toBe('ok');
    expect(r.sections.map((s) => s.title)).toEqual([
      'Size of footing',
      'Depth and shear',
      'Flexure',
      'Anchorage and bearing',
    ]);
  });

  it('picks the smallest depth that passes both shear checks', () => {
    const r = designFooting(DEFAULT_FOOTING);
    expect(r.oneWay.tauV).toBeLessThanOrEqual(r.oneWay.tauC);
    expect(r.punching.tauV).toBeLessThanOrEqual(r.punching.allowable);
    // 25 mm shallower must fail one of them (unless already at the 300 mm minimum).
    if (r.D > 300) {
      const shallower = withInput({ D: r.D - 25 });
      expect(shallower.status).toBe('fail');
    }
    // Hand check of the punching values at the chosen depth.
    const d = r.d;
    const perimeter = 4 * (400 + d);
    const Vu = r.qu * (5.0625 - ((400 + d) / 1000) ** 2);
    expect(r.punching.perimeter).toBeCloseTo(perimeter, 9);
    expect(r.punching.Vu).toBeCloseTo(Vu, 9);
    expect(r.punching.tauV).toBeCloseTo((Vu * 1000) / (perimeter * d), 9);
    expect(r.punching.allowable).toBeCloseTo(0.25 * 5, 9);
    // And of the one-way shear.
    const V1 = (r.qu * 2.25 * (925 - d)) / 1000;
    expect(r.oneWay.Vu).toBeCloseTo(V1, 9);
    expect(r.oneWay.tauC).toBeCloseTo(
      shearStrengthConcrete(25, (100 * r.steel[0].provided) / (2250 * d)),
      9,
    );
  });

  it('gives a rectangular footing equal projections', () => {
    const r = withInput({ shape: 'rectangular', cx: 600, cy: 300, P: 1200 });
    expect(r.L - 600).toBe(r.B - 300);
    expect((r.L * r.B) / 1e6).toBeGreaterThanOrEqual((1.1 * 1200) / 200);
    // ks = 0.5 + 300/600 = 1.0 here; a 4:1 column reduces it.
    expect(r.punching.allowable).toBeCloseTo(1.25, 9);
    const slender = withInput({ shape: 'rectangular', cx: 800, cy: 200 });
    expect(slender.punching.allowable).toBeCloseTo(0.75 * 1.25, 9);
    expect(r.sections[2].steps.some((s) => s.ref === 'Cl. 34.3.1 (c)')).toBe(true);
    expect(r.steel[0].Mu).toBeCloseTo((r.qu * (r.B / 1000) * ((r.L - 600) / 2000) ** 2) / 2, 9);
  });

  it('reports a depth that is too small', () => {
    const r = withInput({ D: 250 });
    expect(r.D).toBe(250);
    expect(r.checks.find((c) => c.name === 'Punching shear')?.status).toBe('fail');
    expect(r.status).toBe('fail');
  });

  it('flags short anchorage and high column bearing', () => {
    const stubby = withInput({ P: 150, barDiameter: 20, cx: 500, cy: 500 });
    expect(stubby.checks.find((c) => c.name === 'Anchorage')?.status).toBe('fail');
    const heavy = withInput({ P: 3500, cx: 300, cy: 300, bearing: 400, concrete: 'M20' });
    expect(heavy.checks.find((c) => c.name === 'Column bearing')?.status).toBe('warn');
    const mild = withInput({ steel: 'Fe250' });
    expect(mild.steel[0].required).toBeGreaterThanOrEqual(0.0015 * 2250 * mild.D - 1e-9);
  });
});
