/**
 * Shear design to IS 456:2000, cl. 40 and cl. 26.5.1.5–6.
 * Dimensions in mm, forces in kN, stresses in MPa.
 */
import { barArea, designYield } from './materials';
import { Sheet, fix, num } from './steps';
import type { Step } from './steps';

/**
 * Design shear strength of concrete τc, Table 19. The table follows the expression given in
 * SP 16: τc = 0.85 √(0.8 fck) (√(1 + 5β) − 1) / (6β), with β = 0.8 fck / (6.89 pt) ≥ 1.
 * The percentage of steel is taken between 0.15 and 3.0, and fck is capped at 40 MPa.
 */
export function shearStrengthConcrete(fck: number, pt: number): number {
  const f = Math.min(fck, 40);
  const p = Math.min(Math.max(pt, 0.15), 3);
  const beta = Math.max((0.8 * f) / (6.89 * p), 1);
  return (0.85 * Math.sqrt(0.8 * f) * (Math.sqrt(1 + 5 * beta) - 1)) / (6 * beta);
}

/** Maximum shear stress τc,max, Table 20 (values typed in from the code). */
const TAU_C_MAX: ReadonlyArray<readonly [number, number]> = [
  [15, 2.5],
  [20, 2.8],
  [25, 3.1],
  [30, 3.5],
  [35, 3.7],
  [40, 4.0],
];

export function maximumShearStress(fck: number): number {
  let value = TAU_C_MAX[0][1];
  for (const [grade, tau] of TAU_C_MAX) if (fck >= grade) value = tau;
  return value;
}

/** Enhancement factor k for the shear strength of solid slabs, cl. 40.2.1.1. */
export function slabShearFactor(D: number): number {
  if (D <= 150) return 1.3;
  if (D >= 300) return 1.0;
  return 1.3 - (0.3 * (D - 150)) / 150;
}

export interface ShearInput {
  /** Breadth of the web, mm. */
  b: number;
  /** Effective depth, mm. */
  d: number;
  fck: number;
  /** Design shear force, kN. */
  Vu: number;
  /** Tension steel continuing past the section, mm². */
  Ast: number;
  /** Yield strength of the stirrup steel, MPa (not more than 415 may be used, cl. 40.4). */
  fyStirrup: number;
  /** Stirrup bar diameter, mm. */
  stirrupDiameter: number;
  /** Number of vertical legs. */
  legs: number;
}

export interface ShearDesign {
  tauV: number;
  tauC: number;
  tauCMax: number;
  pt: number;
  /** Shear to be carried by the stirrups, kN (0 when only minimum stirrups are needed). */
  Vus: number;
  /** Stirrup spacing from strength, mm (Infinity when not governed by strength). */
  spacingStrength: number;
  /** Spacing from the minimum shear reinforcement rule, mm. */
  spacingMinimum: number;
  /** Maximum spacing allowed, mm. */
  spacingMaximum: number;
  /** Spacing to provide, rounded down to 5 mm. */
  spacing: number;
  /** False when τv exceeds τc,max and the section must be enlarged. */
  adequate: boolean;
  steps: Step[];
}

