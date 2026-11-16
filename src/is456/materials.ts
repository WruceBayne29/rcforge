/**
 * Material models of IS 456:2000 (limit state of collapse).
 * Units: MPa (N/mm²), strains dimensionless.
 */

export interface ConcreteGrade {
  name: string;
  /** Characteristic cube strength, MPa. */
  fck: number;
}

export interface SteelGrade {
  name: string;
  /** Characteristic yield (or 0.2 % proof) strength, MPa. */
  fy: number;
  /** True for cold-worked / TMT bars (curved stress–strain curve); false for mild steel. */
  deformed: boolean;
}

export const CONCRETE_GRADES: readonly ConcreteGrade[] = [20, 25, 30, 35, 40, 45, 50].map((fck) => ({
  name: `M${fck}`,
  fck,
}));

export const STEEL_GRADES: readonly SteelGrade[] = [
  { name: 'Fe250', fy: 250, deformed: false },
  { name: 'Fe415', fy: 415, deformed: true },
  { name: 'Fe500', fy: 500, deformed: true },
  { name: 'Fe550', fy: 550, deformed: true },
];

/** Modulus of elasticity of steel, MPa (cl. 5.6.3). */
export const ES = 200000;
/** Maximum compressive strain in concrete in bending (cl. 38.1 b). */
export const EPS_CU = 0.0035;
/** Strain at which the concrete stress block becomes rectangular (cl. 38.1, Fig. 21). */
export const EPS_C0 = 0.002;
/** Partial safety factors (cl. 36.4.2). */
export const GAMMA_C = 1.5;
export const GAMMA_S = 1.15;

/** Short-term modulus of elasticity of concrete, MPa (cl. 6.2.3.1). */
export function concreteModulus(fck: number): number {
  return 5000 * Math.sqrt(fck);
}

/** Design yield stress of steel, 0.87·fy (fy / 1.15). */
export function designYield(fy: number): number {
  return 0.87 * fy;
}

/**
 * Limiting neutral axis depth ratio xu,max/d (cl. 38.1 f): the neutral axis depth at which the
 * tension steel just reaches a strain of 0.87·fy/Es + 0.002. The code tabulates the rounded
 * values 0.53 (Fe250), 0.48 (Fe415) and 0.46 (Fe500).
 */
export function xuMaxRatio(fy: number): number {
  const exact = EPS_CU / (EPS_CU + designYield(fy) / ES + 0.002);
  return Math.round(exact * 100) / 100;
}

/** Peak design compressive stress in concrete, 0.67·fck/1.5 ≈ 0.446·fck (Fig. 21). */
export function concreteDesignStrength(fck: number): number {
  return (0.67 * fck) / GAMMA_C;
}

/** Design compressive stress in concrete at a given strain (parabolic–rectangular block). */
export function concreteStress(strain: number, fck: number): number {
  if (strain <= 0) return 0;
  const peak = concreteDesignStrength(fck);
  if (strain >= EPS_C0) return peak;
  const r = strain / EPS_C0;
  return peak * (2 * r - r * r);
}

/**
 * Points of the design stress–strain curve for cold-worked deformed bars (Fig. 23A, tabulated
 * in SP 16 Table A): stress level as a fraction of 0.87·fy, and the inelastic strain there.
 */
const HYSD_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0.8, 0],
  [0.85, 0.0001],
  [0.9, 0.0003],
  [0.95, 0.0007],
  [0.975, 0.001],
  [1.0, 0.002],
];

/**
 * Design stress in reinforcement at a given strain. The curve is symmetric in tension and
 * compression, so the sign of the strain carries through to the stress.
 */
export function steelStress(strain: number, steel: SteelGrade): number {
  const sign = strain < 0 ? -1 : 1;
  const e = Math.abs(strain);
  const fyd = designYield(steel.fy);
  if (!steel.deformed) return sign * Math.min(ES * e, fyd);

  let prevStress = 0;
  let prevStrain = 0;
  for (const [level, inelastic] of HYSD_CURVE) {
    const stress = level * fyd;
    const total = stress / ES + inelastic;
    if (e <= total) {
      const t = (e - prevStrain) / (total - prevStrain);
      return sign * (prevStress + t * (stress - prevStress));
    }
    prevStress = stress;
    prevStrain = total;
  }
  return sign * fyd;
}

/** Strain at which the design stress first reaches 0.87·fy. */
export function yieldStrain(steel: SteelGrade): number {
  return designYield(steel.fy) / ES + (steel.deformed ? 0.002 : 0);
}

/** Stress block coefficients for a neutral axis inside the section (cl. 38.1, Fig. 22). */
export const BLOCK_AREA = 0.36;
export const BLOCK_CENTROID = 0.42;

/** Area of one bar, mm². */
export function barArea(diameter: number): number {
  return (Math.PI * diameter * diameter) / 4;
}

/** Standard bar diameters, mm. */
export const BAR_DIAMETERS: readonly number[] = [8, 10, 12, 16, 20, 25, 32];

export function findConcrete(name: string): ConcreteGrade {
  return CONCRETE_GRADES.find((g) => g.name === name) ?? CONCRETE_GRADES[1];
}

export function findSteel(name: string): SteelGrade {
  return STEEL_GRADES.find((g) => g.name === name) ?? STEEL_GRADES[1];
}
