import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VALIDATION_CASES } from './cases';

function fmt(v: number): string {
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(3);
  return v.toFixed(4);
}

const rows: string[] = [];
const summary: string[] = [];

describe('validation against IS 456 / SP 16 published values and closed forms', () => {
  for (const vcase of VALIDATION_CASES) {
    describe(`${vcase.id} ${vcase.title}`, () => {
      const checks = vcase.run();
      rows.push(
        `\n### ${vcase.id} — ${vcase.title}\n`,
        `Source: ${vcase.source} · basis: ${vcase.basis}\n`,
      );
      rows.push(
        '| Quantity | Expected | RCForge | Difference | Allowed |',
        '| --- | ---: | ---: | ---: | ---: |',
      );
      summary.push(
        `| ${vcase.id} | ${vcase.title} | ${vcase.source} | ${vcase.basis} | ${checks.length} |`,
      );
      for (const c of checks) {
        const diff = Math.abs(c.actual - c.expected);
        rows.push(
          `| ${c.quantity} | ${fmt(c.expected)} ${c.unit} | ${fmt(c.actual)} ${c.unit} | ${fmt(diff)} | ${fmt(c.tolerance)} |`,
        );
        it(c.quantity, () => {
          expect(diff).toBeLessThanOrEqual(c.tolerance);
        });
      }
    });
  }

  it('writes VALIDATION.md when WRITE_VALIDATION=1', () => {
    if (process.env.WRITE_VALIDATION !== '1') return;
    const total = VALIDATION_CASES.reduce((n, c) => n + c.run().length, 0);
    const table = [
      '| # | What is checked | Source | Basis | Values |',
      '| --- | --- | --- | --- | ---: |',
      ...summary,
    ];
    const header = [
      '# Validation',
      '',
      `RCForge's calculation engine is checked against **${total} values in ${VALIDATION_CASES.length} groups**: numbers`,
      'printed in IS 456:2000 and SP 16, closed-form identities, and cross-checks between independent',
      'routines. This file is generated from `tests/validation/cases.ts` by `npm run validation`, so it',
      'cannot drift from the code, and the suite runs in CI on every push.',
      '',
      '**How to read the tolerances.** The codes print values to two or three figures, and round their',
      'own formulas independently (0.87 fy against fy/1.15, 0.36 against 0.3616). "Allowed" is the',
      'difference that rounding permits for each value; it is not a fixed percentage.',
      '',
      '**Basis.** *published* — the expected number is printed in the code or SP 16. *closed form* —',
      'derived by hand from the stated formula. *cross-check* — two independent routines, or a table',
      'against the equation behind it, must agree.',
      '',
      '## What is not independently verified',
      '',
      '- **Table 26** (two-way restrained slab coefficients) was typed in from memory. Tests check it',
      '  against the yield-line equations it derives from, for smooth variation and for the 4/3 ratio',
      '  between negative and positive moments, which would catch a mistyped digit — but it has not',
      '  been compared line by line with a printed copy of the code. Check it before relying on it.',
      '- **Table 20** (τc,max) and the bond stresses of cl. 26.2.1.1 are short tables typed in directly.',
      '- The published values quoted from SP 16 were also entered from memory; they agree with the',
      '  engine, which is computed from first principles, so an error would need to be the same in both.',
      '- Complete worked design examples from textbooks are not reproduced here.',
      '',
      '## Summary',
      '',
      ...table,
      '',
      '## Full results',
    ];
    writeFileSync('VALIDATION.md', [...header, ...rows, ''].join('\n'));
    const readme = readFileSync('README.md', 'utf8');
    const start = '<!-- validation:start -->';
    const end = '<!-- validation:end -->';
    if (readme.includes(start) && readme.includes(end)) {
      const block = [
        start,
        `**${total} values in ${VALIDATION_CASES.length} groups.**`,
        '',
        ...table,
        end,
      ].join('\n');
      writeFileSync(
        'README.md',
        readme.slice(0, readme.indexOf(start)) +
          block +
          readme.slice(readme.indexOf(end) + end.length),
      );
    }
  });
});
