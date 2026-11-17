/**
 * Solid slabs to IS 456:2000: one-way slabs (cl. 22, Tables 12 and 13) and two-way slabs
 * (cl. 24.4, Annex D). Designed per metre width.
 * Units: mm, m (spans), kN/m², kN·m/m, MPa.
 */
import type { Check, SheetSection } from './beam';
import { areaPerMetre, slabBarSpacing } from './detailing';
import { designRectangular } from './flexure';
import { findConcrete, findSteel } from './materials';
import { BASIC_RATIO, serviceStress, tensionFactor } from './serviceability';
import type { SupportCondition } from './serviceability';
import { shearStrengthConcrete, slabShearFactor } from './shear';
import { Sheet, fix, num, worstStatus } from './steps';
import type { StepStatus } from './steps';

/** Aspect ratios ly/lx at which Table 26 is tabulated. */
export const TABLE_26_RATIOS: readonly number[] = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2.0];

export interface PanelCase {
  id: number;
  name: string;
  /** Which edges are continuous: the two short edges and the two long edges. */
  shortEdges: [boolean, boolean];
  longEdges: [boolean, boolean];
  /** Short-span coefficients αx at each tabulated ratio: negative (continuous edge), positive (midspan). */
  shortNegative: readonly number[] | null;
  shortPositive: readonly number[];
  /** Long-span coefficients αy, the same for every ratio. */
  longNegative: number | null;
  longPositive: number;
}

/**
 * Bending moment coefficients for rectangular panels supported on four sides with provision for
 * torsion at corners, IS 456 Table 26. The values are typed in; `slab.test.ts` checks every one
 * against the yield-line equations the table is based on, to catch typing errors.
 */
export const TABLE_26: readonly PanelCase[] = [
  {
    id: 1,
    name: 'Interior panel',
    shortEdges: [true, true],
    longEdges: [true, true],
    shortNegative: [0.032, 0.037, 0.043, 0.047, 0.051, 0.053, 0.06, 0.065],
    shortPositive: [0.024, 0.028, 0.032, 0.036, 0.039, 0.041, 0.045, 0.049],
    longNegative: 0.032,
    longPositive: 0.024,
  },
  {
    id: 2,
    name: 'One short edge discontinuous',
    shortEdges: [true, false],
    longEdges: [true, true],
    shortNegative: [0.037, 0.043, 0.048, 0.051, 0.055, 0.057, 0.064, 0.068],
    shortPositive: [0.028, 0.032, 0.036, 0.039, 0.041, 0.044, 0.048, 0.052],
    longNegative: 0.037,
    longPositive: 0.028,
  },
  {
    id: 3,
    name: 'One long edge discontinuous',
    shortEdges: [true, true],
    longEdges: [true, false],
    shortNegative: [0.037, 0.044, 0.052, 0.057, 0.063, 0.067, 0.077, 0.085],
    shortPositive: [0.028, 0.033, 0.039, 0.044, 0.047, 0.051, 0.059, 0.065],
    longNegative: 0.037,
    longPositive: 0.028,
  },
  {
    id: 4,
    name: 'Two adjacent edges discontinuous',
    shortEdges: [true, false],
    longEdges: [true, false],
    shortNegative: [0.047, 0.053, 0.06, 0.065, 0.071, 0.075, 0.084, 0.091],
    shortPositive: [0.035, 0.04, 0.045, 0.049, 0.053, 0.056, 0.063, 0.069],
    longNegative: 0.047,
    longPositive: 0.035,
  },
  {
    id: 5,
    name: 'Two short edges discontinuous',
    shortEdges: [false, false],
    longEdges: [true, true],
    shortNegative: [0.045, 0.049, 0.052, 0.056, 0.059, 0.06, 0.065, 0.069],
    shortPositive: [0.035, 0.037, 0.04, 0.043, 0.044, 0.045, 0.049, 0.052],
    longNegative: null,
    longPositive: 0.035,
  },
  {
    id: 6,
    name: 'Two long edges discontinuous',
    shortEdges: [true, true],
    longEdges: [false, false],
    shortNegative: null,
    shortPositive: [0.035, 0.043, 0.051, 0.057, 0.063, 0.068, 0.08, 0.088],
    longNegative: 0.045,
    longPositive: 0.035,
  },
  {
    id: 7,
    name: 'Three edges discontinuous (one long edge continuous)',
    shortEdges: [false, false],
    longEdges: [true, false],
    shortNegative: [0.057, 0.064, 0.071, 0.076, 0.08, 0.084, 0.091, 0.097],
    shortPositive: [0.043, 0.048, 0.053, 0.057, 0.06, 0.064, 0.069, 0.073],
    longNegative: null,
    longPositive: 0.043,
  },
  {
    id: 8,
    name: 'Three edges discontinuous (one short edge continuous)',
    shortEdges: [true, false],
    longEdges: [false, false],
    shortNegative: null,
    shortPositive: [0.043, 0.051, 0.059, 0.065, 0.071, 0.076, 0.087, 0.096],
    longNegative: 0.057,
    longPositive: 0.043,
  },
  {
    id: 9,
    name: 'Four edges discontinuous',
    shortEdges: [false, false],
    longEdges: [false, false],
    shortNegative: null,
    shortPositive: [0.056, 0.064, 0.072, 0.079, 0.085, 0.089, 0.1, 0.107],
    longNegative: null,
    longPositive: 0.056,
  },
];

