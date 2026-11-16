/**
 * Complete design of a beam section: loads, flexure, bar selection, shear, deflection and
 * anchorage, with the working laid out as a calculation sheet.
 * Units: mm, m (span), kN, kN·m, kN/m, MPa.
 */
import { developmentLength } from './anchorage';
import { chooseBars, maximumClearSpacing, minimumClearSpacing } from './detailing';
import type { BarChoice } from './detailing';
import {
  capacityRectangular,
  designFlanged,
  designRectangular,
  flangedCompression,
  maximumSteel,
  minimumTensionSteel,
} from './flexure';
import { BLOCK_AREA, barArea, designYield, findConcrete, findSteel, xuMaxRatio } from './materials';
import {
  BASIC_RATIO,
  compressionFactor,
  flangeFactor,
  longSpanFactor,
  serviceStress,
  tensionFactor,
} from './serviceability';
import type { SupportCondition } from './serviceability';
import { designShear } from './shear';
import type { ShearDesign } from './shear';
import { Sheet, fix, num, worstStatus } from './steps';
import type { Step, StepStatus } from './steps';

export type BeamLoading =
  | {
      kind: 'udl';
      /** Characteristic dead load excluding self-weight, kN/m. */
      dead: number;
      /** Characteristic imposed load, kN/m. */
      live: number;
      /** Add the self-weight of the beam (25 kN/m³) to the dead load. */
      selfWeight: boolean;
    }
  | {
      kind: 'forces';
      /** Factored design moment, kN·m. */
      Mu: number;
      /** Factored design shear, kN. */
      Vu: number;
    };

export interface BeamInput {
  shape: 'rectangular' | 'tee' | 'ell';
  /** Width of the web (or of a rectangular beam), mm. */
  b: number;
  /** Overall depth, mm. */
  D: number;
  /** Effective flange width, mm (flanged beams). */
  bf: number;
  /** Flange thickness, mm (flanged beams). */
  Df: number;
  /** Effective span, m. */
  span: number;
  support: SupportCondition;
  /** Clear cover to the stirrups, mm. */
  cover: number;
  concrete: string;
  steel: string;
  /** Main bar diameter, mm; 0 lets the program choose. */
  mainDiameter: number;
  stirrupDiameter: number;
  stirrupLegs: number;
  loading: BeamLoading;
}

export interface SheetSection {
  title: string;
  steps: Step[];
}

export interface Check {
  name: string;
  status: StepStatus;
  detail: string;
}

export interface BeamDesign {
  input: BeamInput;
  fck: number;
  fy: number;
  /** Factored design moment and shear. */
  Mu: number;
  Vu: number;
  /** Effective depth and depth to the compression steel, mm. */
  d: number;
  dc: number;
  doubly: boolean;
  /** Steel required by calculation and after applying the minimum, mm². */
  AstCalculated: number;
  AstRequired: number;
  AscRequired: number;
  tension: BarChoice;
  /** Compression bars (designed) or hanger bars (nominal). */
  top: BarChoice;
  topIsStructural: boolean;
  /** Moment of resistance with the bars provided, kN·m. */
  MuCapacity: number;
  xu: number;
  xuMax: number;
  shear: ShearDesign;
  deflection: {
    basic: number;
    allowable: number;
    actual: number;
    kt: number;
    kc: number;
    kf: number;
  };
  developmentLength: number;
  sections: SheetSection[];
  checks: Check[];
  status: StepStatus;
}

export const DEFAULT_BEAM: BeamInput = {
  shape: 'rectangular',
  b: 300,
  D: 500,
  bf: 1200,
  Df: 120,
  span: 6,
  support: 'simple',
  cover: 25,
  concrete: 'M25',
  steel: 'Fe415',
  mainDiameter: 0,
  stirrupDiameter: 8,
  stirrupLegs: 2,
  loading: { kind: 'udl', dead: 15, live: 10, selfWeight: true },
};

/** Centroid depth (from the tension face of the stirrup cage) of bars placed in layers. */
function layerCentroid(choice: BarChoice, perLayerGap: number): number {
  if (choice.layers <= 1) return choice.diameter / 2;
  const perLayer = Math.ceil(choice.count / choice.layers);
  let remaining = choice.count;
  let moment = 0;
  for (let layer = 0; layer < choice.layers; layer++) {
    const n = Math.min(perLayer, remaining);
    remaining -= n;
    moment += n * (choice.diameter / 2 + layer * (choice.diameter + perLayerGap));
  }
  return moment / choice.count;
}

