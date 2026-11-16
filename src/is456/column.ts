/**
 * Columns to IS 456:2000: axial load with uniaxial or biaxial bending (cl. 39), minimum
 * eccentricity (cl. 25.4), slenderness (cl. 25.1.2, 39.7) and the P–M interaction diagram
 * computed from first principles by strain compatibility.
 * Units: mm, m (length), kN, kN·m, MPa.
 */
import {
  EPS_C0,
  EPS_CU,
  barArea,
  concreteDesignStrength,
  concreteStress,
  findConcrete,
  findSteel,
  steelStress,
  yieldStrain,
} from './materials';
import type { SteelGrade } from './materials';
import type { Check, SheetSection } from './beam';
import { gauss3 } from './quadrature';
import { Sheet, fix, num, worstStatus } from './steps';
import type { StepStatus } from './steps';

export interface ColumnBar {
  /** Position from the centre of the section, mm (x along the width b, y along the depth D). */
  x: number;
  y: number;
  diameter: number;
}

export interface ColumnInput {
  shape: 'rectangular' | 'circular';
  /** Width, mm (rectangular). */
  b: number;
  /** Depth, mm (rectangular) or diameter (circular). */
  D: number;
  /** Bars in each of the two faces parallel to the width, corners included (rectangular). */
  barsWidth: number;
  /** Extra bars in each of the two side faces, between the corners (rectangular). */
  barsDepth: number;
  /** Number of bars (circular). */
  barsRing: number;
  barDiameter: number;
  tieDiameter: number;
  /** Clear cover to the ties, mm. */
  cover: number;
  /** Unsupported length, m. */
  length: number;
  /** Effective length factors about the two axes. */
  kx: number;
  ky: number;
  concrete: string;
  steel: string;
  /** Factored axial load, kN (compression positive). */
  Pu: number;
  /** Factored moment about the major axis (bending across the depth D), kN·m. */
  Mux: number;
  /** Factored moment about the minor axis (bending across the width b), kN·m. */
  Muy: number;
}

export const DEFAULT_COLUMN: ColumnInput = {
  shape: 'rectangular',
  b: 300,
  D: 450,
  barsWidth: 3,
  barsDepth: 1,
  barsRing: 8,
  barDiameter: 20,
  tieDiameter: 8,
  cover: 40,
  length: 3.2,
  kx: 1,
  ky: 1,
  concrete: 'M25',
  steel: 'Fe415',
  Pu: 1200,
  Mux: 120,
  Muy: 40,
};

/** Positions of the longitudinal bars for the layout described by the input. */
export function columnBars(input: ColumnInput): ColumnBar[] {
  const edge = input.cover + input.tieDiameter + input.barDiameter / 2;
  const bars: ColumnBar[] = [];
  if (input.shape === 'circular') {
    const r = input.D / 2 - edge;
    const n = Math.max(1, Math.round(input.barsRing));
    for (let k = 0; k < n; k++) {
      const angle = (2 * Math.PI * k) / n + Math.PI / 2;
      bars.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), diameter: input.barDiameter });
    }
    return bars;
  }
  const hx = input.b / 2 - edge;
  const hy = input.D / 2 - edge;
  const nx = Math.max(2, Math.round(input.barsWidth));
  const ny = Math.max(0, Math.round(input.barsDepth));
  for (let k = 0; k < nx; k++) {
    const x = -hx + (2 * hx * k) / (nx - 1);
    bars.push({ x, y: hy, diameter: input.barDiameter });
    bars.push({ x, y: -hy, diameter: input.barDiameter });
  }
  for (let k = 1; k <= ny; k++) {
    const y = -hy + (2 * hy * k) / (ny + 1);
    bars.push({ x: -hx, y, diameter: input.barDiameter });
    bars.push({ x: hx, y, diameter: input.barDiameter });
  }
  return bars;
}

/** The section reduced to what bending about one axis needs. */
export interface BendingSection {
  /** Depth in the plane of bending, mm. */
  h: number;
  /** Width of the section at distance t from the compressed edge, mm. */
  width: (t: number) => number;
  /** Bars as [distance from the compressed edge, area]. */
  bars: Array<[number, number]>;
  fck: number;
  steel: SteelGrade;
  /** Gross area, mm². */
  area: number;
}

