import { describe, expect, it } from 'vitest';
import {
  capacityRectangular,
  designFlanged,
  designRectangular,
  effectiveFlangeWidth,
  flangedCompression,
  limitingValues,
  maximumSteel,
  minimumTensionSteel,
} from './flexure';
import {
  CONCRETE_GRADES,
  STEEL_GRADES,
  barArea,
  concreteModulus,
  concreteStress,
  findConcrete,
  findSteel,
  steelStress,
  xuMaxRatio,
  yieldStrain,
} from './materials';
import { designShear, maximumShearStress, shearStrengthConcrete, slabShearFactor } from './shear';
import { Sheet, fix, num, worstStatus } from './steps';

/**
 * The code's design formula (Annex G-1.1 b, the "4.6" formula) and its stress block (0.36, 0.42)
 * are rounded independently, so designing with one and analysing with the other agrees to
 * about 0.5 %, not to machine precision.
 */
const within = (actual: number, expected: number, tolerance = 0.005) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(tolerance);

const Fe250 = findSteel('Fe250');
const Fe415 = findSteel('Fe415');
const Fe500 = findSteel('Fe500');

describe('materials', () => {
  it('gives the code values of xu,max / d', () => {
    expect(xuMaxRatio(250)).toBe(0.53);
    expect(xuMaxRatio(415)).toBe(0.48);
    expect(xuMaxRatio(500)).toBe(0.46);
    expect(xuMaxRatio(550)).toBe(0.44);
  });

  it('follows the SP 16 Table A points for Fe415 and Fe500', () => {
    // [strain, stress] pairs published in SP 16 Table A.
    const fe415: Array<[number, number]> = [
      [0.00144, 288.7],
      [0.00163, 306.7],
      [0.00192, 324.8],
      [0.00241, 342.8],
      [0.00276, 351.8],
      [0.0038, 360.9],
    ];
    // SP 16 uses fy/1.15 where the code text uses 0.87 fy, and prints strains to five places,
    // so agreement is to about 0.5 %.
    for (const [strain, stress] of fe415) {
      expect(Math.abs(steelStress(strain, Fe415) - stress)).toBeLessThan(1.5);
    }
    const fe500: Array<[number, number]> = [
      [0.00174, 347.8],
      [0.00195, 369.6],
      [0.00226, 391.3],
      [0.00277, 413.0],
      [0.00312, 423.9],
      [0.00417, 434.8],
    ];
    for (const [strain, stress] of fe500) {
      expect(Math.abs(steelStress(strain, Fe500) - stress)).toBeLessThan(1.8);
    }
  });

  it('is elastic then flat for mild steel, and symmetric in compression', () => {
    expect(steelStress(0.0005, Fe250)).toBeCloseTo(100, 6);
    expect(steelStress(0.01, Fe250)).toBeCloseTo(217.5, 6);
    expect(steelStress(-0.01, Fe415)).toBeCloseTo(-0.87 * 415, 6);
    expect(steelStress(0.001, Fe415)).toBeCloseTo(200, 6);
    expect(yieldStrain(Fe415)).toBeCloseTo(0.0038, 4);
    expect(yieldStrain(Fe250)).toBeCloseTo(0.0010875, 7);
  });

  it('models the parabolic-rectangular concrete block', () => {
    expect(concreteStress(-0.001, 30)).toBe(0);
    expect(concreteStress(0.002, 30)).toBeCloseTo(13.4, 6);
    expect(concreteStress(0.0035, 30)).toBeCloseTo(13.4, 6);
    expect(concreteStress(0.001, 30)).toBeCloseTo(13.4 * 0.75, 6);
    expect(concreteModulus(25)).toBe(25000);
  });

  it('exposes grades and bar areas', () => {
    expect(CONCRETE_GRADES.map((g) => g.name)).toContain('M30');
    expect(STEEL_GRADES).toHaveLength(4);
    expect(findConcrete('M40').fck).toBe(40);
    expect(findConcrete('nope').name).toBe('M25');
    expect(findSteel('nope').name).toBe('Fe415');
    expect(barArea(16)).toBeCloseTo(201.06, 2);
  });
});