function loads(input: BeamInput, sheet: Sheet): { Mu: number; Vu: number } {
  const { loading, span, support } = input;
  if (loading.kind === 'forces') {
    sheet.add({
      title: 'Design actions (given)',
      lines: [`Factored moment and shear entered directly`],
      output: `Mu = ${num(loading.Mu)} kN·m, Vu = ${num(loading.Vu)} kN`,
    });
    return { Mu: loading.Mu, Vu: loading.Vu };
  }
  const self = loading.selfWeight ? (25 * input.b * input.D) / 1e6 : 0;
  const dead = loading.dead + self;
  const wu = 1.5 * (dead + loading.live);
  if (loading.selfWeight) {
    sheet.add({
      ref: 'IS 875 (Part 1)',
      title: 'Self-weight of the beam',
      lines: [`25 kN/m³ × ${num(input.b / 1000)} m × ${num(input.D / 1000)} m`],
      output: `${num(self)} kN/m`,
    });
  }
  sheet.add({
    ref: 'Table 18',
    title: 'Factored load',
    lines: [`wu = 1.5 (DL + LL) = 1.5 × (${num(dead)} + ${num(loading.live)})`],
    output: `wu = ${num(wu)} kN/m`,
  });
  let Mu: number;
  let Vu: number;
  if (support === 'simple') {
    Mu = (wu * span * span) / 8;
    Vu = (wu * span) / 2;
    sheet.add({
      title: 'Design moment and shear — simply supported',
      lines: [
        `Mu = wu l² / 8 = ${num(wu)} × ${num(span)}² / 8`,
        `Vu = wu l / 2 = ${num(wu)} × ${num(span)} / 2`,
      ],
      output: `Mu = ${num(Mu)} kN·m, Vu = ${num(Vu)} kN`,
    });
  } else if (support === 'cantilever') {
    Mu = (wu * span * span) / 2;
    Vu = wu * span;
    sheet.add({
      title: 'Design moment and shear — cantilever',
      lines: [
        `Mu = wu l² / 2 = ${num(wu)} × ${num(span)}² / 2`,
        `Vu = wu l = ${num(wu)} × ${num(span)}`,
      ],
      output: `Mu = ${num(Mu)} kN·m, Vu = ${num(Vu)} kN`,
    });
  } else {
    const wd = 1.5 * dead;
    const wl = 1.5 * loading.live;
    Mu = (wd * span * span) / 10 + (wl * span * span) / 9;
    Vu = 0.6 * wu * span;
    sheet.add({
      ref: 'Tables 12, 13',
      title: 'Design moment and shear — continuous, at the first interior support',
      lines: [
        `Mu = wd l² / 10 + wl l² / 9 = ${num(wd)} × ${num(span)}² / 10 + ${num(wl)} × ${num(span)}² / 9`,
        `Vu = 0.6 wu l = 0.6 × ${num(wu)} × ${num(span)}`,
        `(hogging moment: the flange, if any, is in tension, so the web alone resists it)`,
      ],
      output: `Mu = ${num(Mu)} kN·m, Vu = ${num(Vu)} kN`,
    });
  }
  return { Mu, Vu };
}

