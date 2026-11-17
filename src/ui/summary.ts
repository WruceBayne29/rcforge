import { fix, num } from '../is456';
import type { Design } from '../model/project';

/** The "provide" list: what the designer would carry to the drawing. */
export function provisions(design: Design): Array<[string, string]> {
  switch (design.kind) {
    case 'beam': {
      const r = design.result;
      return [
        ['Design moment Mu', `${num(r.Mu)} kN·m`],
        ['Design shear Vu', `${num(r.Vu)} kN`],
        ['Bottom steel', `${r.tension.count}–${r.tension.diameter}φ (${num(r.tension.area)} mm²)`],
        [
          r.topIsStructural ? 'Top steel (compression)' : 'Top steel (hangers)',
          `${r.top.count}–${r.top.diameter}φ`,
        ],
        [
          'Stirrups',
          `${r.input.stirrupDiameter}φ ${r.input.stirrupLegs}-legged @ ${r.shear.spacing} c/c`,
        ],
        ['Moment of resistance', `${num(r.MuCapacity)} kN·m`],
      ];
    }
    case 'column': {
      const r = design.result;
      return [
        ['Longitudinal bars', `${r.bars.length}–${r.input.barDiameter}φ (${fix(r.percent, 2)} %)`],
        ['Lateral ties', `${r.tie.diameter}φ @ ${r.tie.pitch} c/c`],
        ['Design moments', `Mux ${num(r.MuxDesign)}, Muy ${num(r.MuyDesign)} kN·m`],
        ['Capacities at Pu', `Mux1 ${num(r.Mux1)}, Muy1 ${num(r.Muy1)} kN·m`],
        [
          'Interaction value',
          Number.isFinite(r.utilisation) ? fix(r.utilisation, 2) : 'over capacity',
        ],
      ];
    }
    case 'slab': {
      const r = design.result;
      const rows: Array<[string, string]> = [['Factored load wu', `${num(r.wu)} kN/m²`]];
      for (const s of r.steel) {
        rows.push([`${s.location} (${s.face})`, `${s.diameter}φ @ ${s.spacing} c/c`]);
      }
      if (r.distribution) {
        rows.push([
          'Distribution steel',
          `${r.distribution.diameter}φ @ ${r.distribution.spacing} c/c`,
        ]);
      }
      return rows;
    }
    case 'footing': {
      const r = design.result;
      return [
        ['Size L × B × D', `${r.L} × ${r.B} × ${r.D} mm`],
        ['Net design pressure qu', `${num(r.qu)} kN/m²`],
        ...r.steel.map((s): [string, string] => [
          `Bars parallel to ${s.direction}`,
          `${s.count}–${r.input.barDiameter}φ @ ${num(s.spacing)} c/c`,
        ]),
        ['Development length', `${num(r.developmentLength)} mm`],
      ];
    }
  }
}

export const VERDICT = { ok: 'SAFE', warn: 'CHECK', fail: 'REVISE' } as const;
export const MARK = { ok: '✓', warn: '!', fail: '✗' } as const;
