import { describe, expect, it } from 'vitest';
import { barArea } from './materials';
import {
  DEFAULT_SLAB,
  TABLE_26,
  TABLE_26_RATIOS,
  designSlab,
  restrainedCoefficients,
  simplySupportedCoefficients,
  yieldLineCoefficients,
} from './slab';
import type { SlabInput } from './slab';

describe('Table 27 (simply supported, corners free to lift)', () => {
  it('reproduces the published coefficients', () => {
    // [ly/lx, αx, αy] from IS 456 Table 27.
    const rows: Array<[number, number, number]> = [
      [1.0, 0.062, 0.062],
      [1.1, 0.074, 0.061],
      [1.2, 0.084, 0.059],
      [1.3, 0.093, 0.055],
      [1.4, 0.099, 0.051],
      [1.5, 0.104, 0.046],
      [1.75, 0.113, 0.037],
      [2.0, 0.118, 0.029],
    ];
    for (const [ratio, ax, ay] of rows) {
      const c = simplySupportedCoefficients(ratio);
      expect(Math.abs(c.alphaX - ax)).toBeLessThan(0.0011);
      expect(Math.abs(c.alphaY - ay)).toBeLessThan(0.0011);
    }
  });
});

describe('Table 26 (restrained slabs)', () => {
  it('has nine cases tabulated at eight ratios', () => {
    expect(TABLE_26.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const panel of TABLE_26) {
      expect(panel.shortPositive).toHaveLength(TABLE_26_RATIOS.length);
      if (panel.shortNegative) expect(panel.shortNegative).toHaveLength(TABLE_26_RATIOS.length);
    }
  });

  it('agrees with the yield-line equations it is based on (typing-error guard)', () => {
    // IS 456 does not follow the published equations exactly: most cases agree to rounding, and
    // the cases with both long edges discontinuous run up to 12 % lower. A mistyped digit would
    // be off by far more than that.
    const close = (table: number, formula: number) =>
      expect(Math.abs(table - formula)).toBeLessThan(Math.max(0.005, 0.13 * formula));
    for (const panel of TABLE_26) {
      TABLE_26_RATIOS.forEach((ratio, i) => {
        const formula = yieldLineCoefficients(panel, ratio);
        close(panel.shortPositive[i], formula.shortPositive);
        if (panel.shortNegative) close(panel.shortNegative[i], formula.shortNegative);
        else expect(formula.shortNegative).toBe(0);
      });
      const formula = yieldLineCoefficients(panel, 1);
      close(panel.longPositive, formula.longPositive);
      if (panel.longNegative) close(panel.longNegative, formula.longNegative);
      else expect(formula.longNegative).toBe(0);
    }
  });

  it('varies smoothly with the aspect ratio (second typing-error guard)', () => {
    // The rate of increase per 0.1 of ly/lx never jumps: a wrong digit would break this.
    const smooth = (values: readonly number[]) => {
      const slopes = values
        .slice(1)
        .map((v, i) => ((v - values[i]) / (TABLE_26_RATIOS[i + 1] - TABLE_26_RATIOS[i])) * 0.1);
      for (let i = 1; i < slopes.length; i++) {
        expect(slopes[i]).toBeLessThan(slopes[i - 1] + 0.0016);
        expect(slopes[i]).toBeGreaterThan(slopes[i - 1] - 0.0031);
      }
    };
    for (const panel of TABLE_26) {
      smooth(panel.shortPositive);
      if (panel.shortNegative) smooth(panel.shortNegative);
    }
  });

  it('is internally consistent', () => {
    for (const panel of TABLE_26) {
      // Coefficients grow with the aspect ratio.
      for (let i = 1; i < panel.shortPositive.length; i++) {
        expect(panel.shortPositive[i]).toBeGreaterThan(panel.shortPositive[i - 1]);
        if (panel.shortNegative)
          expect(panel.shortNegative[i]).toBeGreaterThan(panel.shortNegative[i - 1]);
      }
      // Negative moments are about 4/3 of the positive ones.
      if (panel.shortNegative) {
        panel.shortNegative.forEach((neg, i) => {
          expect(Math.abs(neg / panel.shortPositive[i] - 4 / 3)).toBeLessThan(0.06);
        });
      }
      if (panel.longNegative)
        expect(Math.abs(panel.longNegative / panel.longPositive - 4 / 3)).toBeLessThan(0.06);
      // A negative coefficient exists exactly where an edge is continuous.
      expect(panel.shortNegative !== null).toBe(panel.longEdges.some((c) => c));
      expect(panel.longNegative !== null).toBe(panel.shortEdges.some((c) => c));
    }
    // A square panel with the same edge conditions both ways has equal coefficients.
    for (const id of [1, 4, 9]) {
      const c = restrainedCoefficients(id, 1);
      expect(c.shortPositive).toBe(c.longPositive);
      expect(c.shortNegative).toBe(c.longNegative);
    }
  });

  it('interpolates between tabulated ratios and clamps outside them', () => {
    expect(restrainedCoefficients(1, 1.25).shortPositive).toBeCloseTo(0.034, 9);
    expect(restrainedCoefficients(1, 1.625).shortNegative).toBeCloseTo(0.0565, 9);
    expect(restrainedCoefficients(9, 2.6).shortPositive).toBe(0.107);
    expect(restrainedCoefficients(9, 0.8).shortPositive).toBe(0.056);
    expect(restrainedCoefficients(9, 1.5)).toMatchObject({ shortNegative: 0, longNegative: 0 });
    expect(restrainedCoefficients(42, 1).shortPositive).toBe(0.024);
  });
});