describe('step helpers', () => {
  it('formats numbers the way a calculation sheet does', () => {
    expect(num(0)).toBe('0');
    expect(num(12345.6)).toBe('12346');
    expect(num(1234.56)).toBe('1235');
    expect(num(123.456)).toBe('123');
    expect(num(12.3456)).toBe('12.3');
    expect(num(1.23456)).toBe('1.23');
    expect(num(0.123456)).toBe('0.123');
    expect(num(0.00123456)).toBe('0.0012');
    expect(num(Number.NaN)).toBe('–');
    expect(fix(1.005, 2)).toBe('1.00');
    expect(fix(Infinity, 1)).toBe('–');
  });

  it('tracks the worst status', () => {
    const sheet = new Sheet();
    sheet.add({ title: 'a', lines: [] });
    expect(worstStatus(sheet.steps)).toBe('ok');
    sheet.add({ title: 'b', lines: [], status: 'warn' });
    expect(worstStatus(sheet.steps)).toBe('warn');
    sheet.check('Cl. 1', 'c', ['x'], false, 'no');
    sheet.check(undefined, 'd', ['x'], true, 'yes');
    expect(worstStatus(sheet.steps)).toBe('fail');
    expect(sheet.steps[3].status).toBe('ok');
  });
});

describe('limiting values of a rectangular section', () => {
  it('reproduces the published Mu,lim coefficients', () => {
    // SP 16 Table C: Mu,lim / (fck b d²) = 0.149, 0.138, 0.133.
    expect(limitingValues(300, 500, 20, 250).coefficient).toBeCloseTo(0.148, 3);
    expect(limitingValues(300, 500, 20, 415).coefficient).toBeCloseTo(0.138, 3);
    expect(limitingValues(300, 500, 20, 500).coefficient).toBeCloseTo(0.133, 2);
  });

  it('reproduces the published limiting steel percentages', () => {
    // SP 16 Table E: pt,lim for M20 / M25 / M30.
    const table: Array<[number, number, number]> = [
      [20, 250, 1.76],
      [20, 415, 0.96],
      [20, 500, 0.76],
      [25, 415, 1.19],
      [30, 415, 1.43],
      [25, 500, 0.94],
      [30, 500, 1.13],
    ];
    // SP 16 works with unrounded xu,max/d (0.479, 0.456); the code's 0.48 and 0.46 are used here.
    for (const [fck, fy, expected] of table) {
      expect(Math.abs(limitingValues(250, 450, fck, fy).ptLim - expected)).toBeLessThan(0.015);
    }
  });
});

describe('design of rectangular sections', () => {
  const section = { b: 250, d: 450, dc: 40, fck: 25, steel: Fe415 };

  it('designs a singly reinforced section that analyses back to the same moment', () => {
    const design = designRectangular(section, 120);
    expect(design.kind).toBe('singly');
    expect(design.Asc).toBe(0);
    // Hand check: Ast = 0.5×25/415 × (1 - √(1 - 4.6×120e6/(25×250×450²))) × 250 × 450
    const k = (4.6 * 120e6) / (25 * 250 * 450 * 450);
    expect(design.Ast).toBeCloseTo(((0.5 * 25) / 415) * (1 - Math.sqrt(1 - k)) * 250 * 450, 6);
    const back = capacityRectangular(section, design.Ast);
    expect(back.overReinforced).toBe(false);
    within(back.Mu, 120);
    expect(back.xu).toBeCloseTo(design.xu, 3);
    expect(design.steps.length).toBeGreaterThanOrEqual(4);
  });

  it('gives exactly the balanced steel at the limiting moment', () => {
    const limits = limitingValues(250, 450, 25, 415);
    const design = designRectangular(section, limits.MuLim);
    expect(design.kind).toBe('singly');
    within(design.Ast, limits.AstLim);
    within(design.xu, limits.xuMax);
  });

  it('designs a doubly reinforced section that analyses back to the same moment', () => {
    const design = designRectangular(section, 260);
    expect(design.kind).toBe('doubly');
    expect(design.Asc).toBeGreaterThan(0);
    expect(design.Ast).toBeGreaterThan(design.limits.AstLim);
    const back = capacityRectangular(section, design.Ast, design.Asc);
    within(back.Mu, 260, 0.001);
    within(back.xu, design.limits.xuMax, 0.002);
    // Compression steel at d′/d = 0.089 in Fe415 has not quite yielded.
    expect(design.fsc).toBeGreaterThan(340);
    expect(design.fsc).toBeLessThan(0.87 * 415);
  });

  it('caps an over-reinforced section at the limiting moment', () => {
    const limits = limitingValues(250, 450, 25, 415);
    const capacity = capacityRectangular(section, limits.AstLim * 1.6);
    expect(capacity.overReinforced).toBe(true);
    expect(capacity.Mu).toBeCloseTo(limits.MuLim, 6);
    expect(capacity.steps[0].status).toBe('warn');
  });

  it('works for mild steel', () => {
    const mild = { ...section, steel: Fe250 };
    const design = designRectangular(mild, 90);
    within(capacityRectangular(mild, design.Ast).Mu, 90);
    expect(capacityRectangular(mild, design.Ast).fst).toBeCloseTo(217.5, 6);
  });

  it('gives the code minimum and maximum steel', () => {
    expect(minimumTensionSteel(250, 450, 415)).toBeCloseTo((0.85 * 250 * 450) / 415, 9);
    expect(maximumSteel(250, 500)).toBe(5000);
  });
});

