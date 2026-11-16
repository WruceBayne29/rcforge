/**
 * Control of deflection by span to effective depth ratios, IS 456:2000 cl. 23.2.1.
 */
export type SupportCondition = 'cantilever' | 'simple' | 'continuous';

/** Basic span / effective depth ratios for spans up to 10 m, cl. 23.2.1 (a). */
export const BASIC_RATIO: Record<SupportCondition, number> = {
  cantilever: 7,
  simple: 20,
  continuous: 26,
};

/**
 * Factor for spans above 10 m, cl. 23.2.1 (b): 10 / span. It does not apply to cantilevers,
 * for which the deflection should be calculated instead.
 */
export function longSpanFactor(support: SupportCondition, span: number): number {
  return support !== 'cantilever' && span > 10 ? 10 / span : 1;
}

/** Service stress in the tension steel, Fig. 4: fs = 0.58 fy × (Ast required / Ast provided). */
export function serviceStress(fy: number, required: number, provided: number): number {
  return 0.58 * fy * Math.min(1, required / provided);
}

/**
 * Modification factor for tension reinforcement, Fig. 4. The curves follow the expression given
 * in SP 24: 1 / (0.225 + 0.00322 fs − 0.625 log10(1 / pt)), limited to 2.0, with pt in percent.
 */
export function tensionFactor(fs: number, pt: number): number {
  if (pt <= 0) return 2;
  const value = 1 / (0.225 + 0.00322 * fs - 0.625 * Math.log10(1 / pt));
  return value <= 0 || value > 2 ? 2 : value;
}

/** Modification factor for compression reinforcement, Fig. 5: 1 + pc / (3 + pc) ≤ 1.5. */
export function compressionFactor(pc: number): number {
  return Math.min(1.5, 1 + pc / (3 + pc));
}

/** Reduction factor for flanged beams, Fig. 6, as a function of bw / bf. */
export function flangeFactor(bw: number, bf: number): number {
  const ratio = bw / bf;
  if (ratio >= 1) return 1;
  return ratio <= 0.3 ? 0.8 : 0.8 + (2 / 7) * (ratio - 0.3);
}
