/**
 * The document the app edits: one design case for each element type, plus which one is open.
 */
import {
  DEFAULT_BEAM,
  DEFAULT_COLUMN,
  DEFAULT_FOOTING,
  DEFAULT_SLAB,
  designBeam,
  designColumn,
  designFooting,
  designSlab,
} from '../is456';
import type {
  BeamDesign,
  BeamInput,
  ColumnDesign,
  ColumnInput,
  FootingDesign,
  FootingInput,
  SlabDesign,
  SlabInput,
} from '../is456';

export type ElementKind = 'beam' | 'column' | 'slab' | 'footing';

export const ELEMENTS: ReadonlyArray<{ id: ElementKind; label: string }> = [
  { id: 'beam', label: 'Beam' },
  { id: 'column', label: 'Column' },
  { id: 'slab', label: 'Slab' },
  { id: 'footing', label: 'Footing' },
];

export interface Project {
  version: 1;
  /** Job title shown in the title block. */
  title: string;
  /** Name of whoever prepared the sheet. */
  author: string;
  element: ElementKind;
  beam: BeamInput;
  column: ColumnInput;
  slab: SlabInput;
  footing: FootingInput;
}

export function defaultProject(): Project {
  return {
    version: 1,
    title: 'Untitled job',
    author: '',
    element: 'beam',
    beam: { ...DEFAULT_BEAM, loading: { ...DEFAULT_BEAM.loading } },
    column: { ...DEFAULT_COLUMN },
    slab: { ...DEFAULT_SLAB },
    footing: { ...DEFAULT_FOOTING },
  };
}

export type Design =
  | { kind: 'beam'; result: BeamDesign }
  | { kind: 'column'; result: ColumnDesign }
  | { kind: 'slab'; result: SlabDesign }
  | { kind: 'footing'; result: FootingDesign };

export type Outcome = { ok: true; design: Design } | { ok: false; problems: string[] };

type Rule = [value: number, name: string, min: number, max: number];

function rangeProblems(rules: Rule[]): string[] {
  const problems: string[] = [];
  for (const [value, name, min, max] of rules) {
    if (!Number.isFinite(value)) problems.push(`${name} must be a number.`);
    else if (value < min) problems.push(`${name} must be at least ${min}.`);
    else if (value > max) problems.push(`${name} must be no more than ${max}.`);
  }
  return problems;
}