export type Axis = 'x' | 'y';

/** Builds the section for bending about the x axis (across D) or the y axis (across b). */
export function bendingSection(input: ColumnInput, axis: Axis): BendingSection {
  const fck = findConcrete(input.concrete).fck;
  const steel = findSteel(input.steel);
  const bars = columnBars(input);
  if (input.shape === 'circular') {
    const r = input.D / 2;
    return {
      h: input.D,
      width: (t) => 2 * Math.sqrt(Math.max(0, r * r - (r - t) * (r - t))),
      bars: bars.map((bar) => [r - (axis === 'x' ? bar.y : bar.x), barArea(bar.diameter)]),
      fck,
      steel,
      area: Math.PI * r * r,
    };
  }
  const h = axis === 'x' ? input.D : input.b;
  const w = axis === 'x' ? input.b : input.D;
  return {
    h,
    width: () => w,
    bars: bars.map((bar) => [h / 2 - (axis === 'x' ? bar.y : bar.x), barArea(bar.diameter)]),
    fck,
    steel,
    area: input.b * input.D,
  };
}

/**
 * Strain at the most compressed fibre for a neutral axis depth xu (cl. 39.1): 0.0035 while the
 * neutral axis is inside the section; beyond it, 0.0035 minus 0.75 times the strain at the least
 * compressed fibre, which pivots the profile about 0.002 at 3h/7.
 */
export function extremeStrain(xu: number, h: number): number {
  return xu <= h ? EPS_CU : EPS_CU / (1 + (0.75 * (xu - h)) / xu);
}

/** Axial force (kN) and moment about the centroid (kN·m) for a neutral axis depth xu (mm). */
export function sectionForces(section: BendingSection, xu: number): { P: number; M: number } {
  const { h, fck, steel } = section;
  const top = extremeStrain(xu, h);
  const strainAt = (t: number) => (top * (xu - t)) / xu;
  const end = Math.min(xu, h);
  // Depth at which the strain falls to 0.002: the stress block is rectangular above it.
  const knee = Math.min(end, Math.max(0, xu * (1 - EPS_C0 / top)));
  let P = 0;
  let M = 0;
  const integrate = (from: number, to: number) => {
    if (to - from <= 0) return;
    const parts = 12;
    for (let k = 0; k < parts; k++) {
      const a = from + ((to - from) * k) / parts;
      const b = from + ((to - from) * (k + 1)) / parts;
      P += gauss3((t) => concreteStress(strainAt(t), fck) * section.width(t), a, b);
      M += gauss3((t) => concreteStress(strainAt(t), fck) * section.width(t) * (h / 2 - t), a, b);
    }
  };
  integrate(0, knee);
  integrate(knee, end);
  for (const [t, area] of section.bars) {
    const strain = strainAt(t);
    // Bars in the compression zone displace concrete that has already been counted.
    const stress = steelStress(strain, steel) - (t < end ? concreteStress(strain, fck) : 0);
    P += stress * area;
    M += stress * area * (h / 2 - t);
  }
  return { P: P / 1e3, M: M / 1e6 };
}

export interface InteractionPoint {
  /** Neutral axis depth as a fraction of the section depth. */
  k: number;
  P: number;
  M: number;
}

/** Points of the P–M interaction diagram, from pure compression down to pure tension. */
export function interactionCurve(section: BendingSection): InteractionPoint[] {
  const ks: number[] = [1e6, 20, 8, 4, 2.5, 1.8, 1.4, 1.2, 1.1];
  for (let k = 1.0; k >= 0.0499; k -= 0.025) ks.push(Number(k.toFixed(4)));
  ks.push(0.03, 0.015);
  const points = ks.map((k) => ({ k, ...sectionForces(section, k * section.h) }));
  const steelArea = section.bars.reduce((sum, [, a]) => sum + a, 0);
  points.push({ k: 0, P: (-0.87 * section.steel.fy * steelArea) / 1e3, M: 0 });
  // Pure compression has no moment for a symmetric section; clear round-off.
  points[0] = { ...points[0], M: Math.abs(points[0].M) < 1e-3 ? 0 : points[0].M };
  return points;
}