function interpolate(values: readonly number[], ratio: number): number {
  const r = Math.min(Math.max(ratio, 1), 2);
  for (let i = 1; i < TABLE_26_RATIOS.length; i++) {
    if (r <= TABLE_26_RATIOS[i]) {
      const t = (r - TABLE_26_RATIOS[i - 1]) / (TABLE_26_RATIOS[i] - TABLE_26_RATIOS[i - 1]);
      return values[i - 1] + t * (values[i] - values[i - 1]);
    }
  }
  return values[values.length - 1];
}

export interface SlabCoefficients {
  shortNegative: number;
  shortPositive: number;
  longNegative: number;
  longPositive: number;
}

/** Table 26 coefficients for a panel case at an aspect ratio ly/lx (interpolated). */
export function restrainedCoefficients(caseId: number, ratio: number): SlabCoefficients {
  const panel = TABLE_26.find((c) => c.id === caseId) ?? TABLE_26[0];
  return {
    shortNegative: panel.shortNegative ? interpolate(panel.shortNegative, ratio) : 0,
    shortPositive: interpolate(panel.shortPositive, ratio),
    longNegative: panel.longNegative ?? 0,
    longPositive: panel.longPositive,
  };
}

/**
 * The yield-line equations behind Table 26 (as printed in BS 8110, from which the table derives).
 * IS 456 rounds its table slightly differently, so these agree with it to a few percent; they
 * are used to cross-check the typed table, not for design.
 */
export function yieldLineCoefficients(panel: PanelCase, ratio: number): SlabCoefficients {
  const discontinuous = [...panel.shortEdges, ...panel.longEdges].filter((c) => !c).length;
  const by = (24 + 2 * discontinuous + 1.5 * discontinuous * discontinuous) / 1000;
  const hogY = panel.shortEdges.map((c) => (c ? (4 / 3) * by : 0));
  const gamma =
    (2 / 9) * (3 - (Math.sqrt(18) / ratio) * (Math.sqrt(by + hogY[0]) + Math.sqrt(by + hogY[1])));
  const sum = panel.longEdges.reduce((s, c) => s + (c ? Math.sqrt(7 / 3) : 1), 0);
  const bx = gamma / (sum * sum);
  return {
    shortNegative: panel.longEdges.some((c) => c) ? (4 / 3) * bx : 0,
    shortPositive: bx,
    longNegative: panel.shortEdges.some((c) => c) ? (4 / 3) * by : 0,
    longPositive: by,
  };
}

/**
 * Coefficients for a slab simply supported on four sides with corners free to lift, Table 27.
 * The table follows the Rankine–Grashoff strip theory: αx = r⁴ / 8(1 + r⁴), αy = r² / 8(1 + r⁴).
 */
export function simplySupportedCoefficients(ratio: number): { alphaX: number; alphaY: number } {
  const r4 = ratio ** 4;
  return { alphaX: r4 / (8 * (1 + r4)), alphaY: (ratio * ratio) / (8 * (1 + r4)) };
}

