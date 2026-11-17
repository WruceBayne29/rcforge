/**
 * Isolated pad footings under an axially loaded column, IS 456:2000 cl. 34 and cl. 31.6.
 * Units: mm, kN, kN/m², kN·m, MPa.
 */
import { developmentLength } from './anchorage';
import type { Check, SheetSection } from './beam';
import { designRectangular } from './flexure';
import { barArea, findConcrete, findSteel } from './materials';
import { shearStrengthConcrete } from './shear';
import { Sheet, fix, num, worstStatus } from './steps';
import type { StepStatus } from './steps';

export interface FootingInput {
  /** Column dimensions, mm: cx along the footing length L, cy along the width B. */
  cx: number;
  cy: number;
  /** Characteristic (service) axial load from the column, kN. */
  P: number;
  /** Safe bearing capacity of the soil, kN/m². */
  bearing: number;
  /** Square footing, or rectangular with equal projections beyond the column. */
  shape: 'square' | 'rectangular';
  /** Overall depth, mm; 0 lets the program find the smallest depth that works. */
  D: number;
  /** Clear cover to the bottom bars, mm. */
  cover: number;
  barDiameter: number;
  concrete: string;
  steel: string;
}

export const DEFAULT_FOOTING: FootingInput = {
  cx: 400,
  cy: 400,
  P: 900,
  bearing: 200,
  shape: 'square',
  D: 0,
  cover: 50,
  barDiameter: 12,
  concrete: 'M25',
  steel: 'Fe415',
};

export interface FootingSteel {
  /** Direction the bars run in. */
  direction: 'L' | 'B';
  /** Design moment at the face of the column, kN·m. */
  Mu: number;
  /** Required steel across the full width, mm². */
  required: number;
  /** Number of bars and their spacing across the width. */
  count: number;
  spacing: number;
  provided: number;
}

export interface FootingDesign {
  input: FootingInput;
  fck: number;
  fy: number;
  /** Plan dimensions, mm. */
  L: number;
  B: number;
  /** Overall and effective depth, mm. */
  D: number;
  d: number;
  /** Factored column load, kN, and net upward pressure, kN/m². */
  Pu: number;
  qu: number;
  /** Gross service pressure including the assumed self-weight, kN/m². */
  pressure: number;
  steel: FootingSteel[];
  oneWay: { Vu: number; tauV: number; tauC: number };
  punching: { Vu: number; perimeter: number; tauV: number; allowable: number };
  developmentLength: number;
  sections: SheetSection[];
  checks: Check[];
  status: StepStatus;
}

const roundUp = (value: number, step: number) => Math.ceil(value / step - 1e-9) * step;

interface Trial {
  d: number;
  steel: FootingSteel[];
  oneWay: { Vu: number; tauV: number; tauC: number; ok: boolean };
  punching: {
    Vu: number;
    perimeter: number;
    tauV: number;
    allowable: number;
    ok: boolean;
    ks: number;
  };
  flexureOk: boolean;
}