describe('flanged sections', () => {
  const tee = { bf: 1200, bw: 300, Df: 120, d: 550, fck: 20, steel: Fe415 };

  it('treats a lightly loaded T-beam as a wide rectangle', () => {
    const design = designFlanged(tee, 250);
    expect(design.kind).toBe('flange');
    expect(design.xu).toBeLessThan(120);
    const rect = designRectangular({ b: 1200, d: 550, dc: 0, fck: 20, steel: Fe415 }, 250);
    expect(design.Ast).toBeCloseTo(rect.Ast, 6);
  });

  it('puts the neutral axis in the web for a heavy moment and satisfies equilibrium', () => {
    const design = designFlanged(tee, 700);
    expect(design.kind).toBe('web');
    expect(design.adequate).toBe(true);
    expect(design.xu).toBeGreaterThan(120);
    expect(design.xu).toBeLessThanOrEqual(design.xuMax);
    const c = flangedCompression(tee, design.xu);
    expect(c.moment / 1e6).toBeCloseTo(700, 4);
    expect(design.Ast * 0.87 * 415).toBeCloseTo(c.force, 3);
  });

  it('uses the full flange when Df/xu ≤ 0.43 and a reduced depth otherwise', () => {
    // xu = 300: Df/xu = 0.40 → yf = Df.
    expect(flangedCompression(tee, 300).yf).toBe(120);
    // xu = 200: Df/xu = 0.60 → yf = 0.15×200 + 0.65×120 = 108.
    expect(flangedCompression(tee, 200).yf).toBeCloseTo(108, 9);
    // Hand value at xu = 300: web 0.36×20×300×300 = 648 kN, flange 0.45×20×900×120 = 972 kN.
    const c = flangedCompression(tee, 300);
    expect(c.force).toBeCloseTo(648000 + 972000, 6);
    expect(c.moment).toBeCloseTo(648000 * (550 - 126) + 972000 * (550 - 60), 3);
  });

  it('flags a moment beyond the limiting capacity', () => {
    const design = designFlanged(tee, 2000);
    expect(design.adequate).toBe(false);
    expect(design.xu).toBe(design.xuMax);
    expect(design.steps.some((s) => s.status === 'fail')).toBe(true);
  });

  it('computes the effective flange width', () => {
    expect(effectiveFlangeWidth('T', 6000, 300, 120, 4000)).toBe(1000 + 300 + 720);
    expect(effectiveFlangeWidth('L', 6000, 300, 120, 4000)).toBe(500 + 300 + 360);
    expect(effectiveFlangeWidth('T', 6000, 300, 120, 1500)).toBe(1500);
  });
});

