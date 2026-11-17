import { describe as group, expect, it } from 'vitest';
import { EXAMPLES } from './examples';
import { defaultProject, describe, inputProblems, solve } from './project';
import type { ElementKind } from './project';

group('project model', () => {
  it('solves every element type from the defaults', () => {
    for (const element of ['beam', 'column', 'slab', 'footing'] as ElementKind[]) {
      const outcome = solve({ ...defaultProject(), element });
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.design.kind).toBe(element);
        expect(outcome.design.result.status).toBe('ok');
        expect(outcome.design.result.sections.length).toBeGreaterThan(2);
      }
      expect(describe({ ...defaultProject(), element }).length).toBeGreaterThan(10);
    }
  });

  it('every example produces a passing design', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(EXAMPLES.map((e) => e.id)).size).toBe(EXAMPLES.length);
    for (const example of EXAMPLES) {
      const outcome = solve(example.build());
      expect(outcome.ok, example.id).toBe(true);
      if (outcome.ok) expect(outcome.design.result.status, example.id).not.toBe('fail');
    }
  });

  it('rejects impossible inputs with readable messages', () => {
    const p = defaultProject();
    p.beam.b = 50;
    p.beam.span = Number.NaN;
    expect(inputProblems(p)).toEqual(
      expect.arrayContaining(['Width b must be at least 150.', 'Span must be a number.']),
    );
    expect(solve(p).ok).toBe(false);

    const tee = defaultProject();
    tee.beam.shape = 'tee';
    tee.beam.bf = 100;
    tee.beam.loading = { kind: 'forces', Mu: 0, Vu: 10 };
    expect(inputProblems(tee).join(' ')).toMatch(/Flange width bf/);
    expect(inputProblems(tee).join(' ')).toMatch(/Design moment Mu/);
    const narrow = defaultProject();
    narrow.beam.b = 150;
    narrow.beam.cover = 45;
    narrow.beam.D = 160;
    expect(inputProblems(narrow)).toEqual(
      expect.arrayContaining([
        'The beam is too shallow for its cover and bars.',
        'The beam is too narrow for its cover and stirrups.',
      ]),
    );

    const col = { ...defaultProject(), element: 'column' as const };
    col.column = { ...col.column, D: 5000, barsWidth: 1 };
    expect(inputProblems(col).length).toBe(2);
    const tiny = { ...defaultProject(), element: 'column' as const };
    tiny.column = { ...tiny.column, shape: 'circular', D: 150, barDiameter: 32, barsRing: 2 };
    expect(inputProblems(tiny).join(' ')).toMatch(/too small/);

    const slab = { ...defaultProject(), element: 'slab' as const };
    slab.slab = { ...slab.slab, ly: 2, D: 75, mainDiameter: 20 };
    expect(inputProblems(slab).join(' ')).toMatch(/Long span ly/);
    expect(inputProblems(slab).join(' ')).toMatch(/too thin/);

    const footing = { ...defaultProject(), element: 'footing' as const };
    footing.footing = { ...footing.footing, P: 1, D: 50 };
    expect(inputProblems(footing)).toHaveLength(2);
  });

  it('describes each element for the title block', () => {
    const p = defaultProject();
    expect(describe(p)).toBe('Rectangular beam 300 × 500, span 6 m');
    expect(describe({ ...p, beam: { ...p.beam, shape: 'ell' } })).toMatch(/^L beam/);
    expect(describe({ ...p, element: 'column' })).toBe('Column 300 × 450, length 3.2 m');
    expect(
      describe({ ...p, element: 'column', column: { ...p.column, shape: 'circular' } }),
    ).toMatch(/Circular/);
    expect(describe({ ...p, element: 'slab' })).toBe('Two-way slab 4 × 5 m, 150 thick');
    expect(describe({ ...p, element: 'slab', slab: { ...p.slab, type: 'one-way' } })).toMatch(
      /One-way/,
    );
    expect(describe({ ...p, element: 'footing' })).toMatch(/P = 900 kN/);
  });
});
