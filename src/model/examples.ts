import { defaultProject } from './project';
import type { Project } from './project';

export interface Example {
  id: string;
  name: string;
  note: string;
  build: () => Project;
}

const make = (title: string, patch: (p: Project) => void): Project => {
  const p = defaultProject();
  p.title = title;
  patch(p);
  return p;
};

export const EXAMPLES: Example[] = [
  {
    id: 'beam-simple',
    name: 'Simply supported beam',
    note: '6 m span, singly reinforced',
    build: () => make('Floor beam B1', () => undefined),
  },
  {
    id: 'beam-doubly',
    name: 'Doubly reinforced beam',
    note: 'Depth restricted, heavy load',
    build: () =>
      make('Transfer beam B4', (p) => {
        p.beam = {
          ...p.beam,
          b: 300,
          D: 450,
          span: 6,
          loading: { kind: 'udl', dead: 28, live: 18, selfWeight: true },
        };
      }),
  },
  {
    id: 'beam-tee',
    name: 'T-beam',
    note: 'Slab acting as the flange',
    build: () =>
      make('Floor beam B2 (T-beam)', (p) => {
        p.beam = {
          ...p.beam,
          shape: 'tee',
          b: 300,
          D: 550,
          bf: 1500,
          Df: 120,
          span: 8,
          loading: { kind: 'udl', dead: 24, live: 15, selfWeight: true },
        };
      }),
  },
  {
    id: 'beam-cantilever',
    name: 'Cantilever beam',
    note: '2.5 m balcony beam',
    build: () =>
      make('Balcony beam CB1', (p) => {
        p.beam = {
          ...p.beam,
          b: 250,
          D: 450,
          span: 2.5,
          support: 'cantilever',
          loading: { kind: 'udl', dead: 12, live: 6, selfWeight: true },
        };
      }),
  },
  {
    id: 'column-biaxial',
    name: 'Column, biaxial bending',
    note: '300 × 450, axial + two moments',
    build: () =>
      make('Corner column C1', (p) => {
        p.element = 'column';
      }),
  },
  {
    id: 'column-slender',
    name: 'Slender column',
    note: '6 m tall, additional moments',
    build: () =>
      make('Double-height column C7', (p) => {
        p.element = 'column';
        p.column = {
          ...p.column,
          b: 350,
          D: 500,
          length: 6,
          Pu: 1100,
          Mux: 90,
          Muy: 30,
          barsDepth: 1,
        };
      }),
  },
  {
    id: 'column-circular',
    name: 'Circular column',
    note: '500 mm diameter, eight bars',
    build: () =>
      make('Portico column C12', (p) => {
        p.element = 'column';
        p.column = {
          ...p.column,
          shape: 'circular',
          D: 500,
          barsRing: 8,
          Pu: 1600,
          Mux: 110,
          Muy: 0,
        };
      }),
  },
  {
    id: 'slab-two-way',
    name: 'Two-way slab',
    note: 'Corner panel, 4 × 5 m',
    build: () =>
      make('Floor slab S1', (p) => {
        p.element = 'slab';
      }),
  },
  {
    id: 'slab-one-way',
    name: 'One-way slab',
    note: 'Continuous, 3.5 m span',
    build: () =>
      make('Corridor slab S3', (p) => {
        p.element = 'slab';
        p.slab = { ...p.slab, type: 'one-way', lx: 3.5, D: 140, support: 'continuous' };
      }),
  },
  {
    id: 'footing-square',
    name: 'Square footing',
    note: '900 kN column on 200 kN/m² soil',
    build: () =>
      make('Footing F1', (p) => {
        p.element = 'footing';
      }),
  },
  {
    id: 'footing-rect',
    name: 'Rectangular footing',
    note: 'Under a 300 × 600 column',
    build: () =>
      make('Footing F3', (p) => {
        p.element = 'footing';
        p.footing = { ...p.footing, shape: 'rectangular', cx: 600, cy: 300, P: 1200, bearing: 180 };
      }),
  },
];