describe('shear', () => {
  it('reproduces Table 19 for M20 and M25', () => {
    const m20: Array<[number, number]> = [
      [0.15, 0.28],
      [0.25, 0.36],
      [0.5, 0.48],
      [0.75, 0.56],
      [1.0, 0.62],
      [1.25, 0.67],
      [1.5, 0.72],
      [1.75, 0.75],
      [2.0, 0.79],
      [2.5, 0.82],
      [3.0, 0.82],
    ];
    for (const [pt, tau] of m20) {
      expect(Math.abs(shearStrengthConcrete(20, pt) - tau)).toBeLessThan(0.011);
    }
    const m25: Array<[number, number]> = [
      [0.25, 0.36],
      [0.5, 0.49],
      [0.75, 0.57],
      [1.0, 0.64],
      [1.25, 0.7],
      [1.5, 0.74],
      [2.0, 0.82],
    ];
    for (const [pt, tau] of m25) {
      expect(Math.abs(shearStrengthConcrete(25, pt) - tau)).toBeLessThan(0.011);
    }
    // Below 0.15 % and above 3 % the end values apply; grades above M40 use M40.
    expect(shearStrengthConcrete(20, 0.05)).toBe(shearStrengthConcrete(20, 0.15));
    expect(shearStrengthConcrete(20, 5)).toBe(shearStrengthConcrete(20, 3));
    expect(shearStrengthConcrete(50, 1)).toBe(shearStrengthConcrete(40, 1));
  });

  it('gives Table 20 and the slab factor', () => {
    expect(maximumShearStress(20)).toBe(2.8);
    expect(maximumShearStress(25)).toBe(3.1);
    expect(maximumShearStress(32)).toBe(3.5);
    expect(maximumShearStress(50)).toBe(4.0);
    expect(slabShearFactor(120)).toBe(1.3);
    expect(slabShearFactor(175)).toBeCloseTo(1.25, 9);
    expect(slabShearFactor(250)).toBeCloseTo(1.1, 9);
    expect(slabShearFactor(400)).toBe(1);
  });

  it('designs stirrups for a shear above the concrete strength', () => {
    const r = designShear({
      b: 250,
      d: 450,
      fck: 25,
      Vu: 180,
      Ast: 3 * barArea(20),
      fyStirrup: 415,
      stirrupDiameter: 8,
      legs: 2,
    });
    const tauC = shearStrengthConcrete(25, (100 * 3 * barArea(20)) / (250 * 450));
    expect(r.tauV).toBeCloseTo(1.6, 9);
    expect(r.Vus).toBeCloseTo(180 - (tauC * 250 * 450) / 1000, 9);
    const Asv = 2 * barArea(8);
    expect(r.spacingStrength).toBeCloseTo((0.87 * 415 * Asv * 450) / (r.Vus * 1000), 6);
    expect(r.spacing).toBe(Math.floor(r.spacingStrength / 5) * 5);
    expect(r.adequate).toBe(true);
  });

  it('falls back to minimum stirrups and the maximum spacing', () => {
    const r = designShear({
      b: 300,
      d: 600,
      fck: 20,
      Vu: 40,
      Ast: 800,
      fyStirrup: 500,
      stirrupDiameter: 8,
      legs: 2,
    });
    expect(r.Vus).toBe(0);
    expect(r.spacingStrength).toBe(Infinity);
    // Stirrup steel is limited to 415 MPa: 0.87×415×100.5/(0.4×300) = 302 mm, capped at 300.
    expect(r.spacingMinimum).toBeCloseTo((0.87 * 415 * 2 * barArea(8)) / 120, 6);
    expect(r.spacingMaximum).toBe(300);
    expect(r.spacing).toBe(300);
  });

  it('rejects a section whose shear stress exceeds τc,max', () => {
    const r = designShear({
      b: 200,
      d: 300,
      fck: 20,
      Vu: 200,
      Ast: 600,
      fyStirrup: 415,
      stirrupDiameter: 8,
      legs: 2,
    });
    expect(r.tauV).toBeGreaterThan(2.8);
    expect(r.adequate).toBe(false);
    expect(r.steps.some((s) => s.status === 'fail')).toBe(true);
  });
});