/** Largest axial load the section can carry (uniform strain of 0.002), kN. */
export function squashLoad(section: BendingSection): number {
  return sectionForces(section, 1e6 * section.h).P;
}

/**
 * Moment capacity (kN·m) at a given axial load (kN), found by solving for the neutral axis depth
 * that gives that load. Returns 0 when the load is outside what the section can carry.
 */
export function momentCapacity(section: BendingSection, Pu: number): { M: number; xu: number } {
  const hi = 1e6 * section.h;
  const lo = 1e-4 * section.h;
  if (Pu >= sectionForces(section, hi).P || Pu <= sectionForces(section, lo).P) {
    return { M: 0, xu: Pu > 0 ? hi : 0 };
  }
  // P increases monotonically with xu; bisect on log(xu) because the range is very wide.
  let a = Math.log(lo);
  let b = Math.log(hi);
  for (let i = 0; i < 90; i++) {
    const mid = (a + b) / 2;
    if (sectionForces(section, Math.exp(mid)).P < Pu) a = mid;
    else b = mid;
  }
  const xu = Math.exp((a + b) / 2);
  return { M: sectionForces(section, xu).M, xu };
}

/** Axial load at balanced failure: the outermost tension bar just reaches its yield strain. */
export function balancedLoad(section: BendingSection): number {
  const depth = Math.max(...section.bars.map(([t]) => t));
  const xu = (EPS_CU * depth) / (EPS_CU + yieldStrain(section.steel));
  return sectionForces(section, xu).P;
}

/** Exponent αn of the biaxial interaction equation, cl. 39.6. */
export function biaxialExponent(ratio: number): number {
  if (ratio <= 0.2) return 1;
  if (ratio >= 0.8) return 2;
  return 1 + (ratio - 0.2) / 0.6;
}

export interface ColumnDesign {
  input: ColumnInput;
  fck: number;
  fy: number;
  bars: ColumnBar[];
  /** Gross area, steel area (mm²) and steel percentage. */
  Ag: number;
  Asc: number;
  percent: number;
  /** Slenderness ratios lex/D and ley/b. */
  slenderX: number;
  slenderY: number;
  slender: boolean;
  /** Minimum eccentricities, mm. */
  eMinX: number;
  eMinY: number;
  /** Design moments after minimum eccentricity and slenderness, kN·m. */
  MuxDesign: number;
  MuyDesign: number;
  /** Uniaxial capacities at Pu, kN·m. */
  Mux1: number;
  Muy1: number;
  Puz: number;
  alpha: number;
  /** Value of the interaction expression (≤ 1 is safe). */
  utilisation: number;
  tie: { diameter: number; pitch: number };
  curveX: InteractionPoint[];
  curveY: InteractionPoint[];
  sections: SheetSection[];
  checks: Check[];
  status: StepStatus;
}

