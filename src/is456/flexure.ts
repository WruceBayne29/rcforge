/**
 * Flexural design and analysis of beam sections to IS 456:2000, cl. 38 and Annex G.
 * Dimensions in mm, moments in kN·m, areas in mm², stresses in MPa.
 */
import {
  BLOCK_AREA,
  BLOCK_CENTROID,
  EPS_CU,
  concreteDesignStrength,
  concreteStress,
  designYield,
  steelStress,
  xuMaxRatio,
} from './materials';
import type { SteelGrade } from './materials';
import { Sheet, fix, num } from './steps';
import type { Step } from './steps';

const KNM = 1e6; // N·mm per kN·m

export interface RectangularSection {
  /** Width of the compression face, mm. */
  b: number;
  /** Effective depth to the tension steel, mm. */
  d: number;
  /** Depth to the compression steel from the compression face, mm. */
  dc: number;
  fck: number;
  steel: SteelGrade;
}

export interface LimitingValues {
  /** xu,max/d */
  ratio: number;
  /** Limiting neutral axis depth, mm. */
  xuMax: number;
  /** Limiting moment of resistance of the singly reinforced section, kN·m. */
  MuLim: number;
  /** Tension steel that makes the section balanced, mm². */
  AstLim: number;
  /** The same as a percentage of b·d. */
  ptLim: number;
  /** Mu,lim / (fck·b·d²): 0.148, 0.138, 0.133 for Fe250, Fe415, Fe500. */
  coefficient: number;
}

/** Limiting (balanced) values of a singly reinforced rectangular section, Annex G-1.1. */
export function limitingValues(b: number, d: number, fck: number, fy: number): LimitingValues {
  const ratio = xuMaxRatio(fy);
  const xuMax = ratio * d;
  const coefficient = BLOCK_AREA * ratio * (1 - BLOCK_CENTROID * ratio);
  const MuLim = (coefficient * fck * b * d * d) / KNM;
  const AstLim = (BLOCK_AREA * fck * b * xuMax) / designYield(fy);
  return { ratio, xuMax, MuLim, AstLim, ptLim: (100 * AstLim) / (b * d), coefficient };
}

export interface FlexureDesign {
  kind: 'singly' | 'doubly';
  limits: LimitingValues;
  /** Neutral axis depth at the design moment, mm. */
  xu: number;
  /** Required tension steel, mm². */
  Ast: number;
  /** Required compression steel, mm² (0 for a singly reinforced section). */
  Asc: number;
  /** Stress in the compression steel, MPa (0 if none). */
  fsc: number;
  steps: Step[];
}

/**
 * Required reinforcement for a design moment Mu (kN·m) on a rectangular section. If Mu exceeds
 * the limiting moment the section is designed as doubly reinforced (Annex G-1.2).
 */
