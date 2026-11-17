# CV bullets

Numbers are taken from the repository and can be reproduced: tests and coverage from
`npm run coverage`, validation from `VALIDATION.md`, end-to-end checks from `npm run e2e`.

**RCForge — reinforced concrete design to IS 456 : 2000 in the browser** · TypeScript, React, Vite ·
[live](https://wrucebayne29.github.io/rcforge/) · [source](https://github.com/WruceBayne29/rcforge)

- Specified and shipped an open-source design tool for RC beams, columns, slabs and footings to
  **IS 456 : 2000** that writes out every calculation step with its clause reference; engine
  checked against **75 published and closed-form values** with **99 % test coverage** across
  170+ automated tests.
- Implemented column **P–M interaction diagrams from first principles** (strain compatibility
  over rectangular and circular sections) with slenderness and biaxial bending checks, plus
  flexure, shear, deflection and anchorage design for singly, doubly reinforced and flanged beams.
- Delivered to-scale section drawings, bar bending schedules and a generated **PDF calculation
  sheet**, deployed by a GitHub Actions CI/CD pipeline and verified by a **58-check Playwright
  end-to-end suite** on the live site.

## A note on wording

The implementation was written by an AI coding agent (Claude Code) working from your
specification, so the bullets say "specified and shipped", "implemented" and "delivered" in the
sense of directing the work. If an interviewer asks, say so plainly and then explain a sheet line
by line; `docs/THEORY.md` covers what you would be asked. If you would rather not use
"implemented" for the second bullet, "Directed the implementation of…" is the stricter phrasing.

Shorter variants:

- Built RCForge, an open-source IS 456 : 2000 design tool for beams, columns, slabs and footings
  that shows every step of the calculation.
- Column interaction diagrams from strain compatibility; 75 code values validated; 99 % coverage.
- Shipped with CI/CD to GitHub Pages and a 58-check end-to-end suite.