/** Checks that the inputs are physically sensible before any design is attempted. */
export function inputProblems(project: Project): string[] {
  switch (project.element) {
    case 'beam': {
      const b = project.beam;
      const problems = rangeProblems([
        [b.b, 'Width b', 150, 2000],
        [b.D, 'Overall depth D', 150, 3000],
        [b.span, 'Span', 0.5, 40],
        [b.cover, 'Cover', 15, 100],
        [b.stirrupDiameter, 'Stirrup diameter', 6, 16],
        [b.stirrupLegs, 'Stirrup legs', 2, 6],
        ...(b.loading.kind === 'udl'
          ? ([
              [b.loading.dead, 'Dead load', 0, 2000],
              [b.loading.live, 'Imposed load', 0, 2000],
            ] as Rule[])
          : ([
              [b.loading.Mu, 'Design moment Mu', 0.1, 1e5],
              [b.loading.Vu, 'Design shear Vu', 0, 1e5],
            ] as Rule[])),
      ]);
      if (b.shape !== 'rectangular') {
        problems.push(
          ...rangeProblems([
            [b.bf, 'Flange width bf', b.b, 6000],
            [b.Df, 'Flange thickness Df', 50, b.D - 50],
          ]),
        );
      }
      if (b.D - b.cover - b.stirrupDiameter - 40 < 80) {
        problems.push('The beam is too shallow for its cover and bars.');
      }
      if (b.b - 2 * (b.cover + b.stirrupDiameter) < 60) {
        problems.push('The beam is too narrow for its cover and stirrups.');
      }
      return problems;
    }
    case 'column': {
      const c = project.column;
      const problems = rangeProblems([
        [c.D, c.shape === 'circular' ? 'Diameter D' : 'Depth D', 150, 3000],
        ...(c.shape === 'rectangular' ? ([[c.b, 'Width b', 150, 3000]] as Rule[]) : []),
        [c.length, 'Unsupported length', 0.5, 30],
        [c.kx, 'Effective length factor (x)', 0.5, 3],
        [c.ky, 'Effective length factor (y)', 0.5, 3],
        [c.cover, 'Cover', 25, 100],
        [c.barDiameter, 'Bar diameter', 8, 40],
        [c.tieDiameter, 'Tie diameter', 6, 16],
        [c.Pu, 'Axial load Pu', 0, 1e6],
        [Math.abs(c.Mux), 'Moment Mux', 0, 1e6],
        [Math.abs(c.Muy), 'Moment Muy', 0, 1e6],
        ...(c.shape === 'circular'
          ? ([[c.barsRing, 'Number of bars', 4, 40]] as Rule[])
          : ([
              [c.barsWidth, 'Bars in each wide face', 2, 12],
              [c.barsDepth, 'Extra bars in each side face', 0, 10],
            ] as Rule[])),
      ]);
      const least = c.shape === 'circular' ? c.D : Math.min(c.b, c.D);
      if (least - 2 * (c.cover + c.tieDiameter + c.barDiameter) < 20) {
        problems.push('The column is too small for its cover and bars.');
      }
      return problems;
    }
    case 'slab': {
      const s = project.slab;
      const problems = rangeProblems([
        [s.lx, 'Short span lx', 0.5, 15],
        [s.D, 'Overall depth D', 75, 600],
        [s.cover, 'Cover', 15, 75],
        [s.mainDiameter, 'Main bar diameter', 6, 25],
        [s.distributionDiameter, 'Distribution bar diameter', 6, 16],
        [s.dead, 'Superimposed dead load', 0, 200],
        [s.live, 'Imposed load', 0, 200],
        ...(s.type === 'two-way' ? ([[s.ly, 'Long span ly', s.lx, 30]] as Rule[]) : []),
      ]);
      if (s.D - s.cover - 1.5 * s.mainDiameter < 40) {
        problems.push('The slab is too thin for its cover and bars.');
      }
      return problems;
    }
    case 'footing': {
      const f = project.footing;
      const problems = rangeProblems([
        [f.cx, 'Column size cx', 150, 3000],
        [f.cy, 'Column size cy', 150, 3000],
        [f.P, 'Column load P', 10, 1e5],
        [f.bearing, 'Safe bearing capacity', 25, 2000],
        [f.cover, 'Cover', 40, 100],
        [f.barDiameter, 'Bar diameter', 8, 32],
      ]);
      if (f.D !== 0) problems.push(...rangeProblems([[f.D, 'Depth D', 200, 3000]]));
      return problems;
    }
  }
}

/** Runs the design for the open element, or reports what is wrong with the inputs. */
export function solve(project: Project): Outcome {
  const problems = inputProblems(project);
  if (problems.length > 0) return { ok: false, problems };
  try {
    switch (project.element) {
      case 'beam':
        return { ok: true, design: { kind: 'beam', result: designBeam(project.beam) } };
      case 'column':
        return { ok: true, design: { kind: 'column', result: designColumn(project.column) } };
      case 'slab':
        return { ok: true, design: { kind: 'slab', result: designSlab(project.slab) } };
      case 'footing':
        return { ok: true, design: { kind: 'footing', result: designFooting(project.footing) } };
    }
  } catch (e) {
    return { ok: false, problems: [e instanceof Error ? e.message : 'The calculation failed.'] };
  }
}

/** One-line description of the element, for the title block. */
export function describe(project: Project): string {
  switch (project.element) {
    case 'beam': {
      const b = project.beam;
      const shape = b.shape === 'rectangular' ? 'Rectangular' : b.shape === 'tee' ? 'T' : 'L';
      return `${shape} beam ${b.b} × ${b.D}, span ${b.span} m`;
    }
    case 'column': {
      const c = project.column;
      return c.shape === 'circular'
        ? `Circular column ${c.D} dia., length ${c.length} m`
        : `Column ${c.b} × ${c.D}, length ${c.length} m`;
    }
    case 'slab': {
      const s = project.slab;
      return s.type === 'two-way'
        ? `Two-way slab ${s.lx} × ${s.ly} m, ${s.D} thick`
        : `One-way slab, span ${s.lx} m, ${s.D} thick`;
    }
    case 'footing': {
      const f = project.footing;
      return `Isolated footing under a ${f.cx} × ${f.cy} column, P = ${f.P} kN`;
    }
  }
}