export function designRectangular(section: RectangularSection, Mu: number): FlexureDesign {
  const { b, d, dc, fck, steel } = section;
  const fy = steel.fy;
  const limits = limitingValues(b, d, fck, fy);
  const sheet = new Sheet();
  sheet.add({
    ref: 'Cl. 38.1',
    title: 'Limiting depth of neutral axis',
    lines: [`xu,max = ${fix(limits.ratio, 2)} d = ${fix(limits.ratio, 2)} × ${num(d)}`],
    output: `xu,max = ${num(limits.xuMax)} mm`,
  });
  sheet.add({
    ref: 'Annex G-1.1',
    title: 'Limiting moment of resistance',
    lines: [
      `Mu,lim = 0.36 fck b xu,max (d − 0.42 xu,max)`,
      `= ${fix(limits.coefficient, 3)} fck b d² = ${fix(limits.coefficient, 3)} × ${fck} × ${num(b)} × ${num(d)}²`,
    ],
    output: `Mu,lim = ${num(limits.MuLim)} kN·m`,
  });

  if (Mu <= limits.MuLim + 1e-9) {
    const k = (4.6 * Mu * KNM) / (fck * b * d * d);
    const Ast = ((0.5 * fck) / fy) * (1 - Math.sqrt(Math.max(0, 1 - k))) * b * d;
    const xu = (designYield(fy) * Ast) / (BLOCK_AREA * fck * b);
    sheet.add({
      title: 'Type of section',
      lines: [`Mu = ${num(Mu)} kN·m ≤ Mu,lim = ${num(limits.MuLim)} kN·m`],
      output: 'Singly reinforced',
      status: 'ok',
    });
    sheet.add({
      ref: 'Annex G-1.1 (b)',
      title: 'Tension reinforcement',
      lines: [
        `Mu = 0.87 fy Ast d (1 − Ast fy / (b d fck))`,
        `Ast = (0.5 fck / fy) [1 − √(1 − 4.6 Mu / (fck b d²))] b d`,
        `= (0.5 × ${fck} / ${fy}) [1 − √(1 − ${fix(k, 4)})] × ${num(b)} × ${num(d)}`,
      ],
      output: `Ast = ${num(Ast)} mm²`,
    });
    sheet.add({
      ref: 'Annex G-1.1 (a)',
      title: 'Depth of neutral axis',
      lines: [
        `xu = 0.87 fy Ast / (0.36 fck b) = 0.87 × ${fy} × ${num(Ast)} / (0.36 × ${fck} × ${num(b)})`,
        `xu / d = ${fix(xu / d, 3)} ≤ ${fix(limits.ratio, 2)}`,
      ],
      output: `xu = ${num(xu)} mm`,
      status: 'ok',
    });
    return { kind: 'singly', limits, xu, Ast, Asc: 0, fsc: 0, steps: sheet.steps };
  }

  // Doubly reinforced: the concrete carries Mu,lim, a steel couple carries the rest.
  const Mu2 = Mu - limits.MuLim;
  const strain = EPS_CU * (1 - dc / limits.xuMax);
  const fsc = steelStress(strain, steel);
  const fcc = concreteDesignStrength(fck);
  const lever = d - dc;
  const Asc = (Mu2 * KNM) / ((fsc - fcc) * lever);
  const Ast2 = (Asc * (fsc - fcc)) / designYield(fy);
  const Ast = limits.AstLim + Ast2;
  sheet.add({
    title: 'Type of section',
    lines: [`Mu = ${num(Mu)} kN·m > Mu,lim = ${num(limits.MuLim)} kN·m`],
    output: 'Doubly reinforced',
    status: 'warn',
  });
  sheet.add({
    ref: 'Annex G-1.2',
    title: 'Moment carried by the steel couple',
    lines: [`Mu2 = Mu − Mu,lim = ${num(Mu)} − ${num(limits.MuLim)}`],
    output: `Mu2 = ${num(Mu2)} kN·m`,
  });
  sheet.add({
    ref: 'Cl. 38.1, Fig. 23',
    title: 'Stress in the compression steel',
    lines: [
      `εsc = 0.0035 (1 − d′ / xu,max) = 0.0035 (1 − ${num(dc)} / ${num(limits.xuMax)}) = ${fix(strain, 5)}`,
      `fsc from the design stress–strain curve of ${steel.name}`,
      `fcc = 0.446 fck = ${fix(fcc, 2)} MPa (concrete displaced by the bars)`,
    ],
    output: `fsc = ${num(fsc)} MPa`,
  });
  sheet.add({
    ref: 'Annex G-1.2',
    title: 'Compression reinforcement',
    lines: [
      `Asc = Mu2 / [(fsc − fcc)(d − d′)]`,
      `= ${num(Mu2)} × 10⁶ / [(${num(fsc)} − ${fix(fcc, 2)}) × (${num(d)} − ${num(dc)})]`,
    ],
    output: `Asc = ${num(Asc)} mm²`,
  });
  sheet.add({
    ref: 'Annex G-1.2',
    title: 'Tension reinforcement',
    lines: [
      `Ast1 = 0.36 fck b xu,max / (0.87 fy) = ${num(limits.AstLim)} mm²`,
      `Ast2 = Asc (fsc − fcc) / (0.87 fy) = ${num(Ast2)} mm²`,
      `Ast = Ast1 + Ast2`,
    ],
    output: `Ast = ${num(Ast)} mm²`,
  });
  return { kind: 'doubly', limits, xu: limits.xuMax, Ast, Asc, fsc, steps: sheet.steps };
}

export interface FlexureCapacity {
  /** Neutral axis depth from strain compatibility, mm. */
  xu: number;
  xuMax: number;
  /** True when xu exceeds xu,max; the capacity is then limited to the value at xu,max. */
  overReinforced: boolean;
  /** Moment of resistance, kN·m. */
  Mu: number;
  /** Stress in the tension steel at the neutral axis used, MPa. */
  fst: number;
  steps: Step[];
}

