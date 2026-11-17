# LinkedIn post

> **Before you post — read this once.** The numbers come from the repo (`npm run coverage`,
> `VALIDATION.md`, `npm run e2e`). The post says the code was written by an AI coding agent from
> your specification, because it was; anyone who opens the commit history will see that, and
> saying it yourself reads better than being asked. Two things to do first: (1) read
> `docs/THEORY.md` so you can explain any line of a sheet, and (2) check **Table 26** in
> `src/is456/slab.ts` against a printed copy of IS 456 — it was entered from memory and is the one
> part of the tool not independently verified (see `VALIDATION.md`). Attach
> `docs/screenshots/hero.gif` as the post's media.

---

**Design software gives you the answer. My professors want the working. So I built a tool that
gives both.**

RCForge designs reinforced concrete beams, columns, slabs and footings to IS 456 : 2000 and writes
out the full calculation the way we are taught to: clause on the left, working in the middle,
result on the right.

🔗 Try it: https://wrucebayne29.github.io/rcforge/
💻 Code: https://github.com/WruceBayne29/rcforge

What it does:

▪️ Beams: singly, doubly reinforced and T-sections, with shear, deflection and anchorage checks
▪️ Columns: interaction diagrams worked out from strain compatibility, slenderness and biaxial bending
▪️ Slabs: one-way and two-way, including all nine edge conditions of Table 26
▪️ Footings: sizing, one-way shear, punching shear and flexure
▪️ A to-scale drawing, a bar schedule and a PDF calculation sheet for each

Change the depth of a beam and the whole sheet recalculates in front of you. You can see exactly
which step changed, which is the part that helped me most while studying.

How I built it: I wrote the specification and the quality bar, and used Claude Code as an AI
coding agent to implement it. Deciding what "correct" should mean was the real work. The engine is
checked against 75 values printed in IS 456 and SP 16 or derived by hand, and the repo lists
plainly what has not been independently verified.

This is the second tool in a set. The first, FrameForge, analyses steel frames and trusses:
https://github.com/WruceBayne29/frameforge

It is free and open source. If you teach or study RC design, I would be grateful if you tried a
problem you already know the answer to and told me where the sheet disagrees with you.

#CivilEngineering #StructuralEngineering #ReinforcedConcrete #IS456 #OpenSource #BITSPilani
