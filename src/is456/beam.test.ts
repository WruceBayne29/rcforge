import { describe, expect, it } from 'vitest';
import { bondStress, developmentLength, lapLength } from './anchorage';
import { DEFAULT_BEAM, designBeam, neutralAxisDepth } from './beam';
import type { BeamInput } from './beam';
import {
  areaPerMetre,
  barsPerLayer,
  chooseBars,
  maximumClearSpacing,
  minimumClearSpacing,
  slabBarSpacing,
} from './detailing';
import { barArea, findSteel } from './materials';
import {
  compressionFactor,
  flangeFactor,
  longSpanFactor,
  serviceStress,
  tensionFactor,
} from './serviceability';

const Fe250 = findSteel('Fe250');
const Fe415 = findSteel('Fe415');

describe('anchorage', () => {
  it('gives the familiar development lengths', () => {
    // M20, Fe415 in tension: τbd = 1.2 × 1.6 = 1.92 → Ld = 0.87×415/(4×1.92) φ = 47.0 φ.
    expect(bondStress(20, Fe415)).toBeCloseTo(1.92, 9);
    expect(developmentLength(16, 20, Fe415) / 16).toBeCloseTo(47.01, 2);
    // M25: τbd = 1.4 × 1.6 = 2.24 → 40.3 φ.
    expect(developmentLength(20, 25, Fe415) / 20).toBeCloseTo(40.3, 1);
    // Mild steel, M20: 0.87×250/(4×1.2) = 45.3 φ.
    expect(developmentLength(12, 20, Fe250) / 12).toBeCloseTo(45.3, 1);
    // Compression: 25 % higher bond stress.
    expect(bondStress(30, Fe415, true)).toBeCloseTo(1.5 * 1.6 * 1.25, 9);
    expect(bondStress(50, Fe415)).toBeCloseTo(1.9 * 1.6, 9);
  });

  it('applies the minimum lap lengths', () => {
    expect(lapLength(16, 20, Fe415)).toBeCloseTo(developmentLength(16, 20, Fe415), 9);
    // In compression with M40: Ld = 0.87×415/(4×3.8) = 23.8 φ < 24 φ.
    expect(lapLength(20, 40, Fe415, true)).toBe(480);
  });
});

describe('serviceability factors', () => {
  it('matches points read from Fig. 4', () => {
    // fs = 240 MPa (Fe415, steel as required): about 2.0 at 0.2 %, 1.2 at 0.6 %, 0.95 at 1.2 %.
    expect(tensionFactor(240, 0.2)).toBeGreaterThan(1.7);
    expect(Math.abs(tensionFactor(240, 0.6) - 1.16)).toBeLessThan(0.05);
    expect(Math.abs(tensionFactor(240, 1.2) - 0.95)).toBeLessThan(0.04);
    // fs = 145 MPa (Fe250): about 2.0 at 0.4 %, 1.45 at 1.0 %.
    expect(tensionFactor(145, 0.3)).toBe(2);
    expect(Math.abs(tensionFactor(145, 1.0) - 1.45)).toBeLessThan(0.05);
    expect(tensionFactor(240, 0)).toBe(2);
    expect(tensionFactor(120, 0.05)).toBe(2);
  });

  it('gives the other factors', () => {
    expect(compressionFactor(0)).toBe(1);
    expect(compressionFactor(1)).toBeCloseTo(1.25, 9);
    expect(compressionFactor(3)).toBe(1.5);
    expect(compressionFactor(9)).toBe(1.5);
    expect(flangeFactor(300, 1500)).toBe(0.8);
    expect(flangeFactor(300, 600)).toBeCloseTo(0.8 + (2 / 7) * 0.2, 9);
    expect(flangeFactor(300, 300)).toBe(1);
    expect(longSpanFactor('simple', 8)).toBe(1);
    expect(longSpanFactor('simple', 12.5)).toBe(0.8);
    expect(longSpanFactor('cantilever', 12.5)).toBe(1);
    expect(serviceStress(415, 800, 1000)).toBeCloseTo(0.58 * 415 * 0.8, 9);
    expect(serviceStress(415, 1200, 1000)).toBeCloseTo(0.58 * 415, 9);
  });
});

describe('bar selection', () => {
  it('fits bars in a layer', () => {
    expect(minimumClearSpacing(16)).toBe(25);
    expect(minimumClearSpacing(32)).toBe(32);
    // 234 mm clear: 20 mm bars at 25 gaps → (234 + 25) / 45 = 5 bars.
    expect(barsPerLayer(234, 20)).toBe(5);
    expect(barsPerLayer(10, 20)).toBe(0);
    expect(maximumClearSpacing(250)).toBe(300);
    expect(maximumClearSpacing(415)).toBe(180);
    expect(maximumClearSpacing(500)).toBe(150);
  });

  it('chooses the least steel that fits in one layer', () => {
    const choice = chooseBars(900, 234);
    expect(choice.area).toBeGreaterThanOrEqual(900);
    expect(choice.layers).toBe(1);
    // 3–20 (942) beats 5–16 (1005), 8–12 (905 would need two layers) and 2–25 (982).
    expect([choice.count, choice.diameter]).toEqual([3, 20]);
    expect(choice.clearSpacing).toBeCloseTo((234 - 60) / 2, 9);
  });

  it('honours a forced diameter and goes to two layers when it must', () => {
    const choice = chooseBars(2400, 184, { diameter: 20 });
    expect(choice.count).toBe(8);
    expect(choice.layers).toBe(2);
    const single = chooseBars(100, 200, { diameter: 16, minimumCount: 1 });
    expect(single.count).toBe(1);
    expect(single.clearSpacing).toBe(184);
  });

  it('spaces slab bars', () => {
    expect(slabBarSpacing(400, 10, 300)).toBe(195);
    expect(slabBarSpacing(100, 8, 300)).toBe(300);
    expect(slabBarSpacing(1e6, 8, 300)).toBe(50);
    expect(areaPerMetre(10, 200)).toBeCloseTo(5 * barArea(10), 9);
  });
});