export interface SlabInput {
  type: 'one-way' | 'two-way';
  /** Effective short span, m. */
  lx: number;
  /** Effective long span, m (two-way slabs). */
  ly: number;
  /** Overall depth, mm. */
  D: number;
  /** Clear cover, mm. */
  cover: number;
  concrete: string;
  steel: string;
  mainDiameter: number;
  distributionDiameter: number;
  /** Superimposed dead load (finishes, partitions), kN/m². Self-weight is added. */
  dead: number;
  /** Imposed load, kN/m². */
  live: number;
  /** Support condition of a one-way slab. */
  support: SupportCondition;
  /** Table 26 case (1–9) for a two-way slab; 0 for simply supported with corners free to lift. */
  panel: number;
}

export const DEFAULT_SLAB: SlabInput = {
  type: 'two-way',
  lx: 4,
  ly: 5,
  D: 150,
  cover: 20,
  concrete: 'M25',
  steel: 'Fe415',
  mainDiameter: 10,
  distributionDiameter: 8,
  dead: 1.5,
  live: 3,
  support: 'simple',
  panel: 4,
};

export interface SlabSteel {
  location: string;
  /** Design moment, kN·m per metre width. */
  Mu: number;
  /** Effective depth used, mm. */
  d: number;
  /** Required and provided steel, mm² per metre. */
  required: number;
  provided: number;
  diameter: number;
  spacing: number;
  /** Bottom or top bars, and the direction they run in. */
  face: 'bottom' | 'top';
  direction: 'short' | 'long';
}

export interface SlabDesign {
  input: SlabInput;
  fck: number;
  fy: number;
  /** Factored load, kN/m². */
  wu: number;
  /** Aspect ratio ly/lx (1 for one-way slabs). */
  ratio: number;
  steel: SlabSteel[];
  /** Distribution steel of a one-way slab, mm²/m, with its bar spacing. */
  distribution: { required: number; diameter: number; spacing: number } | null;
  shear: { Vu: number; tauV: number; tauC: number; k: number };
  deflection: { allowable: number; actual: number; kt: number };
  sections: SheetSection[];
  checks: Check[];
  status: StepStatus;
}