describe('slab design', () => {
  const withInput = (patch: Partial<SlabInput>) => designSlab({ ...DEFAULT_SLAB, ...patch });

  it('designs the default two-way panel', () => {
    const r = designSlab(DEFAULT_SLAB);
    // wu = 1.5 × (25×0.15 + 1.5 + 3) = 12.375 kN/m²; case 4 at ly/lx = 1.25.
    expect(r.wu).toBeCloseTo(12.375, 9);
    expect(r.ratio).toBeCloseTo(1.25, 9);
    const w = 12.375 * 16;
    expect(r.steel.map((s) => s.location)).toEqual([
      'Short span, continuous edge',
      'Short span, midspan',
      'Long span, continuous edge',
      'Long span, midspan',
    ]);
    expect(r.steel[0].Mu).toBeCloseTo(0.0625 * w, 6);
    expect(r.steel[1].Mu).toBeCloseTo(0.047 * w, 6);
    expect(r.steel[2].Mu).toBeCloseTo(0.047 * w, 6);
    expect(r.steel[3].Mu).toBeCloseTo(0.035 * w, 6);
    // Short-span bars are in the outer layer.
    expect(r.steel[1].d).toBe(150 - 20 - 5);
    expect(r.steel[3].d).toBe(150 - 20 - 5 - 10);
    for (const s of r.steel) {
      expect(s.provided).toBeGreaterThanOrEqual(s.required - 1e-9);
      expect(s.spacing % 5).toBe(0);
      expect(s.spacing).toBeLessThanOrEqual(300);
    }
    expect(r.distribution).toBeNull();
    expect(r.status).toBe('ok');
    expect(r.sections[2].steps.some((s) => s.ref === 'Annex D-1.8')).toBe(true);
  });

  it('designs simply supported two-way slabs from Table 27', () => {
    const r = withInput({ panel: 0, lx: 4, ly: 4 });
    expect(r.steel).toHaveLength(2);
    expect(r.steel[0].Mu).toBeCloseTo(0.0625 * r.wu * 16, 6);
    expect(r.steel[1].Mu).toBeCloseTo(r.steel[0].Mu, 9);
    const interior = withInput({ panel: 1 });
    expect(interior.sections[2].steps.some((s) => s.ref === 'Annex D-1.8')).toBe(false);
  });

  it('designs one-way slabs for each support condition', () => {
    const simple = withInput({ type: 'one-way', lx: 3.5 });
    expect(simple.steel).toHaveLength(1);
    expect(simple.steel[0].Mu).toBeCloseTo((simple.wu * 3.5 * 3.5) / 8, 9);
    expect(simple.shear.Vu).toBeCloseTo((simple.wu * 3.5) / 2, 9);
    // Distribution steel: 0.12 % of 1000 × 150 = 180 mm²/m → 8 mm bars at 275 mm.
    expect(simple.distribution?.required).toBeCloseTo(180, 9);
    expect(simple.distribution?.spacing).toBe(Math.floor((1000 * barArea(8)) / 180 / 5) * 5);

    const cantilever = withInput({ type: 'one-way', lx: 1.2, support: 'cantilever' });
    expect(cantilever.steel[0]).toMatchObject({ face: 'top', location: 'Support' });
    expect(cantilever.steel[0].Mu).toBeCloseTo((cantilever.wu * 1.44) / 2, 9);
    expect(cantilever.shear.Vu).toBeCloseTo(cantilever.wu * 1.2, 9);

    const continuous = withInput({ type: 'one-way', lx: 3.5, support: 'continuous' });
    const wd = 1.5 * (3.75 + 1.5);
    const wl = 1.5 * 3;
    expect(continuous.steel[0].Mu).toBeCloseTo((wd * 12.25) / 12 + (wl * 12.25) / 10, 9);
    expect(continuous.steel[1].Mu).toBeCloseTo((wd * 12.25) / 10 + (wl * 12.25) / 9, 9);
    expect(continuous.shear.Vu).toBeCloseTo(0.6 * continuous.wu * 3.5, 9);
  });

  it('uses 0.15 % minimum steel for mild steel', () => {
    const r = withInput({ type: 'one-way', lx: 2, steel: 'Fe250' });
    expect(r.distribution?.required).toBeCloseTo(225, 9);
  });

  it('flags slabs that are too thin, too long or badly detailed', () => {
    const thin = withInput({ type: 'one-way', lx: 6, D: 120 });
    expect(thin.checks.find((c) => c.name === 'Deflection')?.status).toBe('fail');
    const long = withInput({ lx: 3, ly: 7 });
    expect(long.checks.find((c) => c.name === 'Aspect ratio')?.status).toBe('warn');
    const fat = withInput({ mainDiameter: 20, D: 120 });
    expect(fat.checks.find((c) => c.name === 'Detailing')?.status).toBe('fail');
    const overloaded = withInput({ type: 'one-way', lx: 7, D: 100, live: 40 });
    expect(overloaded.checks.find((c) => c.name === 'Flexure')?.status).toBe('fail');
    expect(overloaded.status).toBe('fail');
    const sheared = withInput({ type: 'one-way', lx: 2, D: 100, live: 150, mainDiameter: 12 });
    expect(sheared.checks.find((c) => c.name === 'Shear')?.status).toBe('fail');
  });
});
