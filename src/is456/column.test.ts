import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLUMN,
  balancedLoad,
  bendingSection,
  biaxialExponent,
  blockCoefficients,
  columnBars,
  designColumn,
  extremeStrain,
  interactionCurve,
  momentCapacity,
  sectionForces,
  shortColumnCapacity,
  squashLoad,
} from './column';
import type { BendingSection, ColumnInput } from './column';
import { capacityRectangular } from './flexure';
import { barArea, findSteel, steelStress } from './materials';
import { gauss3 } from './quadrature';

const Fe415 = findSteel('Fe415');
const plain = (
  b: number,
  h: number,
  fck: number,
  bars: Array<[number, number]> = [],
): BendingSection => ({
  h,
  width: () => b,
  bars,
  fck,
  steel: Fe415,
  area: b * h,
});

describe('quadrature', () => {
  it('integrates a quintic exactly', () => {
    expect(gauss3((x) => 6 * x ** 5 - x, 0, 2)).toBeCloseTo(64 - 2, 10);
  });
});

describe('strain profile', () => {
  it('pivots about 0.002 at 3h/7 once the neutral axis leaves the section', () => {
    expect(extremeStrain(200, 400)).toBe(0.0035);
    expect(extremeStrain(400, 400)).toBe(0.0035);
    expect(extremeStrain(1e9, 400)).toBeCloseTo(0.002, 9);
    const xu = 800;
    const top = extremeStrain(xu, 400);
    expect((top * (xu - (3 * 400) / 7)) / xu).toBeCloseTo(0.002, 12);
    // Strain at the least compressed face: 0.0035 − 0.75 × that strain is the top strain.
    const bottom = (top * (xu - 400)) / xu;
    expect(0.0035 - 0.75 * bottom).toBeCloseTo(top, 12);
  });
});

describe('concrete stress block', () => {
  it('matches the closed-form resultant and centroid for a rectangle', () => {
    const { area, centroid } = blockCoefficients();
    // The code rounds these to 0.36 and 0.42.
    expect(area).toBeCloseTo(0.3616, 4);
    expect(centroid).toBeCloseTo(0.416, 3);
    const section = plain(300, 500, 25);
    const xu = 220;
    const r = sectionForces(section, xu);
    const force = area * 25 * 300 * xu;
    expect(r.P).toBeCloseTo(force / 1e3, 6);
    expect(r.M).toBeCloseTo((force * (250 - centroid * xu)) / 1e6, 6);
  });

  it('gives uniform stress in pure compression', () => {
    const As = 4 * barArea(20);
    const section = plain(300, 400, 30, [
      [50, As / 2],
      [350, As / 2],
    ]);
    const expected = ((0.67 * 30) / 1.5) * (300 * 400 - As) + steelStress(0.002, Fe415) * As;
    expect(squashLoad(section)).toBeCloseTo(expected / 1e3, 3);
    expect(Math.abs(sectionForces(section, 1e9).M)).toBeLessThan(1e-4);
  });

  it('agrees with the beam routine in pure bending', () => {
    const Ast = 3 * barArea(20);
    const section = plain(300, 500, 25, [[450, Ast]]);
    const column = momentCapacity(section, 0);
    const beam = capacityRectangular({ b: 300, d: 450, dc: 40, fck: 25, steel: Fe415 }, Ast);
    // The beam routine uses the rounded 0.36 / 0.42; the column integrates the block exactly.
    expect(Math.abs(column.M - beam.Mu) / beam.Mu).toBeLessThan(0.004);
    expect(Math.abs(column.xu - beam.xu) / beam.xu).toBeLessThan(0.006);
  });
});

describe('bar layouts', () => {
  it('places rectangular and circular arrangements symmetrically', () => {
    const rect = columnBars(DEFAULT_COLUMN);
    expect(rect).toHaveLength(2 * 3 + 2 * 1);
    const edge = 40 + 8 + 10;
    expect(Math.max(...rect.map((bar) => bar.y))).toBeCloseTo(225 - edge, 9);
    expect(Math.max(...rect.map((bar) => bar.x))).toBeCloseTo(150 - edge, 9);
    expect(rect.reduce((s, bar) => s + bar.x, 0)).toBeCloseTo(0, 9);
    expect(rect.reduce((s, bar) => s + bar.y, 0)).toBeCloseTo(0, 9);
    const ring = columnBars({ ...DEFAULT_COLUMN, shape: 'circular', D: 500, barsRing: 8 });
    expect(ring).toHaveLength(8);
    for (const bar of ring) expect(Math.hypot(bar.x, bar.y)).toBeCloseTo(250 - edge, 9);
    expect(columnBars({ ...DEFAULT_COLUMN, barsWidth: 1, barsDepth: -3 })).toHaveLength(4);
  });
});