/** Designs a one-way or two-way slab and returns the calculation sheet. */
export function designSlab(input: SlabInput): SlabDesign {
  const fck = findConcrete(input.concrete).fck;
  const steel = findSteel(input.steel);
  const fy = steel.fy;
  const { D, cover, lx } = input;
  const twoWay = input.type === 'two-way';
  const ratio = twoWay ? input.ly / input.lx : 1;
  const checks: Check[] = [];

  // ---- Loads ----
  const loads = new Sheet();
  const self = (25 * D) / 1000;
  const wu = 1.5 * (self + input.dead + input.live);
  loads.add({
    ref: 'IS 875 (Part 1)',
    title: 'Self-weight of the slab',
    lines: [`25 kN/m³ × ${num(D / 1000)} m`],
    output: `${num(self)} kN/m²`,
  });
  loads.add({
    ref: 'Table 18',
    title: 'Factored load',
    lines: [`wu = 1.5 (${num(self)} + ${num(input.dead)} + ${num(input.live)})`],
    output: `wu = ${num(wu)} kN/m²`,
  });
  if (twoWay) {
    const acts = ratio <= 2;
    loads.add({
      ref: 'Cl. 24.4',
      title: 'Aspect ratio',
      lines: [`ly / lx = ${num(input.ly)} / ${num(lx)} = ${fix(ratio, 2)}`],
      output: acts ? 'Two-way slab (ly/lx ≤ 2)' : 'Spans one way (ly/lx > 2)',
      status: acts ? 'ok' : 'warn',
    });
    if (!acts) {
      checks.push({
        name: 'Aspect ratio',
        status: 'warn',
        detail: `ly/lx = ${fix(ratio, 2)} > 2: the slab spans one way; design it as a one-way slab`,
      });
    }
  }

  // ---- Moments ----
  const dShort = D - cover - input.mainDiameter / 2;
  const dLong = dShort - input.mainDiameter;
  const moments: Array<Omit<SlabSteel, 'required' | 'provided' | 'diameter' | 'spacing'>> = [];
  const momentSheet = new Sheet();
  let Vu: number;
  if (!twoWay) {
    const wd = 1.5 * (self + input.dead);
    const wl = 1.5 * input.live;
    if (input.support === 'simple') {
      moments.push({
        location: 'Midspan',
        Mu: (wu * lx * lx) / 8,
        d: dShort,
        face: 'bottom',
        direction: 'short',
      });
      Vu = (wu * lx) / 2;
      momentSheet.add({
        title: 'Design moment and shear — simply supported',
        lines: [`Mu = wu l² / 8 = ${num(wu)} × ${num(lx)}² / 8`, `Vu = wu l / 2`],
        output: `Mu = ${num(moments[0].Mu)} kN·m/m, Vu = ${num(Vu)} kN/m`,
      });
    } else if (input.support === 'cantilever') {
      moments.push({
        location: 'Support',
        Mu: (wu * lx * lx) / 2,
        d: dShort,
        face: 'top',
        direction: 'short',
      });
      Vu = wu * lx;
      momentSheet.add({
        title: 'Design moment and shear — cantilever',
        lines: [`Mu = wu l² / 2 = ${num(wu)} × ${num(lx)}² / 2`, `Vu = wu l`],
        output: `Mu = ${num(moments[0].Mu)} kN·m/m, Vu = ${num(Vu)} kN/m`,
      });
    } else {
      const span = (wd * lx * lx) / 12 + (wl * lx * lx) / 10;
      const support = (wd * lx * lx) / 10 + (wl * lx * lx) / 9;
      moments.push({
        location: 'End span',
        Mu: span,
        d: dShort,
        face: 'bottom',
        direction: 'short',
      });
      moments.push({
        location: 'First interior support',
        Mu: support,
        d: dShort,
        face: 'top',
        direction: 'short',
      });
      Vu = 0.6 * wu * lx;
      momentSheet.add({
        ref: 'Tables 12, 13',
        title: 'Design moments and shear — continuous',
        lines: [
          `End span: wd l² / 12 + wl l² / 10 = ${num(span)} kN·m/m`,
          `First interior support: wd l² / 10 + wl l² / 9 = ${num(support)} kN·m/m`,
          `Vu = 0.6 wu l`,
        ],
        output: `Vu = ${num(Vu)} kN/m`,
      });
    }
  } else {
    const w = wu * lx * lx;
    if (input.panel === 0) {
      const c = simplySupportedCoefficients(Math.min(ratio, 3));
      moments.push({
        location: 'Short span, midspan',
        Mu: c.alphaX * w,
        d: dShort,
        face: 'bottom',
        direction: 'short',
      });
      moments.push({
        location: 'Long span, midspan',
        Mu: c.alphaY * w,
        d: dLong,
        face: 'bottom',
        direction: 'long',
      });
      momentSheet.add({
        ref: 'Annex D-2, Table 27',
        title: 'Moment coefficients — simply supported, corners free to lift',
        lines: [`αx = ${fix(c.alphaX, 3)}, αy = ${fix(c.alphaY, 3)} at ly/lx = ${fix(ratio, 2)}`],
        output: `Mx = αx wu lx², My = αy wu lx²`,
      });
    } else {
      const panel = TABLE_26.find((p) => p.id === input.panel) ?? TABLE_26[0];
      const c = restrainedCoefficients(panel.id, ratio);
      if (c.shortNegative > 0) {
        moments.push({
          location: 'Short span, continuous edge',
          Mu: c.shortNegative * w,
          d: dShort,
          face: 'top',
          direction: 'short',
        });
      }
      moments.push({
        location: 'Short span, midspan',
        Mu: c.shortPositive * w,
        d: dShort,
        face: 'bottom',
        direction: 'short',
      });
      if (c.longNegative > 0) {
        moments.push({
          location: 'Long span, continuous edge',
          Mu: c.longNegative * w,
          d: dLong,
          face: 'top',
          direction: 'long',
        });
      }
      moments.push({
        location: 'Long span, midspan',
        Mu: c.longPositive * w,
        d: dLong,
        face: 'bottom',
        direction: 'long',
      });
      momentSheet.add({
        ref: 'Annex D-1, Table 26',
        title: `Moment coefficients — case ${panel.id}: ${panel.name.toLowerCase()}`,
        lines: [
          `Short span: αx⁻ = ${c.shortNegative > 0 ? fix(c.shortNegative, 3) : '–'}, αx⁺ = ${fix(c.shortPositive, 3)}`,
          `Long span: αy⁻ = ${c.longNegative > 0 ? fix(c.longNegative, 3) : '–'}, αy⁺ = ${fix(c.longPositive, 3)}`,
          `at ly/lx = ${fix(ratio, 2)}; wu lx² = ${num(w)} kN·m/m`,
        ],
        output: `M = α wu lx²`,
      });
    }
    Vu = (wu * lx) / 2;
  }

  // ---- Reinforcement ----
  const steelSheet = new Sheet();
  const minimum = ((steel.deformed ? 0.12 : 0.15) / 100) * 1000 * D;
  const barLimit = D / 8;
  steelSheet.add({
    ref: 'Cl. 26.5.2.1',
    title: 'Minimum reinforcement',
    lines: [
      `${steel.deformed ? '0.12' : '0.15'} % of the gross area = ${steel.deformed ? '0.0012' : '0.0015'} × 1000 × ${num(D)}`,
    ],
    output: `As,min = ${num(minimum)} mm²/m`,
  });
  const results: SlabSteel[] = [];
  let strengthOk = true;
  for (const m of moments) {
    const design = designRectangular({ b: 1000, d: m.d, dc: 0, fck, steel }, m.Mu);
    const singly = design.kind === 'singly';
    if (!singly) strengthOk = false;
    const required = Math.max(design.Ast, minimum);
    const maximum = Math.min(3 * m.d, 300);
    const spacing = slabBarSpacing(required, input.mainDiameter, maximum);
    const provided = areaPerMetre(input.mainDiameter, spacing);
    if (provided < required - 1e-6) strengthOk = false;
    results.push({ ...m, required, provided, diameter: input.mainDiameter, spacing });
    steelSheet.add({
      ref: 'Annex G-1.1, Cl. 26.3.3 (b)',
      title: `${m.location}: Mu = ${num(m.Mu)} kN·m/m, d = ${num(m.d)} mm`,
      lines: [
        singly
          ? `Ast = ${num(design.Ast)} mm²/m (Mu,lim = ${num(design.limits.MuLim)} kN·m/m)`
          : `Mu exceeds Mu,lim = ${num(design.limits.MuLim)} kN·m/m: increase the depth`,
        `Required ${num(required)} mm²/m; spacing ≤ 3d and 300 mm = ${num(maximum)} mm`,
      ],
      output: `${input.mainDiameter} mm @ ${spacing} mm c/c ${m.face} (${num(provided)} mm²/m)`,
      status: singly && provided >= required - 1e-6 ? 'ok' : 'fail',
    });
  }
  let distribution: SlabDesign['distribution'] = null;
  if (!twoWay) {
    const maximum = Math.min(5 * dShort, 450);
    const spacing = slabBarSpacing(minimum, input.distributionDiameter, maximum);
    distribution = { required: minimum, diameter: input.distributionDiameter, spacing };
    steelSheet.add({
      ref: 'Cl. 26.5.2.1, 26.3.3 (b)',
      title: 'Distribution steel',
      lines: [`As,min = ${num(minimum)} mm²/m; spacing ≤ 5d and 450 mm = ${num(maximum)} mm`],
      output: `${input.distributionDiameter} mm @ ${spacing} mm c/c`,
    });
  } else if (input.panel > 0) {
    const panel = TABLE_26.find((p) => p.id === input.panel) ?? TABLE_26[0];
    if ([...panel.shortEdges, ...panel.longEdges].some((c) => !c)) {
      steelSheet.add({
        ref: 'Annex D-1.8',
        title: 'Torsion reinforcement at corners',
        lines: [
          `Where both edges meeting at a corner are discontinuous, provide four layers each of`,
          `0.75 × the short-span midspan steel over lx / 5 in both directions (half of that where`,
          `only one of the two edges is discontinuous)`,
        ],
        output: `${num(0.75 * (results.find((r) => r.location === 'Short span, midspan')?.required ?? 0))} mm²/m per layer`,
      });
    }
  }
  const barOk = input.mainDiameter <= barLimit;
  steelSheet.add({
    ref: 'Cl. 26.5.2.2',
    title: 'Maximum bar diameter',
    lines: [`Bar diameter ≤ D / 8 = ${num(barLimit)} mm`],
    output: barOk ? 'Satisfied' : 'Use smaller bars',
    status: barOk ? 'ok' : 'fail',
  });
  checks.push({
    name: 'Flexure',
    status: strengthOk ? 'ok' : 'fail',
    detail: `Largest moment ${num(Math.max(...moments.map((m) => m.Mu)))} kN·m/m`,
  });
  checks.push({
    name: 'Detailing',
    status: barOk ? 'ok' : 'fail',
    detail: `${input.mainDiameter} mm bars in a ${num(D)} mm slab`,
  });

  // ---- Shear ----
  const shearSheet = new Sheet();
  const main = results.reduce(
    (a, r) => (r.direction === 'short' && r.provided > a.provided ? r : a),
    results[0],
  );
  const pt = (100 * main.provided) / (1000 * dShort);
  const k = slabShearFactor(D);
  const tauC = shearStrengthConcrete(fck, pt);
  const tauV = (Vu * 1000) / (1000 * dShort);
  const shearOk = tauV <= k * tauC;
  shearSheet.add({
    ref: 'Cl. 40.1',
    title: 'Nominal shear stress',
    lines: [`Vu = ${num(Vu)} kN/m; τv = Vu / (b d) = ${num(Vu)} × 10³ / (1000 × ${num(dShort)})`],
    output: `τv = ${fix(tauV, 2)} MPa`,
  });
  shearSheet.check(
    'Cl. 40.2.1.1, Table 19',
    'Shear strength of the slab',
    [
      `pt = ${fix(pt, 2)} %: τc = ${fix(tauC, 2)} MPa; k = ${fix(k, 2)} for D = ${num(D)} mm`,
      `k τc = ${fix(k * tauC, 2)} MPa ${shearOk ? '≥' : '<'} τv`,
    ],
    shearOk,
    shearOk ? 'No shear reinforcement needed' : 'Increase the depth',
  );
  checks.push({
    name: 'Shear',
    status: shearOk ? 'ok' : 'fail',
    detail: `τv = ${fix(tauV, 2)} MPa, k τc = ${fix(k * tauC, 2)} MPa`,
  });

  // ---- Deflection ----
  const deflectionSheet = new Sheet();
  const condition: SupportCondition = !twoWay
    ? input.support
    : input.panel === 0 || input.panel === 9
      ? 'simple'
      : 'continuous';
  const governing =
    results.find(
      (r) => r.direction === 'short' && r.face === (condition === 'cantilever' ? 'top' : 'bottom'),
    ) ?? results[0];
  const fs = serviceStress(fy, governing.required, governing.provided);
  const kt = tensionFactor(fs, (100 * governing.provided) / (1000 * dShort));
  const allowable = BASIC_RATIO[condition] * kt;
  const actual = (lx * 1000) / dShort;
  const deflectionOk = actual <= allowable + 1e-9;
  deflectionSheet.check(
    'Cl. 23.2.1, 24.1',
    'Span / effective depth check (short span)',
    [
      `Basic ratio ${BASIC_RATIO[condition]} (${condition}); fs = ${num(fs)} MPa, kt = ${fix(kt, 2)}`,
      `Allowable = ${fix(allowable, 1)}; actual = ${num(lx * 1000)} / ${num(dShort)} = ${fix(actual, 1)}`,
    ],
    deflectionOk,
    deflectionOk ? 'Deflection is satisfactory' : 'Increase the depth',
  );
  checks.push({
    name: 'Deflection',
    status: deflectionOk ? 'ok' : 'fail',
    detail: `span/d = ${fix(actual, 1)}, allowable ${fix(allowable, 1)}`,
  });

  return {
    input,
    fck,
    fy,
    wu,
    ratio,
    steel: results,
    distribution,
    shear: { Vu, tauV, tauC, k },
    deflection: { allowable, actual, kt },
    sections: [
      { title: 'Loads', steps: loads.steps },
      { title: 'Bending moments', steps: momentSheet.steps },
      { title: 'Reinforcement', steps: steelSheet.steps },
      { title: 'Shear', steps: shearSheet.steps },
      { title: 'Deflection', steps: deflectionSheet.steps },
    ],
    checks,
    status: worstStatus(checks.map((c) => ({ title: c.name, lines: [], status: c.status }))),
  };
}
