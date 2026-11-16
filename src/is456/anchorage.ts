/**
 * Development length and laps, IS 456:2000 cl. 26.2.
 */
import { designYield } from './materials';
import type { SteelGrade } from './materials';

/** Design bond stress for plain bars in tension, cl. 26.2.1.1 (values typed in from the code). */
const BOND_STRESS: ReadonlyArray<readonly [number, number]> = [
  [20, 1.2],
  [25, 1.4],
  [30, 1.5],
  [35, 1.7],
  [40, 1.9],
];

/**
 * Design bond stress τbd, MPa. Increased by 60 % for deformed bars and by a further 25 % for
 * bars in compression (cl. 26.2.1.1).
 */
export function bondStress(fck: number, steel: SteelGrade, compression = false): number {
  let value = BOND_STRESS[0][1];
  for (const [grade, tau] of BOND_STRESS) if (fck >= grade) value = tau;
  if (steel.deformed) value *= 1.6;
  if (compression) value *= 1.25;
  return value;
}

/** Development length Ld = φ σs / (4 τbd) with σs = 0.87 fy, cl. 26.2.1. */
export function developmentLength(
  diameter: number,
  fck: number,
  steel: SteelGrade,
  compression = false,
): number {
  return (diameter * designYield(steel.fy)) / (4 * bondStress(fck, steel, compression));
}

/** Lap length, cl. 26.2.5.1: Ld or 30φ in flexural tension; Ld or 24φ in compression. */
export function lapLength(
  diameter: number,
  fck: number,
  steel: SteelGrade,
  compression = false,
): number {
  return Math.max(
    developmentLength(diameter, fck, steel, compression),
    (compression ? 24 : 30) * diameter,
  );
}