describe('interaction diagram', () => {
  const section = bendingSection(DEFAULT_COLUMN, 'x');

  it('runs from the squash load to pure tension', () => {
    const curve = interactionCurve(section);
    expect(curve[0].P).toBeCloseTo(squashLoad(section), 6);
    expect(curve[0].M).toBe(0);
    const last = curve[curve.length - 1];
    expect(last.P).toBeCloseTo((-0.87 * 415 * 8 * barArea(20)) / 1e3, 6);
    expect(last.M).toBe(0);
    // P falls monotonically along the curve.
    for (let i = 1; i < curve.length; i++) expect(curve[i].P).toBeLessThan(curve[i - 1].P);
    // The moment peaks near the balanced point, well above the pure-bending value.
    const peak = Math.max(...curve.map((p) => p.M));
    expect(peak).toBeGreaterThan(momentCapacity(section, 0).M * 1.2);
  });

  it('finds the capacity at a given axial load', () => {
    const at = momentCapacity(section, 1200);
    expect(sectionForces(section, at.xu).P).toBeCloseTo(1200, 5);
    expect(at.M).toBeGreaterThan(0);
    expect(momentCapacity(section, 1e6).M).toBe(0);
    expect(momentCapacity(section, -1e6)).toEqual({ M: 0, xu: 0 });
    const Pb = balancedLoad(section);
    expect(Pb).toBeGreaterThan(0);
    expect(Pb).toBeLessThan(squashLoad(section) / 2);
  });

  it('is the same about both axes for a square or circular section', () => {
    const square: ColumnInput = { ...DEFAULT_COLUMN, b: 400, D: 400, barsWidth: 3, barsDepth: 1 };
    expect(momentCapacity(bendingSection(square, 'x'), 900).M).toBeCloseTo(
      momentCapacity(bendingSection(square, 'y'), 900).M,
      6,
    );
    const round: ColumnInput = { ...DEFAULT_COLUMN, shape: 'circular', D: 450, barsRing: 8 };
    const sx = bendingSection(round, 'x');
    expect(sx.area).toBeCloseTo((Math.PI * 450 * 450) / 4, 6);
    expect(momentCapacity(sx, 900).M).toBeCloseTo(
      momentCapacity(bendingSection(round, 'y'), 900).M,
      4,
    );
    const As = 8 * barArea(20);
    const expected = ((0.67 * 25) / 1.5) * (sx.area - As) + steelStress(0.002, Fe415) * As;
    // The circle is integrated numerically, so allow a small tolerance.
    expect(Math.abs(squashLoad(sx) - expected / 1e3) / (expected / 1e3)).toBeLessThan(2e-4);
  });
});

describe('biaxial exponent', () => {
  it('follows cl. 39.6', () => {
    expect(biaxialExponent(0.1)).toBe(1);
    expect(biaxialExponent(0.2)).toBe(1);
    expect(biaxialExponent(0.5)).toBeCloseTo(1.5, 9);
    expect(biaxialExponent(0.8)).toBe(2);
    expect(biaxialExponent(0.95)).toBe(2);
  });
});