/** Checks a column section under axial load and biaxial bending. */
export function designColumn(input: ColumnInput): ColumnDesign {
  const concrete = findConcrete(input.concrete);
  const steel = findSteel(input.steel);
  const fck = concrete.fck;
  const fy = steel.fy;
  const circular = input.shape === 'circular';
  const D = input.D;
  const b = circular ? input.D : input.b;
  const bars = columnBars(input);
  const sx = bendingSection(input, 'x');
  const sy = bendingSection(input, 'y');
  const Ag = sx.area;
  const Asc = bars.reduce((sum, bar) => sum + barArea(bar.diameter), 0);
  const percent = (100 * Asc) / Ag;
  const Ac = Ag - Asc;
  const { Pu } = input;
  const checks: Check[] = [];

  // ---- Section and reinforcement ----
  const geometry = new Sheet();
  geometry.add({
    title: 'Section',
    lines: [
      circular
        ? `Circular, D = ${num(D)} mm: Ag = π D² / 4`
        : `Rectangular, b × D = ${num(b)} × ${num(D)} mm: Ag = b D`,
    ],
    output: `Ag = ${num(Ag)} mm²`,
  });
  const percentOk = percent >= 0.8 && percent <= 6;
  geometry.add({
    ref: 'Cl. 26.5.3.1',
    title: 'Longitudinal reinforcement',
    lines: [
      `${bars.length} bars of ${input.barDiameter} mm: Asc = ${num(Asc)} mm²`,
      `p = 100 Asc / Ag = ${fix(percent, 2)} % (limits 0.8 % to 6 %; 4 % is the practical maximum at laps)`,
    ],
    output: `p = ${fix(percent, 2)} %`,
    status: !percentOk ? 'fail' : percent > 4 ? 'warn' : 'ok',
  });
  const minBars = circular ? 6 : 4;
  const barsOk = bars.length >= minBars && input.barDiameter >= 12;
  geometry.add({
    ref: 'Cl. 26.5.3.1 (c), (d)',
    title: 'Number and size of bars',
    lines: [
      `At least ${minBars} bars in a ${circular ? 'circular' : 'rectangular'} column, none smaller than 12 mm`,
    ],
    output: barsOk ? 'Satisfied' : 'Not satisfied',
    status: barsOk ? 'ok' : 'fail',
  });
  checks.push({
    name: 'Steel limits',
    status: !percentOk || !barsOk ? 'fail' : percent > 4 ? 'warn' : 'ok',
    detail: `${fix(percent, 2)} % steel, ${bars.length} bars of ${input.barDiameter} mm`,
  });

  // ---- Slenderness and eccentricity ----
  const slender = new Sheet();
  const lex = input.kx * input.length * 1000;
  const ley = input.ky * input.length * 1000;
  const slenderX = lex / D;
  const slenderY = ley / b;
  const isSlender = slenderX >= 12 || slenderY >= 12;
  slender.add({
    ref: 'Cl. 25.1.2',
    title: 'Slenderness ratios',
    lines: [
      `lex / D = ${num(lex)} / ${num(D)} = ${fix(slenderX, 1)}`,
      `ley / b = ${num(ley)} / ${num(b)} = ${fix(slenderY, 1)}`,
    ],
    output: isSlender ? 'Slender column (a ratio ≥ 12)' : 'Short column (both < 12)',
    status: isSlender ? 'warn' : 'ok',
  });
  const limitOk = input.length * 1000 <= 60 * Math.min(b, D);
  if (!limitOk) {
    slender.add({
      ref: 'Cl. 25.3.1',
      title: 'Limit on unsupported length',
      lines: [`Unsupported length must not exceed 60 times the least lateral dimension`],
      output: 'Exceeded',
      status: 'fail',
    });
  }
  const eMinX = Math.max(20, (input.length * 1000) / 500 + D / 30);
  const eMinY = Math.max(20, (input.length * 1000) / 500 + b / 30);
  slender.add({
    ref: 'Cl. 25.4',
    title: 'Minimum eccentricity',
    lines: [
      `ex,min = l / 500 + D / 30 = ${num(input.length * 1000)} / 500 + ${num(D)} / 30 = ${fix((input.length * 1000) / 500 + D / 30, 1)} mm (≥ 20 mm)`,
      `ey,min = l / 500 + b / 30 = ${fix((input.length * 1000) / 500 + b / 30, 1)} mm (≥ 20 mm)`,
    ],
    output: `ex,min = ${fix(eMinX, 1)} mm, ey,min = ${fix(eMinY, 1)} mm`,
  });

  const Puz = (0.45 * fck * Ac + 0.75 * fy * Asc) / 1e3;
  let addX = 0;
  let addY = 0;
  if (isSlender) {
    const kFactor = (section: typeof sx) => {
      const Pb = balancedLoad(section);
      return Math.min(1, Math.max(0, (Puz - Pu) / (Puz - Pb)));
    };
    const rawX = slenderX >= 12 ? (Pu * (D / 1000) * slenderX * slenderX) / 2000 : 0;
    const rawY = slenderY >= 12 ? (Pu * (b / 1000) * slenderY * slenderY) / 2000 : 0;
    const kx = kFactor(sx);
    const ky = kFactor(sy);
    addX = rawX * kx;
    addY = rawY * ky;
    slender.add({
      ref: 'Cl. 39.7.1',
      title: 'Additional moments from slenderness',
      lines: [
        `Max = Pu D (lex / D)² / 2000 = ${num(rawX)} kN·m`,
        `May = Pu b (ley / b)² / 2000 = ${num(rawY)} kN·m`,
      ],
      output: `Max = ${num(rawX)}, May = ${num(rawY)} kN·m`,
    });
    slender.add({
      ref: 'Cl. 39.7.1.1',
      title: 'Reduction of the additional moments',
      lines: [
        `k = (Puz − Pu) / (Puz − Pb) ≤ 1, with Puz = ${num(Puz)} kN`,
        `kx = ${fix(kx, 2)}, ky = ${fix(ky, 2)}`,
      ],
      output: `k Max = ${num(addX)}, k May = ${num(addY)} kN·m`,
    });
  }

  // Minimum eccentricity need only be exceeded about one axis at a time (cl. 25.4): take the
  // more severe of the two cases.
  const baseX = Math.abs(input.Mux) + addX;
  const baseY = Math.abs(input.Muy) + addY;
  const minX = (Pu * eMinX) / 1000;
  const minY = (Pu * eMinY) / 1000;

  const Mux1 = momentCapacity(sx, Pu).M;
  const Muy1 = momentCapacity(sy, Pu).M;
  const ratio = Puz > 0 ? Pu / Puz : 0;
  const alpha = biaxialExponent(ratio);
  const interaction = (mx: number, my: number) =>
    Mux1 > 0 && Muy1 > 0 ? (mx / Mux1) ** alpha + (my / Muy1) ** alpha : Infinity;
  const cases: Array<[number, number]> = [
    [Math.max(baseX, minX), baseY],
    [baseX, Math.max(baseY, minY)],
  ];
  const worst = interaction(...cases[0]) >= interaction(...cases[1]) ? cases[0] : cases[1];
  const [MuxDesign, MuyDesign] = worst;
  const utilisation = interaction(MuxDesign, MuyDesign);
  slender.add({
    title: 'Design moments',
    lines: [
      `About x: applied ${num(Math.abs(input.Mux))}${isSlender ? ` + ${num(addX)}` : ''} kN·m; minimum Pu ex,min = ${num(minX)} kN·m`,
      `About y: applied ${num(Math.abs(input.Muy))}${isSlender ? ` + ${num(addY)}` : ''} kN·m; minimum Pu ey,min = ${num(minY)} kN·m`,
      `Minimum eccentricity is applied about one axis at a time; the more severe case governs`,
    ],
    output: `Mux = ${num(MuxDesign)}, Muy = ${num(MuyDesign)} kN·m`,
  });

  // ---- Strength ----
  const strength = new Sheet();
  const axialOk = Pu < squashLoad(sx) && Mux1 > 0 && Muy1 > 0;
  strength.add({
    ref: 'Cl. 39.6',
    title: 'Axial capacity of the section',
    lines: [
      `Puz = 0.45 fck Ac + 0.75 fy Asc`,
      `= 0.45 × ${fck} × ${num(Ac)} + 0.75 × ${fy} × ${num(Asc)}`,
    ],
    output: `Puz = ${num(Puz)} kN`,
    status: Pu <= Puz ? 'ok' : 'fail',
  });
  strength.add({
    ref: 'Cl. 39.5, 38.1',
    title: 'Uniaxial moment capacities at Pu',
    lines: [
      `From strain compatibility across the section at Pu = ${num(Pu)} kN`,
      `(points on the interaction diagrams about each axis)`,
    ],
    output: `Mux1 = ${num(Mux1)}, Muy1 = ${num(Muy1)} kN·m`,
    status: axialOk ? 'ok' : 'fail',
  });
  const biaxial = MuxDesign > 1e-9 && MuyDesign > 1e-9;
  if (biaxial) {
    strength.add({
      ref: 'Cl. 39.6',
      title: 'Exponent of the interaction equation',
      lines: [
        `Pu / Puz = ${num(Pu)} / ${num(Puz)} = ${fix(ratio, 3)}`,
        `αn = 1.0 for Pu/Puz ≤ 0.2, 2.0 for ≥ 0.8, linear in between`,
      ],
      output: `αn = ${fix(alpha, 2)}`,
    });
  }
  const safe = axialOk && utilisation <= 1 + 1e-9;
  strength.check(
    biaxial ? 'Cl. 39.6' : 'Cl. 39.5',
    biaxial ? 'Biaxial bending check' : 'Uniaxial bending check',
    biaxial
      ? [
          `(Mux / Mux1)^αn + (Muy / Muy1)^αn ≤ 1.0`,
          `(${num(MuxDesign)} / ${num(Mux1)})^${fix(alpha, 2)} + (${num(MuyDesign)} / ${num(Muy1)})^${fix(alpha, 2)} = ${fix(utilisation, 2)}`,
        ]
      : [
          MuxDesign > 1e-9
            ? `Mux / Mux1 = ${num(MuxDesign)} / ${num(Mux1)} = ${fix(utilisation, 2)}`
            : `Muy / Muy1 = ${num(MuyDesign)} / ${num(Muy1)} = ${fix(utilisation, 2)}`,
        ],
    safe,
    safe ? `Safe (${fix(utilisation, 2)} ≤ 1.0)` : `Unsafe (${fix(utilisation, 2)} > 1.0)`,
  );
  checks.push({
    name: 'Strength',
    status: safe ? 'ok' : 'fail',
    detail: Number.isFinite(utilisation)
      ? `Interaction value ${fix(utilisation, 2)} (limit 1.0)`
      : 'Axial load exceeds the capacity of the section',
  });
  checks.push({
    name: 'Slenderness',
    status: !limitOk ? 'fail' : isSlender ? 'warn' : 'ok',
    detail: `lex/D = ${fix(slenderX, 1)}, ley/b = ${fix(slenderY, 1)}${isSlender ? ' — slender, additional moments included' : ''}`,
  });

  // ---- Ties ----
  const ties = new Sheet();
  const tieMin = Math.max(6, input.barDiameter / 4);
  const pitch = Math.floor(Math.min(Math.min(b, D), 16 * input.barDiameter, 300) / 5) * 5;
  const tieOk = input.tieDiameter >= tieMin;
  ties.add({
    ref: 'Cl. 26.5.3.2 (c)',
    title: 'Lateral ties',
    lines: [
      `Diameter ≥ larger of 6 mm and φ / 4 = ${num(tieMin)} mm`,
      `Pitch ≤ least of: least lateral dimension ${num(Math.min(b, D))} mm, 16 φ = ${num(16 * input.barDiameter)} mm, 300 mm`,
    ],
    output: `${input.tieDiameter} mm ties @ ${pitch} mm c/c`,
    status: tieOk ? 'ok' : 'fail',
  });
  checks.push({
    name: 'Ties',
    status: tieOk ? 'ok' : 'fail',
    detail: `${input.tieDiameter} mm @ ${pitch} mm c/c`,
  });

  const sections: SheetSection[] = [
    { title: 'Section and reinforcement', steps: geometry.steps },
    { title: 'Slenderness and eccentricity', steps: slender.steps },
    { title: 'Strength', steps: strength.steps },
    { title: 'Lateral ties', steps: ties.steps },
  ];
  return {
    input,
    fck,
    fy,
    bars,
    Ag,
    Asc,
    percent,
    slenderX,
    slenderY,
    slender: isSlender,
    eMinX,
    eMinY,
    MuxDesign,
    MuyDesign,
    Mux1,
    Muy1,
    Puz,
    alpha,
    utilisation,
    tie: { diameter: input.tieDiameter, pitch },
    curveX: interactionCurve(sx),
    curveY: interactionCurve(sy),
    sections,
    checks,
    status: worstStatus(checks.map((c) => ({ title: c.name, lines: [], status: c.status }))),
  };
}

/** Axial capacity of a short column with minimum eccentricity ≤ 0.05 D, cl. 39.3, kN. */
export function shortColumnCapacity(fck: number, fy: number, Ag: number, Asc: number): number {
  return (0.4 * fck * (Ag - Asc) + 0.67 * fy * Asc) / 1e3;
}

/** Exposed for tests and the theory notes: stress block resultant for a rectangle, per fck·b·xu. */
export function blockCoefficients(): { area: number; centroid: number } {
  const peak = concreteDesignStrength(1);
  // Parabola over the first 4/7 of the depth, rectangle over the remaining 3/7.
  return { area: peak * (1 - 4 / 21), centroid: 99 / 238 };
}