/** Design of vertical stirrups for a beam section. */
export function designShear(input: ShearInput): ShearDesign {
  const { b, d, fck, Vu, Ast, stirrupDiameter, legs } = input;
  const fy = Math.min(input.fyStirrup, 415);
  const tauV = (Vu * 1000) / (b * d);
  const pt = (100 * Ast) / (b * d);
  const tauC = shearStrengthConcrete(fck, pt);
  const tauCMax = maximumShearStress(fck);
  const Asv = legs * barArea(stirrupDiameter);
  const adequate = tauV <= tauCMax;
  const sheet = new Sheet();

  sheet.add({
    ref: 'Cl. 40.1',
    title: 'Nominal shear stress',
    lines: [`τv = Vu / (b d) = ${num(Vu)} × 10³ / (${num(b)} × ${num(d)})`],
    output: `τv = ${fix(tauV, 2)} MPa`,
  });
  sheet.add({
    ref: 'Table 19',
    title: 'Design shear strength of concrete',
    lines: [
      `pt = 100 Ast / (b d) = 100 × ${num(Ast)} / (${num(b)} × ${num(d)}) = ${fix(pt, 2)} %`,
      `τc for M${fck} at pt = ${fix(Math.min(Math.max(pt, 0.15), 3), 2)} %`,
    ],
    output: `τc = ${fix(tauC, 2)} MPa`,
  });
  sheet.check(
    'Table 20',
    'Maximum shear stress',
    [`τv = ${fix(tauV, 2)} MPa ${adequate ? '≤' : '>'} τc,max = ${fix(tauCMax, 1)} MPa`],
    adequate,
    adequate ? 'Section size is adequate' : 'Increase the section',
  );

  const spacingMinimum = (designYield(fy) * Asv) / (0.4 * b);
  const spacingMaximum = Math.min(0.75 * d, 300);
  const Vus = Math.max(0, Vu - (tauC * b * d) / 1000);
  const spacingStrength = Vus > 0 ? (designYield(fy) * Asv * d) / (Vus * 1000) : Infinity;

  if (Vus > 0) {
    sheet.add({
      ref: 'Cl. 40.4',
      title: 'Shear carried by stirrups',
      lines: [
        `τv > τc, so shear reinforcement is designed`,
        `Vus = Vu − τc b d = ${num(Vu)} − ${fix(tauC, 2)} × ${num(b)} × ${num(d)} × 10⁻³`,
      ],
      output: `Vus = ${num(Vus)} kN`,
    });
    sheet.add({
      ref: 'Cl. 40.4 (a)',
      title: 'Spacing of vertical stirrups',
      lines: [
        `Asv = ${legs} legs of ${stirrupDiameter} mm = ${num(Asv)} mm²`,
        `sv = 0.87 fy Asv d / Vus = 0.87 × ${fy} × ${num(Asv)} × ${num(d)} / (${num(Vus)} × 10³)`,
      ],
      output: `sv = ${num(spacingStrength)} mm`,
    });
  } else {
    sheet.add({
      ref: 'Cl. 40.3',
      title: 'Shear reinforcement',
      lines: [`τv ≤ τc: only minimum shear reinforcement is required`],
      output: 'Minimum stirrups',
      status: 'ok',
    });
  }
  sheet.add({
    ref: 'Cl. 26.5.1.6',
    title: 'Minimum shear reinforcement',
    lines: [
      `Asv / (b sv) ≥ 0.4 / (0.87 fy)`,
      `sv ≤ 0.87 fy Asv / (0.4 b) = 0.87 × ${fy} × ${num(Asv)} / (0.4 × ${num(b)})`,
    ],
    output: `sv ≤ ${num(spacingMinimum)} mm`,
  });
  sheet.add({
    ref: 'Cl. 26.5.1.5',
    title: 'Maximum spacing',
    lines: [`sv ≤ 0.75 d = ${num(0.75 * d)} mm and ≤ 300 mm`],
    output: `sv ≤ ${num(spacingMaximum)} mm`,
  });
  const governing = Math.min(spacingStrength, spacingMinimum, spacingMaximum);
  const spacing = Math.max(5, Math.floor(governing / 5) * 5);
  sheet.add({
    title: 'Stirrups provided',
    lines: [`Least of the three spacings, rounded down to 5 mm`],
    output: `${stirrupDiameter} mm ${legs}-legged @ ${spacing} mm c/c`,
    status: adequate ? 'ok' : 'fail',
  });

  return {
    tauV,
    tauC,
    tauCMax,
    pt,
    Vus,
    spacingStrength,
    spacingMinimum,
    spacingMaximum,
    spacing,
    adequate,
    steps: sheet.steps,
  };
}
