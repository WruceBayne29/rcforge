/**
 * Choosing bars and checking how they fit, IS 456:2000 cl. 26.3 and 26.5.
 */
import { barArea } from './materials';

export interface BarChoice {
  count: number;
  diameter: number;
  /** Area provided, mm². */
  area: number;
  /** Number of layers needed to fit the bars in the width. */
  layers: number;
  /** Clear horizontal distance between bars in the fullest layer, mm. */
  clearSpacing: number;
}

/** Minimum clear distance between bars, cl. 26.3.2: the bar size, or 5 mm more than the aggregate. */
export function minimumClearSpacing(diameter: number, aggregate = 20): number {
  return Math.max(diameter, aggregate + 5);
}

/** Largest number of bars of one size that fit in a single layer of the given clear width. */
export function barsPerLayer(clearWidth: number, diameter: number, aggregate = 20): number {
  const gap = minimumClearSpacing(diameter, aggregate);
  return Math.max(0, Math.floor((clearWidth + gap) / (diameter + gap)));
}

function describe(
  count: number,
  diameter: number,
  clearWidth: number,
  aggregate: number,
): BarChoice {
  const perLayer = Math.max(1, barsPerLayer(clearWidth, diameter, aggregate));
  const layers = Math.ceil(count / perLayer);
  const inLayer = Math.min(count, perLayer);
  return {
    count,
    diameter,
    area: count * barArea(diameter),
    layers,
    clearSpacing:
      inLayer > 1 ? (clearWidth - inLayer * diameter) / (inLayer - 1) : clearWidth - diameter,
  };
}

export interface BarOptions {
  /** Diameters to choose from. */
  diameters?: readonly number[];
  /** Force a particular diameter. */
  diameter?: number;
  /** Fewest bars allowed (two for a beam face). */
  minimumCount?: number;
  aggregate?: number;
}

/**
 * Picks bars for a required area in a beam of clear width `clearWidth` (inside the stirrups).
 * Prefers an arrangement that fits in one layer, then the least excess steel, then fewer bars.
 */
export function chooseBars(
  required: number,
  clearWidth: number,
  options: BarOptions = {},
): BarChoice {
  const aggregate = options.aggregate ?? 20;
  const minimumCount = options.minimumCount ?? 2;
  const diameters = options.diameter
    ? [options.diameter]
    : (options.diameters ?? [12, 16, 20, 25, 32]);
  let best: BarChoice | null = null;
  let bestScore = Infinity;
  for (const diameter of diameters) {
    const count = Math.max(minimumCount, Math.ceil(required / barArea(diameter) - 1e-9));
    const choice = describe(count, diameter, clearWidth, aggregate);
    // Extra layers are heavily penalised; excess area and bar count break ties.
    const score =
      (choice.layers - 1) * 1e6 + (choice.area - required) + count * 1e-3 + (count > 8 ? 1e5 : 0);
    if (score < bestScore) {
      best = choice;
      bestScore = score;
    }
  }
  return best as BarChoice;
}

/** Bar spacing (mm, rounded down to 5) that provides `required` mm² per metre width of slab. */
export function slabBarSpacing(required: number, diameter: number, maximum: number): number {
  const exact = (1000 * barArea(diameter)) / required;
  return Math.max(50, Math.floor(Math.min(exact, maximum) / 5) * 5);
}

/** Area provided per metre width by bars at a given spacing, mm²/m. */
export function areaPerMetre(diameter: number, spacing: number): number {
  return (1000 * barArea(diameter)) / spacing;
}

/**
 * Maximum clear distance between tension bars for crack control, Table 15 (no redistribution):
 * 300, 180 and 150 mm for Fe250, Fe415 and Fe500.
 */
export function maximumClearSpacing(fy: number): number {
  if (fy <= 250) return 300;
  if (fy <= 415) return 180;
  return 150;
}
