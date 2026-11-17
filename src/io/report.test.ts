import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../model/examples';
import { solve } from '../model/project';
import { buildReport, pdfText, reportFileName } from './report';

describe('PDF calculation sheet', () => {
  for (const example of EXAMPLES) {
    it(`builds a sheet for ${example.id}`, () => {
      const project = example.build();
      const outcome = solve(project);
      if (!outcome.ok) throw new Error('example does not solve');
      const doc = buildReport({
        project,
        design: outcome.design,
        date: new Date('2026-01-02T00:00:00Z'),
      });
      const bytes = new Uint8Array(doc.output('arraybuffer'));
      expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
      expect(bytes.length).toBeGreaterThan(5000);
    });
  }

  it('embeds figures when they are supplied', () => {
    const project = EXAMPLES[0].build();
    const outcome = solve(project);
    if (!outcome.ok) throw new Error('example does not solve');
    // A 1×1 transparent PNG.
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const plain = buildReport({ project, design: outcome.design });
    const withFigure = buildReport({
      project: { ...project, author: 'A. Student' },
      design: outcome.design,
      figures: [
        { dataUrl, width: 380, height: 300 },
        { dataUrl, width: 380, height: 30000 },
      ],
    });
    expect(withFigure.output('arraybuffer').byteLength).toBeGreaterThan(
      plain.output('arraybuffer').byteLength,
    );
  });

  it('writes symbols out for the built-in fonts and names the file', () => {
    expect(pdfText('τv ≤ τc,max, 3–20φ, √fck × d′ ✓')).toBe(
      "tau_v <= tau_c,max, 3-20 dia, sqrt fck × d' OK",
    );
    expect(pdfText('αx⁻ = 0.047 ☃')).toBe('alpha_x- = 0.047 ?');
    expect(pdfText('Title\nline one\nline two')).toBe('Title\nline one\nline two');
    expect(reportFileName(EXAMPLES[0].build())).toBe('floor-beam-b1-beam.pdf');
    expect(reportFileName({ ...EXAMPLES[0].build(), title: '??' })).toBe('rcforge-beam.pdf');
  });
});