/** Designs an isolated footing and returns the calculation sheet. */
export function designFooting(input: FootingInput): FootingDesign {
  const fck = findConcrete(input.concrete).fck;
  const steel = findSteel(input.steel);
  const fy = steel.fy;
  const { cx, cy, P, bearing, cover, barDiameter } = input;
  const checks: Check[] = [];

  // ---- Plan size ----
  const size = new Sheet();
  const areaRequired = (1.1 * P) / bearing; // m², with 10 % for the footing and backfill
  let L: number;
  let B: number;
  if (input.shape === 'square') {
    L = roundUp(Math.sqrt(areaRequired) * 1000, 50);
    B = L;
  } else {
    // Equal projections a beyond each face: (cx + 2a)(cy + 2a) = A.
    const sum = (cx + cy) / 1000;
    const a = (-sum + Math.sqrt(sum * sum - 4 * ((cx * cy) / 1e6 - areaRequired))) / 4;
    L = roundUp(cx + 2 * a * 1000, 50);
    B = roundUp(cy + 2 * a * 1000, 50);
  }
  const area = (L * B) / 1e6;
  const pressure = (1.1 * P) / area;
  size.add({
    ref: 'Cl. 34.1',
    title: 'Area of footing required',
    lines: [
      `Allow 10 % of the column load for the weight of the footing and backfill`,
      `A = 1.1 P / q = 1.1 × ${num(P)} / ${num(bearing)}`,
    ],
    output: `A = ${fix(areaRequired, 2)} m²`,
  });
  size.check(
    undefined,
    'Plan dimensions',
    [
      input.shape === 'square'
        ? `Square: side = √A = ${num(Math.sqrt(areaRequired) * 1000)} mm, rounded up to 50 mm`
        : `Rectangular with equal projections beyond the column faces, rounded up to 50 mm`,
      `Gross pressure = 1.1 P / (L B) = ${num(pressure)} kN/m² ≤ ${num(bearing)} kN/m²`,
    ],
    pressure <= bearing + 1e-9,
    `L × B = ${num(L)} × ${num(B)} mm`,
  );
  const Pu = 1.5 * P;
  const qu = Pu / area;
  size.add({
    ref: 'Table 18',
    title: 'Net upward design pressure',
    lines: [`Pu = 1.5 P = ${num(Pu)} kN; qu = Pu / (L B) = ${num(Pu)} / ${fix(area, 2)}`],
    output: `qu = ${num(qu)} kN/m²`,
  });
  checks.push({
    name: 'Bearing pressure',
    status: pressure <= bearing + 1e-9 ? 'ok' : 'fail',
    detail: `${num(pressure)} kN/m² against ${num(bearing)} kN/m² allowed`,
  });

  // ---- Depth: smallest that satisfies shear, or the depth given ----
  const projL = (L - cx) / 2;
  const projB = (B - cy) / 2;
  const trial = (D: number): Trial => {
    // The two layers of bars cross; use the mean effective depth.
    const d = D - cover - barDiameter;
    const bars: FootingSteel[] = [];
    let flexureOk = true;
    const minimum = steel.deformed ? 0.0012 : 0.0015;
    for (const [direction, proj, width] of [
      ['L', projL, B],
      ['B', projB, L],
    ] as const) {
      const Mu = (qu * (width / 1000) * (proj / 1000) ** 2) / 2;
      const design = designRectangular({ b: width, d, dc: 0, fck, steel }, Mu);
      if (design.kind !== 'singly') flexureOk = false;
      const required = Math.max(design.Ast, minimum * width * D);
      const count = Math.max(2, Math.ceil(required / barArea(barDiameter) - 1e-9));
      const spacing = (width - 2 * cover - barDiameter) / (count - 1);
      bars.push({
        direction,
        Mu,
        required,
        count,
        spacing,
        provided: count * barArea(barDiameter),
      });
    }
    // One-way shear at d from the column face, across the full width (critical in the longer projection).
    const long = projL >= projB;
    const proj = long ? projL : projB;
    const width = long ? B : L;
    const pt = (100 * bars[long ? 0 : 1].provided) / (width * d);
    const V1 = Math.max(0, (qu * (width / 1000) * (proj - d)) / 1000);
    const tauV1 = (V1 * 1000) / (width * d);
    const tauC = shearStrengthConcrete(fck, pt);
    // Punching shear at d/2 from the column faces.
    const perimeter = 2 * (cx + d + (cy + d));
    const V2 = qu * (area - ((cx + d) * (cy + d)) / 1e6);
    const tauV2 = (V2 * 1000) / (perimeter * d);
    const ks = Math.min(1, 0.5 + Math.min(cx, cy) / Math.max(cx, cy));
    const allowable = ks * 0.25 * Math.sqrt(fck);
    return {
      d,
      steel: bars,
      oneWay: { Vu: V1, tauV: tauV1, tauC, ok: tauV1 <= tauC + 1e-9 },
      punching: { Vu: V2, perimeter, tauV: tauV2, allowable, ok: tauV2 <= allowable + 1e-9, ks },
      flexureOk,
    };
  };
  let D = input.D;
  if (!(D > 0)) {
    D = 300;
    while (D < 2000) {
      const t = trial(D);
      if (t.oneWay.ok && t.punching.ok && t.flexureOk) break;
      D += 25;
    }
  }
  const t = trial(D);
  const d = t.d;

  const depth = new Sheet();
  depth.add({
    title: 'Depth of footing',
    lines: [
      input.D > 0
        ? `Depth given: D = ${num(D)} mm`
        : `Smallest depth (in 25 mm steps) that satisfies both shear checks`,
      `d = D − cover − bar diameter = ${num(D)} − ${num(cover)} − ${num(barDiameter)} (mean of the two layers)`,
    ],
    output: `D = ${num(D)} mm, d = ${num(d)} mm`,
  });
  depth.check(
    'Cl. 34.2.4.1 (a), Table 19',
    'One-way shear at d from the column face',
    [
      `Vu = qu × width × (projection − d) = ${num(t.oneWay.Vu)} kN`,
      `τv = ${fix(t.oneWay.tauV, 2)} MPa; τc = ${fix(t.oneWay.tauC, 2)} MPa`,
    ],
    t.oneWay.ok,
    t.oneWay.ok ? 'Satisfactory' : 'Increase the depth',
  );
  depth.check(
    'Cl. 31.6.3',
    'Punching shear at d/2 from the column faces',
    [
      `Critical perimeter b0 = 2 (cx + d + cy + d) = ${num(t.punching.perimeter)} mm`,
      `Vu = qu [L B − (cx + d)(cy + d)] = ${num(t.punching.Vu)} kN; τv = ${fix(t.punching.tauV, 2)} MPa`,
      `Allowable = ks × 0.25 √fck = ${fix(t.punching.ks, 2)} × 0.25 × √${fck} = ${fix(t.punching.allowable, 2)} MPa`,
    ],
    t.punching.ok,
    t.punching.ok ? 'Satisfactory' : 'Increase the depth',
  );
  checks.push({
    name: 'One-way shear',
    status: t.oneWay.ok ? 'ok' : 'fail',
    detail: `τv = ${fix(t.oneWay.tauV, 2)} MPa, τc = ${fix(t.oneWay.tauC, 2)} MPa`,
  });
  checks.push({
    name: 'Punching shear',
    status: t.punching.ok ? 'ok' : 'fail',
    detail: `τv = ${fix(t.punching.tauV, 2)} MPa, allowable ${fix(t.punching.allowable, 2)} MPa`,
  });

  // ---- Flexure ----
  const flexure = new Sheet();
  for (const s of t.steel) {
    const proj = s.direction === 'L' ? projL : projB;
    const width = s.direction === 'L' ? B : L;
    flexure.add({
      ref: 'Cl. 34.2.3.1, Annex G-1.1',
      title: `Bars parallel to ${s.direction === 'L' ? 'the length L' : 'the width B'}`,
      lines: [
        `Mu at the column face = qu × ${num(width / 1000)} × ${num(proj / 1000)}² / 2 = ${num(s.Mu)} kN·m`,
        `Ast = ${num(s.required)} mm² (not less than ${steel.deformed ? '0.12' : '0.15'} % of the gross section)`,
      ],
      output: `${s.count}–${barDiameter}φ @ ${num(s.spacing)} mm c/c (${num(s.provided)} mm²)`,
      status: t.flexureOk ? 'ok' : 'fail',
    });
  }
  if (input.shape === 'rectangular' && Math.abs(L - B) > 1e-9) {
    const beta = Math.max(L, B) / Math.min(L, B);
    flexure.add({
      ref: 'Cl. 34.3.1 (c)',
      title: 'Central band for the short bars',
      lines: [
        `Fraction of the short-direction steel within a band equal to the footing width:`,
        `2 / (β + 1) with β = ${fix(beta, 2)}`,
      ],
      output: `${fix(200 / (beta + 1), 0)} % in the central band`,
    });
  }
  checks.push({
    name: 'Flexure',
    status: t.flexureOk ? 'ok' : 'fail',
    detail: `Mu = ${num(Math.max(...t.steel.map((s) => s.Mu)))} kN·m at the column face`,
  });

  // ---- Anchorage and bearing ----
  const anchorage = new Sheet();
  const Ld = developmentLength(barDiameter, fck, steel);
  const available = Math.min(projL, projB) - cover;
  const anchorageOk = available >= Ld - 1e-9;
  anchorage.check(
    'Cl. 34.2.4.3, 26.2.1',
    'Development length of the bars',
    [
      `Ld = φ × 0.87 fy / (4 τbd) = ${num(Ld)} mm`,
      `Length available beyond the column face = ${num(Math.min(projL, projB))} − ${num(cover)} = ${num(available)} mm`,
    ],
    anchorageOk,
    anchorageOk ? 'Satisfactory' : 'Bend the bars up or use smaller bars',
  );
  const A1 = Math.min((cx + 4 * D) * (cy + 4 * D), L * B);
  const enhance = Math.min(2, Math.sqrt(A1 / (cx * cy)));
  const bearingStress = (Pu * 1000) / (cx * cy);
  const bearingAllow = 0.45 * fck * enhance;
  const bearingOk = bearingStress <= bearingAllow + 1e-9;
  anchorage.add({
    ref: 'Cl. 34.4',
    title: 'Bearing at the base of the column',
    lines: [
      `Bearing stress = Pu / (cx cy) = ${fix(bearingStress, 2)} MPa`,
      `Permissible = 0.45 fck √(A1 / A2) = 0.45 × ${fck} × ${fix(enhance, 2)} = ${fix(bearingAllow, 2)} MPa`,
    ],
    output: bearingOk ? 'Nominal dowels suffice' : 'Design dowels for the excess load',
    status: bearingOk ? 'ok' : 'warn',
  });
  checks.push({
    name: 'Anchorage',
    status: anchorageOk ? 'ok' : 'fail',
    detail: `Ld = ${num(Ld)} mm, ${num(available)} mm available`,
  });
  checks.push({
    name: 'Column bearing',
    status: bearingOk ? 'ok' : 'warn',
    detail: `${fix(bearingStress, 2)} MPa against ${fix(bearingAllow, 2)} MPa`,
  });

  return {
    input,
    fck,
    fy,
    L,
    B,
    D,
    d,
    Pu,
    qu,
    pressure,
    steel: t.steel,
    oneWay: t.oneWay,
    punching: t.punching,
    developmentLength: Ld,
    sections: [
      { title: 'Size of footing', steps: size.steps },
      { title: 'Depth and shear', steps: depth.steps },
      { title: 'Flexure', steps: flexure.steps },
      { title: 'Anchorage and bearing', steps: anchorage.steps },
    ],
    checks,
    status: worstStatus(checks.map((c) => ({ title: c.name, lines: [], status: c.status }))),
  };
}