function bisect(f: (x: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  for (let i = 0; i < 80; i++) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (fa * fm <= 0) b = mid;
    else {
      a = mid;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/**
 * Moment of resistance of a rectangular section with given tension steel Ast and compression
 * steel Asc (mm²), by strain compatibility. Over-reinforced sections are limited to xu,max as the
 * code requires (cl. 38.1 f).
 */
export function capacityRectangular(
  section: RectangularSection,
  Ast: number,
  Asc = 0,
): FlexureCapacity {
  const { b, d, dc, fck, steel } = section;
  const xuMax = xuMaxRatio(steel.fy) * d;
  const compression = (xu: number) => {
    const strain = (EPS_CU * (xu - dc)) / xu;
    const net = Asc > 0 ? Asc * (steelStress(strain, steel) - concreteStress(strain, fck)) : 0;
    return { concrete: BLOCK_AREA * fck * b * xu, steel: net };
  };
  const tensionStress = (xu: number) => steelStress((EPS_CU * (d - xu)) / xu, steel);
  const imbalance = (xu: number) => {
    const c = compression(xu);
    return c.concrete + c.steel - Ast * tensionStress(xu);
  };
  const xu = bisect(imbalance, 1e-6 * d, d);
  const overReinforced = xu > xuMax * (1 + 1e-9);
  const used = overReinforced ? xuMax : xu;
  const c = compression(used);
  const Mu = (c.concrete * (d - BLOCK_CENTROID * used) + c.steel * (d - dc)) / KNM;
  const fst = tensionStress(used);

  const sheet = new Sheet();
  sheet.add({
    ref: 'Cl. 38.1',
    title: 'Depth of neutral axis (equilibrium C = T)',
    lines: [
      `0.36 fck b xu${Asc > 0 ? ' + Asc (fsc − fcc)' : ''} = fst Ast`,
      `xu = ${num(xu)} mm, xu,max = ${num(xuMax)} mm`,
    ],
    output: overReinforced ? 'Over-reinforced: xu limited to xu,max' : `xu = ${num(xu)} mm`,
    status: overReinforced ? 'warn' : 'ok',
  });
  sheet.add({
    ref: 'Annex G-1.1',
    title: 'Moment of resistance',
    lines: [
      `Mu = 0.36 fck b xu (d − 0.42 xu)${Asc > 0 ? ' + Asc (fsc − fcc)(d − d′)' : ''}`,
      `= 0.36 × ${fck} × ${num(b)} × ${num(used)} × (${num(d)} − 0.42 × ${num(used)})${
        Asc > 0 ? ` + ${num(c.steel / 1000)} kN × ${num(d - dc)} mm` : ''
      }`,
    ],
    output: `Mu = ${num(Mu)} kN·m`,
  });
  return { xu, xuMax, overReinforced, Mu, fst, steps: sheet.steps };
}

export interface FlangedSection {
  /** Effective flange width, mm. */
  bf: number;
  /** Web width, mm. */
  bw: number;
  /** Flange (slab) thickness, mm. */
  Df: number;
  /** Effective depth, mm. */
  d: number;
  fck: number;
  steel: SteelGrade;
}

/**
 * Compression force (N) and moment about the tension steel (N·mm) of a flanged section for a
 * neutral axis depth xu, Annex G-2.
 */
export function flangedCompression(
  section: FlangedSection,
  xu: number,
): { force: number; moment: number; yf: number } {
  const { bf, bw, Df, d, fck } = section;
  if (xu <= Df) {
    const force = BLOCK_AREA * fck * bf * xu;
    return { force, moment: force * (d - BLOCK_CENTROID * xu), yf: xu };
  }
  // Flange fully within the rectangular part of the stress block when Df ≤ 3/7·xu (G-2.2),
  // otherwise an equivalent uniformly stressed depth yf is used (G-2.2.1).
  const yf = Df / xu <= 0.43 ? Df : Math.min(Df, 0.15 * xu + 0.65 * Df);
  const web = BLOCK_AREA * fck * bw * xu;
  const flange = 0.45 * fck * (bf - bw) * yf;
  return {
    force: web + flange,
    moment: web * (d - BLOCK_CENTROID * xu) + flange * (d - yf / 2),
    yf,
  };
}

export interface FlangedDesign {
  /** Where the neutral axis falls. */
  kind: 'flange' | 'web';
  xu: number;
  xuMax: number;
  /** Capacity with the neutral axis at xu,max, kN·m. */
  MuLim: number;
  /** Required tension steel, mm². */
  Ast: number;
  /** False when Mu exceeds Mu,lim: the section must be enlarged or given compression steel. */
  adequate: boolean;
  steps: Step[];
}

/** Required tension steel for a design moment Mu (kN·m) on a flanged (T or L) section. */
export function designFlanged(section: FlangedSection, Mu: number): FlangedDesign {
  const { bf, Df, d, fck, steel } = section;
  const fyd = designYield(steel.fy);
  const xuMax = xuMaxRatio(steel.fy) * d;
  const atFlange = flangedCompression(section, Math.min(Df, xuMax));
  const atLimit = flangedCompression(section, xuMax);
  const MuLim = atLimit.moment / KNM;
  const sheet = new Sheet();
  sheet.add({
    ref: 'Annex G-2',
    title: 'Moment capacity with the neutral axis at the underside of the flange',
    lines: [
      `Mu,f = 0.36 fck bf Df (d − 0.42 Df)`,
      `= 0.36 × ${fck} × ${num(bf)} × ${num(Df)} × (${num(d)} − 0.42 × ${num(Df)})`,
    ],
    output: `Mu,f = ${num(atFlange.moment / KNM)} kN·m`,
  });

  if (Mu * KNM <= atFlange.moment + 1e-6) {
    const rect = designRectangular({ b: bf, d, dc: 0, fck, steel }, Mu);
    sheet.add({
      title: 'Position of the neutral axis',
      lines: [`Mu = ${num(Mu)} kN·m ≤ Mu,f: the neutral axis lies in the flange`],
      output: 'Design as a rectangle of width bf',
      status: 'ok',
    });
    sheet.add({
      ref: 'Annex G-1.1 (b)',
      title: 'Tension reinforcement',
      lines: [
        `Ast = (0.5 fck / fy) [1 − √(1 − 4.6 Mu / (fck bf d²))] bf d`,
        `xu = ${num(rect.xu)} mm ≤ Df = ${num(Df)} mm`,
      ],
      output: `Ast = ${num(rect.Ast)} mm²`,
    });
    return {
      kind: 'flange',
      xu: rect.xu,
      xuMax,
      MuLim,
      Ast: rect.Ast,
      adequate: true,
      steps: sheet.steps,
    };
  }

  const adequate = Mu <= MuLim + 1e-9;
  const xu = adequate
    ? bisect((x) => flangedCompression(section, x).moment - Mu * KNM, Df, xuMax)
    : xuMax;
  const c = flangedCompression(section, xu);
  const Ast = c.force / fyd;
  sheet.add({
    title: 'Position of the neutral axis',
    lines: [`Mu = ${num(Mu)} kN·m > Mu,f: the neutral axis lies in the web`],
    output: 'Flanged-section behaviour',
  });
  sheet.add({
    ref: Df / xu <= 0.43 ? 'Annex G-2.2' : 'Annex G-2.2.1',
    title: 'Depth of neutral axis',
    lines: [
      `Mu = 0.36 fck bw xu (d − 0.42 xu) + 0.45 fck (bf − bw) yf (d − yf / 2)`,
      Df / xu <= 0.43
        ? `Df / xu = ${fix(Df / xu, 2)} ≤ 0.43, so yf = Df = ${num(Df)} mm`
        : `Df / xu = ${fix(Df / xu, 2)} > 0.43, so yf = 0.15 xu + 0.65 Df = ${num(c.yf)} mm`,
      `Solving: xu = ${num(xu)} mm (xu,max = ${num(xuMax)} mm)`,
    ],
    output: adequate ? `xu = ${num(xu)} mm` : `Mu exceeds Mu,lim = ${num(MuLim)} kN·m`,
    status: adequate ? 'ok' : 'fail',
  });
  sheet.add({
    ref: 'Annex G-2',
    title: 'Tension reinforcement',
    lines: [
      `0.87 fy Ast = 0.36 fck bw xu + 0.45 fck (bf − bw) yf`,
      `Ast = ${num(c.force / 1000)} × 10³ / (0.87 × ${steel.fy})`,
    ],
    output: `Ast = ${num(Ast)} mm²`,
  });
  return { kind: 'web', xu, xuMax, MuLim, Ast, adequate, steps: sheet.steps };
}

/**
 * Effective flange width, cl. 23.1.2: l0/6 + bw + 6·Df for T-beams and l0/12 + bw + 3·Df for
 * L-beams, limited to the width actually available. `l0` is the distance between points of zero
 * moment (0.7 × effective span for continuous beams), in mm.
 */
export function effectiveFlangeWidth(
  shape: 'T' | 'L',
  l0: number,
  bw: number,
  Df: number,
  available: number,
): number {
  const width = shape === 'T' ? l0 / 6 + bw + 6 * Df : l0 / 12 + bw + 3 * Df;
  return Math.min(width, available);
}

/** Minimum tension steel in a beam, cl. 26.5.1.1 (a): As / (b·d) = 0.85 / fy. */
export function minimumTensionSteel(b: number, d: number, fy: number): number {
  return (0.85 * b * d) / fy;
}

/** Maximum tension or compression steel in a beam, cl. 26.5.1.1 (b) and 26.5.1.2: 0.04·b·D. */
export function maximumSteel(b: number, D: number): number {
  return 0.04 * b * D;
}
