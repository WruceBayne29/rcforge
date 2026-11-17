/**
 * Indicative bar bending schedules. Cutting lengths use the usual site rules of thumb
 * (anchorage of one development length, hooks of 10φ, bend deductions of 2φ and 3φ); a real
 * schedule follows the detailed drawings and IS 2502.
 */
import { developmentLength, lapLength } from './anchorage';
import type { BeamDesign } from './beam';
import type { ColumnDesign } from './column';
import type { FootingDesign } from './footing';
import { findSteel } from './materials';
import type { SlabDesign } from './slab';

export interface ScheduleRow {
  mark: string;
  description: string;
  diameter: number;
  count: number;
  /** Cutting length of one bar, mm. */
  length: number;
  /** Total length, m. */
  total: number;
  /** Total weight, kg. */
  weight: number;
}

/** Weight of a bar per metre, kg: d² / 162 (d in mm). */
export function unitWeight(diameter: number): number {
  return (diameter * diameter) / 162;
}

function row(
  mark: string,
  description: string,
  diameter: number,
  count: number,
  length: number,
): ScheduleRow {
  const rounded = Math.ceil(length / 10) * 10;
  const total = (count * rounded) / 1000;
  return {
    mark,
    description,
    diameter,
    count,
    length: rounded,
    total,
    weight: total * unitWeight(diameter),
  };
}

/** Closed rectangular link: 2(a + b) + two 10φ hooks − three 90° bends (2φ) − two 135° bends (3φ). */
export function linkLength(a: number, b: number, diameter: number): number {
  return 2 * (a + b) + 2 * 10 * diameter - 3 * 2 * diameter - 2 * 3 * diameter;
}

export function beamSchedule(design: BeamDesign): ScheduleRow[] {
  const { input, tension, top, shear, fck } = design;
  const steel = findSteel(input.steel);
  const span = input.span * 1000;
  const ends = input.support === 'cantilever' ? 1 : 2;
  const anchored = (diameter: number) => span + ends * developmentLength(diameter, fck, steel);
  const links = Math.floor(span / shear.spacing) + 1;
  return [
    row(
      'a',
      input.support === 'cantilever' ? 'Top main bars' : 'Bottom main bars',
      tension.diameter,
      tension.count,
      anchored(tension.diameter),
    ),
    row(
      'b',
      design.topIsStructural ? 'Compression bars' : 'Hanger bars',
      top.diameter,
      top.count,
      anchored(top.diameter),
    ),
    row(
      'c',
      `Stirrups @ ${shear.spacing} c/c`,
      input.stirrupDiameter,
      links * (input.stirrupLegs / 2),
      linkLength(input.b - 2 * input.cover, input.D - 2 * input.cover, input.stirrupDiameter),
    ),
  ];
}

export function columnSchedule(design: ColumnDesign): ScheduleRow[] {
  const { input, bars, tie, fck } = design;
  const steel = findSteel(input.steel);
  const height = input.length * 1000;
  const lap = lapLength(input.barDiameter, fck, steel, true);
  const core = input.D - 2 * input.cover;
  const tieLength =
    input.shape === 'circular'
      ? Math.PI * core + 2 * 10 * input.tieDiameter
      : linkLength(input.b - 2 * input.cover, core, input.tieDiameter);
  return [
    row('a', 'Longitudinal bars (with lap)', input.barDiameter, bars.length, height + lap),
    row(
      'b',
      `Ties @ ${tie.pitch} c/c`,
      input.tieDiameter,
      Math.floor(height / tie.pitch) + 1,
      tieLength,
    ),
  ];
}

export function slabSchedule(design: SlabDesign): ScheduleRow[] {
  const { input, steel, distribution } = design;
  const twoWay = input.type === 'two-way';
  const lx = input.lx * 1000;
  const ly = twoWay ? input.ly * 1000 : 1000;
  const rows: ScheduleRow[] = [];
  steel.forEach((s, k) => {
    const along = s.direction === 'short' ? lx : ly;
    const across = s.direction === 'short' ? ly : lx;
    // Top bars over a support extend about 0.3 of the span into the panel.
    const length = s.face === 'top' && input.support !== 'cantilever' ? 0.3 * along : along;
    rows.push(
      row(
        String.fromCharCode(97 + k),
        `${s.location}, ${s.face}`,
        s.diameter,
        Math.floor(across / s.spacing) + 1,
        length,
      ),
    );
  });
  if (distribution) {
    rows.push(
      row(
        String.fromCharCode(97 + rows.length),
        'Distribution bars',
        distribution.diameter,
        Math.floor(lx / distribution.spacing) + 1,
        1000,
      ),
    );
  }
  return rows;
}

export function footingSchedule(design: FootingDesign): ScheduleRow[] {
  const { input, L, B, steel } = design;
  return steel.map((s, k) =>
    row(
      String.fromCharCode(97 + k),
      `Bottom bars parallel to ${s.direction}`,
      input.barDiameter,
      s.count,
      (s.direction === 'L' ? L : B) - 2 * input.cover,
    ),
  );
}

export function scheduleWeight(rows: ScheduleRow[]): number {
  return rows.reduce((sum, r) => sum + r.weight, 0);
}