describe('beam design', () => {
  it('designs the default simply supported beam', () => {
    const r = designBeam(DEFAULT_BEAM);
    // wu = 1.5 × (15 + 25×0.3×0.5 + 10) = 43.125 kN/m; Mu = 43.125×36/8; Vu = 43.125×3.
    expect(r.Mu).toBeCloseTo(194.0625, 6);
    expect(r.Vu).toBeCloseTo(129.375, 6);
    expect(r.doubly).toBe(false);
    expect(r.tension.area).toBeGreaterThanOrEqual(r.AstRequired);
    expect(r.MuCapacity).toBeGreaterThan(r.Mu);
    expect(r.d).toBeCloseTo(500 - 25 - 8 - r.tension.diameter / 2, 6);
    expect(r.checks.map((c) => c.name)).toEqual([
      'Flexure',
      'Steel limits',
      'Bar spacing',
      'Shear',
      'Deflection',
    ]);
    expect(r.status).toBe('ok');
    expect(r.sections.map((s) => s.title)).toContain('Anchorage');
    expect(r.xu).toBeLessThanOrEqual(r.xuMax);
    expect(neutralAxisDepth(r.tension.area, 300, 25, 415)).toBeCloseTo(r.xu, 0);
  });

  const withInput = (patch: Partial<BeamInput>) => designBeam({ ...DEFAULT_BEAM, ...patch });

  it('switches to a doubly reinforced section when the moment is high', () => {
    const r = withInput({ loading: { kind: 'forces', Mu: 420, Vu: 200 } });
    expect(r.doubly).toBe(true);
    expect(r.topIsStructural).toBe(true);
    expect(r.top.area).toBeGreaterThanOrEqual(r.AscRequired);
    expect(r.MuCapacity).toBeGreaterThan(420 * 0.995);
    expect(r.sections[2].steps.some((s) => s.title.startsWith('Compression reinforcement'))).toBe(
      true,
    );
  });

  it('handles cantilevers and continuous beams', () => {
    const cantilever = withInput({ support: 'cantilever', span: 2.5 });
    const wu = 1.5 * (15 + 3.75 + 10);
    expect(cantilever.Mu).toBeCloseTo((wu * 2.5 * 2.5) / 2, 6);
    expect(cantilever.Vu).toBeCloseTo(wu * 2.5, 6);
    expect(cantilever.deflection.basic).toBe(7);
    const continuous = withInput({ support: 'continuous', shape: 'tee' });
    expect(continuous.Mu).toBeCloseTo((1.5 * 18.75 * 36) / 10 + (1.5 * 10 * 36) / 9, 6);
    expect(continuous.Vu).toBeCloseTo(0.6 * wu * 6, 6);
    // The flange is in tension at a support, so no flange factor is applied.
    expect(continuous.deflection.kf).toBe(1);
  });

  it('designs a T-beam in sagging and applies the flange factor', () => {
    const r = withInput({ shape: 'tee', loading: { kind: 'forces', Mu: 300, Vu: 150 } });
    expect(r.deflection.kf).toBe(0.8);
    expect(r.doubly).toBe(false);
    expect(r.xu).toBeLessThan(120);
    expect(r.MuCapacity).toBeGreaterThan(300);
    expect(r.sections[4].steps.some((s) => s.ref === 'Fig. 6')).toBe(true);
    const heavy = withInput({
      shape: 'ell',
      bf: 500,
      loading: { kind: 'forces', Mu: 2500, Vu: 150 },
    });
    expect(heavy.status).toBe('fail');
    expect(heavy.checks[0]).toMatchObject({ name: 'Flexure', status: 'fail' });
  });

  it('reports failures: shallow beams deflect, thin webs fail in shear', () => {
    const shallow = withInput({ D: 300, span: 8, loading: { kind: 'forces', Mu: 60, Vu: 40 } });
    expect(shallow.checks.find((c) => c.name === 'Deflection')?.status).toBe('fail');
    const shear = withInput({ b: 200, D: 300, loading: { kind: 'forces', Mu: 40, Vu: 220 } });
    expect(shear.checks.find((c) => c.name === 'Shear')?.status).toBe('fail');
    expect(shear.status).toBe('fail');
  });

  it('uses minimum steel for a lightly loaded beam and adds side face steel to deep ones', () => {
    const r = withInput({ D: 800, loading: { kind: 'forces', Mu: 20, Vu: 20 } });
    expect(r.AstRequired).toBeGreaterThan(r.AstCalculated);
    expect(r.sections[2].steps.some((s) => s.title === 'Side face reinforcement')).toBe(true);
    expect(r.shear.Vus).toBe(0);
  });

  it('respects a chosen bar size, long spans and omitted self-weight', () => {
    const r = withInput({
      mainDiameter: 16,
      span: 12,
      D: 900,
      loading: { kind: 'udl', dead: 10, live: 5, selfWeight: false },
    });
    expect(r.tension.diameter).toBe(16);
    expect(r.Mu).toBeCloseTo((22.5 * 144) / 8, 6);
    expect(r.sections[4].steps[0].lines.join(' ')).toMatch(/10 \/ span/);
    const many = withInput({
      mainDiameter: 12,
      b: 230,
      loading: { kind: 'forces', Mu: 200, Vu: 100 },
    });
    expect(many.tension.layers).toBeGreaterThan(1);
    expect(many.d).toBeLessThan(500 - 25 - 8 - 6);
  });
});