/** Designs a beam and returns the results together with the full calculation sheet. */
export function designBeam(input: BeamInput): BeamDesign {
  const concrete = findConcrete(input.concrete);
  const steel = findSteel(input.steel);
  const fck = concrete.fck;
  const fy = steel.fy;
  const { b, D, cover, stirrupDiameter } = input;
  // A flange only helps in sagging; at a continuous support it is in tension.
  const flanged = input.shape !== 'rectangular' && input.support !== 'continuous';
  const clearWidth = b - 2 * (cover + stirrupDiameter);
  const checks: Check[] = [];

  const loadSheet = new Sheet();
  const { Mu, Vu } = loads(input, loadSheet);

  // Effective depth depends on the bars chosen, so iterate a few times.
  const assumed = input.mainDiameter || 20;
  let centroid = assumed / 2;
  let d = D - cover - stirrupDiameter - centroid;
  const topDiameterGuess = 12;
  let dc = cover + stirrupDiameter + topDiameterGuess / 2;
  let tension = chooseBars(1, clearWidth, { diameter: assumed });
  let AstCalculated = 0;
  let AscRequired = 0;
  let doubly = false;
  let flexureSteps: Step[] = [];
  let adequate = true;
  for (let pass = 0; pass < 4; pass++) {
    if (flanged) {
      const design = designFlanged({ bf: input.bf, bw: b, Df: input.Df, d, fck, steel }, Mu);
      AstCalculated = design.Ast;
      AscRequired = 0;
      doubly = false;
      adequate = design.adequate;
      flexureSteps = design.steps;
    } else {
      const design = designRectangular({ b, d, dc, fck, steel }, Mu);
      AstCalculated = design.Ast;
      AscRequired = design.Asc;
      doubly = design.kind === 'doubly';
      flexureSteps = design.steps;
    }
    const required = Math.max(AstCalculated, minimumTensionSteel(b, d, fy));
    const next = chooseBars(required, clearWidth, { diameter: input.mainDiameter || undefined });
    const nextCentroid = layerCentroid(next, minimumClearSpacing(next.diameter));
    const same = next.count === tension.count && next.diameter === tension.diameter;
    tension = next;
    centroid = nextCentroid;
    const nextD = D - cover - stirrupDiameter - centroid;
    if (same && Math.abs(nextD - d) < 1e-9) break;
    d = nextD;
  }
  const AstMin = minimumTensionSteel(b, d, fy);
  const AstMax = maximumSteel(b, D);
  const AstRequired = Math.max(AstCalculated, AstMin);

  const top = doubly
    ? chooseBars(AscRequired, clearWidth, {})
    : chooseBars(1, clearWidth, { diameter: 12 });
  dc = cover + stirrupDiameter + top.diameter / 2;

  // ---- Flexure sheet ----
  const flexure = new Sheet();
  flexure.add({
    title: 'Effective depth',
    lines: [
      `d = D − cover − stirrup − distance to the centroid of the bars`,
      `= ${num(D)} − ${num(cover)} − ${num(stirrupDiameter)} − ${num(centroid)}`,
    ],
    output: `d = ${num(d)} mm`,
  });
  flexure.steps.push(...flexureSteps);
  if (!adequate) {
    checks.push({
      name: 'Flexure',
      status: 'fail',
      detail: 'Moment exceeds the limiting capacity of the flanged section',
    });
  }
  flexure.add({
    ref: 'Cl. 26.5.1.1',
    title: 'Minimum and maximum tension steel',
    lines: [
      `Ast,min = 0.85 b d / fy = 0.85 × ${num(b)} × ${num(d)} / ${fy} = ${num(AstMin)} mm²`,
      `Ast,max = 0.04 b D = ${num(AstMax)} mm²`,
    ],
    output: `Ast required = ${num(AstRequired)} mm²`,
    status: AstRequired <= AstMax ? 'ok' : 'fail',
  });

  // ---- Reinforcement provided ----
  const bars = new Sheet();
  const gapMin = minimumClearSpacing(tension.diameter);
  const gapMax = maximumClearSpacing(fy);
  bars.add({
    title: 'Tension reinforcement provided',
    lines: [
      `${tension.count} bars of ${tension.diameter} mm = ${tension.count} × ${num(barArea(tension.diameter))}`,
      `${num(tension.area)} mm² ≥ ${num(AstRequired)} mm² required`,
    ],
    output: `${tension.count}–${tension.diameter}φ (${num(tension.area)} mm²)`,
    status: tension.area <= AstMax ? 'ok' : 'fail',
  });
  const spacingOk = tension.clearSpacing >= gapMin - 1e-9 && tension.clearSpacing <= gapMax + 1e-9;
  bars.add({
    ref: 'Cl. 26.3.2, 26.3.3',
    title: 'Clear spacing of the tension bars',
    lines: [
      `Width inside the stirrups = ${num(b)} − 2 (${num(cover)} + ${num(stirrupDiameter)}) = ${num(clearWidth)} mm`,
      `${tension.layers > 1 ? `${tension.layers} layers; ` : ''}clear distance = ${num(tension.clearSpacing)} mm`,
      `Limits: ≥ ${num(gapMin)} mm (bar size, aggregate + 5) and ≤ ${num(gapMax)} mm (Table 15)`,
    ],
    output: spacingOk ? 'Spacing is satisfactory' : 'Spacing outside the limits',
    status: spacingOk ? 'ok' : 'warn',
  });
  if (doubly) {
    bars.add({
      title: 'Compression reinforcement provided',
      lines: [
        `${top.count} bars of ${top.diameter} mm = ${num(top.area)} mm² ≥ ${num(AscRequired)} mm²`,
      ],
      output: `${top.count}–${top.diameter}φ (${num(top.area)} mm²)`,
      status: top.area <= AstMax ? 'ok' : 'fail',
    });
  } else {
    bars.add({
      title: 'Hanger bars',
      lines: [`Nominal bars at the top to hold the stirrups (not counted in the strength)`],
      output: `${top.count}–${top.diameter}φ`,
    });
  }
  if (D > 750) {
    const side = 0.001 * b * D;
    bars.add({
      ref: 'Cl. 26.5.1.3',
      title: 'Side face reinforcement',
      lines: [
        `Depth of web exceeds 750 mm: 0.1 % of the web area, half on each face, spacing ≤ 300 mm`,
        `= 0.001 × ${num(b)} × ${num(D)}`,
      ],
      output: `${num(side)} mm² in total`,
    });
  }

  // Capacity with the bars actually provided.
  let MuCapacity: number;
  let xu: number;
  const xuMax = xuMaxRatio(fy) * d;
  if (flanged) {
    const section = { bf: input.bf, bw: b, Df: input.Df, d, fck, steel };
    const force = designYield(fy) * tension.area;
    let lo = 1e-6;
    let hi = d;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (flangedCompression(section, mid).force < force) lo = mid;
      else hi = mid;
    }
    xu = Math.min((lo + hi) / 2, xuMax);
    MuCapacity = flangedCompression(section, xu).moment / 1e6;
  } else {
    const capacity = capacityRectangular(
      { b, d, dc, fck, steel },
      tension.area,
      doubly ? top.area : 0,
    );
    xu = Math.min(capacity.xu, xuMax);
    MuCapacity = capacity.Mu;
  }
  // Compare against the code formula the design used, so exactly-required steel is not rejected
  // by the 0.2 % mismatch between that formula and the stress block.
  const flexureOk =
    adequate && tension.area >= AstRequired - 1e-6 && (!doubly || top.area >= AscRequired - 1e-6);
  bars.add({
    ref: 'Annex G',
    title: 'Moment of resistance with the bars provided',
    lines: [
      `xu = ${num(xu)} mm (xu,max = ${num(xuMax)} mm)`,
      `Mu,provided = ${num(MuCapacity)} kN·m against Mu = ${num(Mu)} kN·m`,
    ],
    output: `Mu,provided = ${num(MuCapacity)} kN·m`,
    status: flexureOk ? 'ok' : 'fail',
  });
  if (adequate) {
    checks.push({
      name: 'Flexure',
      status: flexureOk ? 'ok' : 'fail',
      detail: `Mu = ${num(Mu)} kN·m, capacity ${num(MuCapacity)} kN·m`,
    });
  }
  checks.push({
    name: 'Steel limits',
    status: tension.area <= AstMax && (!doubly || top.area <= AstMax) ? 'ok' : 'fail',
    detail: `${fix((100 * tension.area) / (b * d), 2)} % tension steel (min ${fix((100 * AstMin) / (b * d), 2)} %, max 4 % of bD)`,
  });
  checks.push({
    name: 'Bar spacing',
    status: spacingOk ? 'ok' : 'warn',
    detail: `${num(tension.clearSpacing)} mm clear${tension.layers > 1 ? `, ${tension.layers} layers` : ''}`,
  });

  // ---- Shear ----
  const shear = designShear({
    b,
    d,
    fck,
    Vu,
    Ast: tension.area,
    fyStirrup: fy,
    stirrupDiameter,
    legs: input.stirrupLegs,
  });
  checks.push({
    name: 'Shear',
    status: shear.adequate ? 'ok' : 'fail',
    detail: `τv = ${fix(shear.tauV, 2)} MPa, τc = ${fix(shear.tauC, 2)} MPa, τc,max = ${fix(shear.tauCMax, 1)} MPa`,
  });

  // ---- Deflection ----
  const deflectionSheet = new Sheet();
  const widthForPt = flanged ? input.bf : b;
  const pt = (100 * tension.area) / (widthForPt * d);
  const pc = doubly ? (100 * top.area) / (widthForPt * d) : 0;
  const fs = serviceStress(fy, AstRequired, tension.area);
  const kt = tensionFactor(fs, pt);
  const kc = compressionFactor(pc);
  const kf = flanged ? flangeFactor(b, input.bf) : 1;
  const kl = longSpanFactor(input.support, input.span);
  const basic = BASIC_RATIO[input.support];
  const allowable = basic * kl * kt * kc * kf;
  const actual = (input.span * 1000) / d;
  const deflectionOk = actual <= allowable + 1e-9;
  deflectionSheet.add({
    ref: 'Cl. 23.2.1 (a)',
    title: 'Basic span / effective depth ratio',
    lines: [
      `${input.support === 'simple' ? 'Simply supported' : input.support === 'cantilever' ? 'Cantilever' : 'Continuous'}: ${basic}`,
      ...(kl < 1 ? [`Span over 10 m: multiply by 10 / span = ${fix(kl, 2)}`] : []),
    ],
    output: `Basic ratio = ${num(basic * kl)}`,
  });
  deflectionSheet.add({
    ref: 'Fig. 4',
    title: 'Modification factor for tension steel',
    lines: [
      `fs = 0.58 fy (Ast required / Ast provided) = 0.58 × ${fy} × ${num(AstRequired)} / ${num(tension.area)} = ${num(fs)} MPa`,
      `pt = 100 Ast / (${flanged ? 'bf' : 'b'} d) = ${fix(pt, 2)} %`,
    ],
    output: `kt = ${fix(kt, 2)}`,
  });
  if (doubly) {
    deflectionSheet.add({
      ref: 'Fig. 5',
      title: 'Modification factor for compression steel',
      lines: [`pc = ${fix(pc, 2)} %, kc = 1 + pc / (3 + pc)`],
      output: `kc = ${fix(kc, 2)}`,
    });
  }
  if (flanged) {
    deflectionSheet.add({
      ref: 'Fig. 6',
      title: 'Reduction factor for a flanged beam',
      lines: [`bw / bf = ${fix(b / input.bf, 2)}`],
      output: `kf = ${fix(kf, 2)}`,
    });
  }
  deflectionSheet.check(
    'Cl. 23.2.1',
    'Span / effective depth check',
    [
      `Allowable = ${num(basic * kl)} × ${fix(kt, 2)}${doubly ? ` × ${fix(kc, 2)}` : ''}${flanged ? ` × ${fix(kf, 2)}` : ''} = ${fix(allowable, 1)}`,
      `Actual = span / d = ${num(input.span * 1000)} / ${num(d)} = ${fix(actual, 1)}`,
    ],
    deflectionOk,
    deflectionOk ? 'Deflection is satisfactory' : 'Increase the depth',
  );
  checks.push({
    name: 'Deflection',
    status: deflectionOk ? 'ok' : 'fail',
    detail: `span/d = ${fix(actual, 1)}, allowable ${fix(allowable, 1)}`,
  });

  // ---- Anchorage ----
  const anchorage = new Sheet();
  const Ld = developmentLength(tension.diameter, fck, steel);
  anchorage.add({
    ref: 'Cl. 26.2.1',
    title: 'Development length of the main bars',
    lines: [
      `Ld = φ × 0.87 fy / (4 τbd)`,
      `= ${tension.diameter} × 0.87 × ${fy} / (4 × ${fix((tension.diameter * designYield(fy)) / (4 * Ld), 2)})`,
    ],
    output: `Ld = ${num(Ld)} mm (${fix(Ld / tension.diameter, 0)} φ)`,
  });

  const sections: SheetSection[] = [
    { title: 'Loads and design actions', steps: loadSheet.steps },
    { title: 'Flexure', steps: flexure.steps },
    { title: 'Reinforcement provided', steps: bars.steps },
    { title: 'Shear', steps: shear.steps },
    { title: 'Deflection', steps: deflectionSheet.steps },
    { title: 'Anchorage', steps: anchorage.steps },
  ];
  const status = worstStatus(checks.map((c) => ({ title: c.name, lines: [], status: c.status })));

  return {
    input,
    fck,
    fy,
    Mu,
    Vu,
    d,
    dc,
    doubly,
    AstCalculated,
    AstRequired,
    AscRequired,
    tension,
    top,
    topIsStructural: doubly,
    MuCapacity,
    xu,
    xuMax,
    shear,
    deflection: { basic, allowable, actual, kt, kc, kf },
    developmentLength: Ld,
    sections,
    checks,
    status,
  };
}

/** Neutral axis depth of a singly reinforced rectangular section with yielded steel, mm. */
export function neutralAxisDepth(Ast: number, b: number, fck: number, fy: number): number {
  return (designYield(fy) * Ast) / (BLOCK_AREA * fck * b);
}