describe('column design', () => {
  it('checks the default short column', () => {
    const r = designColumn(DEFAULT_COLUMN);
    const Asc = 8 * barArea(20);
    expect(r.Asc).toBeCloseTo(Asc, 6);
    expect(r.percent).toBeCloseTo((100 * Asc) / 135000, 9);
    expect(r.slender).toBe(false);
    expect(r.slenderX).toBeCloseTo(3200 / 450, 9);
    expect(r.slenderY).toBeCloseTo(3200 / 300, 9);
    // ex,min = 3200/500 + 450/30 = 21.4 mm; ey,min = 6.4 + 10 = 16.4 → 20 mm.
    expect(r.eMinX).toBeCloseTo(21.4, 9);
    expect(r.eMinY).toBe(20);
    expect(r.Puz).toBeCloseTo((0.45 * 25 * (135000 - Asc) + 0.75 * 415 * Asc) / 1e3, 6);
    expect(r.alpha).toBeCloseTo(biaxialExponent(1200 / r.Puz), 9);
    expect(r.MuxDesign).toBe(120);
    expect(r.MuyDesign).toBe(40);
    expect(r.utilisation).toBeCloseTo((120 / r.Mux1) ** r.alpha + (40 / r.Muy1) ** r.alpha, 9);
    expect(r.status).toBe('ok');
    expect(r.tie.pitch).toBe(300);
    expect(r.curveX.length).toBeGreaterThan(30);
    expect(r.sections.map((s) => s.title)).toEqual([
      'Section and reinforcement',
      'Slenderness and eccentricity',
      'Strength',
      'Lateral ties',
    ]);
  });

  it('applies minimum eccentricity about one axis at a time', () => {
    const r = designColumn({ ...DEFAULT_COLUMN, Mux: 0, Muy: 0, Pu: 1500 });
    const minX = (1500 * 21.4) / 1000;
    const minY = (1500 * 20) / 1000;
    // Either the x case or the y case governs, never both at once.
    const pair = [r.MuxDesign, r.MuyDesign];
    expect(pair[0] === 0 || pair[1] === 0).toBe(true);
    expect(pair[0] + pair[1] === minX || Math.abs(pair[0] + pair[1] - minY) < 1e-9).toBe(true);
    expect(r.sections[2].steps.some((s) => s.title === 'Uniaxial bending check')).toBe(true);
  });

  it('adds slenderness moments to a slender column', () => {
    const short = designColumn({ ...DEFAULT_COLUMN, Muy: 40 });
    const r = designColumn({ ...DEFAULT_COLUMN, length: 6, Pu: 800 });
    expect(r.slender).toBe(true);
    expect(r.slenderY).toBe(20);
    // Before reduction: May = Pu b (ley/b)²/2000 = 800 × 0.3 × 400 / 2000 = 48 kN·m.
    const line = r.sections[1].steps.find((s) => s.ref === 'Cl. 39.7.1');
    expect(line?.output).toContain('May = 48.0');
    expect(r.MuyDesign).toBeGreaterThan(40);
    expect(r.MuyDesign).toBeLessThanOrEqual(40 + 48 + 1e-9);
    expect(r.checks.find((c) => c.name === 'Slenderness')?.status).toBe('warn');
    expect(short.checks.find((c) => c.name === 'Slenderness')?.status).toBe('ok');
    const absurd = designColumn({ ...DEFAULT_COLUMN, length: 20 });
    expect(absurd.checks.find((c) => c.name === 'Slenderness')?.status).toBe('fail');
  });

  it('checks circular columns', () => {
    const r = designColumn({
      ...DEFAULT_COLUMN,
      shape: 'circular',
      D: 500,
      barsRing: 8,
      Pu: 1500,
      Mux: 100,
      Muy: 60,
    });
    expect(r.Ag).toBeCloseTo((Math.PI * 500 * 500) / 4, 6);
    expect(r.Mux1).toBeCloseTo(r.Muy1, 3);
    expect(r.status).toBe('ok');
    const few = designColumn({ ...DEFAULT_COLUMN, shape: 'circular', D: 300, barsRing: 4 });
    expect(few.checks[0].status).toBe('fail');
  });

  it('reports overloads and detailing failures', () => {
    const crushed = designColumn({ ...DEFAULT_COLUMN, Pu: 9000 });
    expect(crushed.utilisation).toBe(Infinity);
    expect(crushed.status).toBe('fail');
    expect(crushed.checks.find((c) => c.name === 'Strength')?.detail).toMatch(/exceeds/);
    const bent = designColumn({ ...DEFAULT_COLUMN, Mux: 400 });
    expect(bent.utilisation).toBeGreaterThan(1);
    expect(bent.status).toBe('fail');
    const light = designColumn({
      ...DEFAULT_COLUMN,
      b: 600,
      D: 600,
      barDiameter: 12,
      barsWidth: 2,
      barsDepth: 0,
    });
    expect(light.percent).toBeLessThan(0.8);
    expect(light.checks[0].status).toBe('fail');
    const heavy = designColumn({
      ...DEFAULT_COLUMN,
      barDiameter: 32,
      barsDepth: 2,
      tieDiameter: 6,
    });
    expect(heavy.percent).toBeGreaterThan(4);
    expect(heavy.checks[0].status).toBe('warn');
    expect(heavy.checks.find((c) => c.name === 'Ties')?.status).toBe('fail');
  });

  it('gives the cl. 39.3 capacity of an axially loaded short column', () => {
    expect(shortColumnCapacity(25, 415, 160000, 2000)).toBeCloseTo(
      (0.4 * 25 * 158000 + 0.67 * 415 * 2000) / 1e3,
      9,
    );
  });
});
