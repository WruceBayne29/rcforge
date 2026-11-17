# Contributing to RCForge

Thank you for looking. RCForge is a learning tool, and the most valuable contribution is finding
a number that is wrong.

## Getting set up

```bash
git clone https://github.com/WruceBayne29/rcforge.git
cd rcforge
npm install
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app with hot reload |
| `npm test` | Unit tests and the validation suite |
| `npm run coverage` | Tests with coverage; thresholds are enforced on `src/is456` |
| `npm run check` | Lint, tests and a production build. Run it before every commit |
| `npm run validation` | Regenerate `VALIDATION.md` from the validation suite |
| `npm run e2e` | Playwright script that uses every feature of the live site |
| `npm run screenshots` | Regenerate the README screenshots (needs `npm run dev` running) |

## How the code is arranged

```
src/is456/   The calculations. Pure TypeScript, no React, no DOM. One file per topic.
src/model/   The project document, input validation, worked examples.
src/io/      JSON files, share links, the PDF sheet.
src/ui/      React: forms, the sheet, drawings.
tests/validation/   Published values and closed forms the engine must reproduce.
```

Every design routine returns its numbers **and** the steps that produced them
(`src/is456/steps.ts`): a clause reference, the lines of working, and the value carried to the
output column. If you add a calculation, add its steps; the sheet and the PDF are built from them.

## Rules

- Strict TypeScript, no `any`. ESLint and Prettier must be clean.
- `src/is456` stays above 90 % test coverage.
- **Expected values in tests must be independent of the code under test**: a number printed in
  IS 456 or SP 16, or a hand calculation written out in a comment. A test that recomputes the
  same formula proves nothing.
- **Code tables**: generate them from the underlying formula when the code gives one. If a table
  has to be typed in, add a test that would catch a mistyped digit (smoothness, a known ratio,
  agreement with a related equation) and list the table under "What is not independently
  verified" in `VALIDATION.md`.
- Units at function boundaries: mm, m for spans, kN, kN·m, MPa. Say so in the doc comment.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`).

## Adding a worked example

Add an entry to `src/model/examples.ts`. `src/model/model.test.ts` requires every example to
produce a design that does not fail.

## Adding an element or a check

1. Write the calculation in `src/is456/`, returning results and steps.
2. Test it against values you can source.
3. Add its inputs to `src/model/project.ts` (with range checks) and a form in `src/ui/forms/`.
4. Draw it in `src/ui/drawings/`. Set colours as SVG attributes, not CSS classes, so the drawing
   can be placed in the PDF.

## Reporting a wrong result

Use the "Wrong result" issue template. Include the share link, the step that is wrong, the value
you expected and where it comes from.
