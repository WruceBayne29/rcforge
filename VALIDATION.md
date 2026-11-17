# Validation

RCForge's calculation engine is checked against **75 values in 14 groups**: numbers
printed in IS 456:2000 and SP 16, closed-form identities, and cross-checks between independent
routines. This file is generated from `tests/validation/cases.ts` by `npm run validation`, so it
cannot drift from the code, and the suite runs in CI on every push.

**How to read the tolerances.** The codes print values to two or three figures, and round their
own formulas independently (0.87 fy against fy/1.15, 0.36 against 0.3616). "Allowed" is the
difference that rounding permits for each value; it is not a fixed percentage.

**Basis.** *published* — the expected number is printed in the code or SP 16. *closed form* —
derived by hand from the stated formula. *cross-check* — two independent routines, or a table
against the equation behind it, must agree.

## What is not independently verified

- **Table 26** (two-way restrained slab coefficients) was typed in from memory. Tests check it
  against the yield-line equations it derives from, for smooth variation and for the 4/3 ratio
  between negative and positive moments, which would catch a mistyped digit — but it has not
  been compared line by line with a printed copy of the code. Check it before relying on it.
- **Table 20** (τc,max) and the bond stresses of cl. 26.2.1.1 are short tables typed in directly.
- The published values quoted from SP 16 were also entered from memory; they agree with the
  engine, which is computed from first principles, so an error would need to be the same in both.
- Complete worked design examples from textbooks are not reproduced here.

## Summary

| # | What is checked | Source | Basis | Values |
| --- | --- | --- | --- | ---: |
| V01 | Limiting neutral axis depth xu,max / d | IS 456 cl. 38.1 (note) | published | 3 |
| V02 | Limiting moment coefficient Mu,lim / (fck b d²) | IS 456 Annex G-1.1 (c); SP 16 Table C | published | 3 |
| V03 | Limiting percentage of tension steel pt,lim | SP 16 Table E | published | 6 |
| V04 | Design stress–strain curve of cold-worked bars | IS 456 Fig. 23A; SP 16 Table A | published | 8 |
| V05 | Design shear strength of concrete τc | IS 456 Table 19 | published | 11 |
| V06 | Development length in bar diameters | IS 456 cl. 26.2.1; SP 16 Table 65 | published | 6 |
| V07 | Minimum tension steel in beams, 100 As / (b d) = 85 / fy | IS 456 cl. 26.5.1.1 | closed form | 3 |
| V08 | Two-way slab coefficients, simply supported with corners free to lift | IS 456 Table 27 | published | 10 |
| V09 | Two-way restrained slab coefficients, square panels | IS 456 Table 26; positive αy = (24 + 2 Nd + 1.5 Nd²) / 1000 | cross-check | 6 |
| V10 | Concrete stress block from the parabolic–rectangular curve | IS 456 Fig. 21, 22: 0.36 fck xu acting at 0.42 xu | closed form | 3 |
| V11 | Design then analysis returns the design moment | Annex G-1.1 formula against the stress block (rounded independently in the code) | cross-check | 3 |
| V12 | Column section limits | IS 456 cl. 39.1; statics | closed form | 4 |
| V13 | Biaxial interaction exponent αn | IS 456 cl. 39.6 | published | 3 |
| V14 | Deflection modification factors | IS 456 Fig. 4 and Fig. 5 (values read from the curves) | published | 6 |

## Full results

### V01 — Limiting neutral axis depth xu,max / d

Source: IS 456 cl. 38.1 (note) · basis: published

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| Fe250 | 0.5300  | 0.5300  | 0 | 0.0001 |
| Fe415 | 0.4800  | 0.4800  | 0 | 0.0001 |
| Fe500 | 0.4600  | 0.4600  | 0 | 0.0001 |

### V02 — Limiting moment coefficient Mu,lim / (fck b d²)

Source: IS 456 Annex G-1.1 (c); SP 16 Table C · basis: published

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| Fe250 | 0.1490  | 0.1483  | 0.0007 | 0.0010 |
| Fe415 | 0.1380  | 0.1380  | 0.0000 | 0.0005 |
| Fe500 | 0.1330  | 0.1336  | 0.0006 | 0.0010 |

### V03 — Limiting percentage of tension steel pt,lim

Source: SP 16 Table E · basis: published

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| M20, Fe250 | 1.760 % | 1.754 % | 0.0055 | 0.0150 |
| M20, Fe415 | 0.9600 % | 0.9572 % | 0.0028 | 0.0150 |
| M25, Fe415 | 1.190 % | 1.197 % | 0.0065 | 0.0150 |
| M30, Fe415 | 1.430 % | 1.436 % | 0.0058 | 0.0150 |
| M20, Fe500 | 0.7600 % | 0.7614 % | 0.0014 | 0.0150 |
| M25, Fe500 | 0.9400 % | 0.9517 % | 0.0117 | 0.0150 |

### V04 — Design stress–strain curve of cold-worked bars

Source: IS 456 Fig. 23A; SP 16 Table A · basis: published

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| Fe415 at ε = 0.00144 | 288.7 MPa | 288.0 MPa | 0.7000 | 1.500 |
| Fe415 at ε = 0.00192 | 324.8 MPa | 324.7 MPa | 0.1489 | 1.500 |
| Fe415 at ε = 0.00276 | 351.8 MPa | 352.0 MPa | 0.2206 | 1.500 |
| Fe415 at ε = 0.00380 | 360.9 MPa | 361.0 MPa | 0.1047 | 1.500 |
| Fe500 at ε = 0.00174 | 347.8 MPa | 348.0 MPa | 0.2000 | 1.800 |
| Fe500 at ε = 0.00226 | 391.3 MPa | 391.6 MPa | 0.3069 | 1.800 |
| Fe500 at ε = 0.00417 | 434.8 MPa | 434.9 MPa | 0.1484 | 1.800 |
| Fe250 yields at 0.87 fy | 217.5 MPa | 217.5 MPa | 0 | 0.0100 |

### V05 — Design shear strength of concrete τc

Source: IS 456 Table 19 · basis: published

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| M20, pt = 0.15 % | 0.2800 MPa | 0.2875 MPa | 0.0075 | 0.0110 |
| M20, pt = 0.25 % | 0.3600 MPa | 0.3592 MPa | 0.0008 | 0.0110 |
| M20, pt = 0.50 % | 0.4800 MPa | 0.4785 MPa | 0.0015 | 0.0110 |
| M20, pt = 1.00 % | 0.6200 MPa | 0.6225 MPa | 0.0025 | 0.0110 |
| M20, pt = 1.50 % | 0.7200 MPa | 0.7161 MPa | 0.0039 | 0.0110 |
| M20, pt = 2.00 % | 0.7900 MPa | 0.7851 MPa | 0.0049 | 0.0110 |
| M25, pt = 0.50 % | 0.4900 MPa | 0.4889 MPa | 0.0011 | 0.0110 |
| M25, pt = 1.00 % | 0.6400 MPa | 0.6414 MPa | 0.0014 | 0.0110 |
| M25, pt = 2.00 % | 0.8200 MPa | 0.8178 MPa | 0.0022 | 0.0110 |
| Slab factor k, D = 175 mm | 1.250  | 1.250  | 0 | 0.0001 |
| Slab factor k, D = 250 mm | 1.100  | 1.100  | 0 | 0.0001 |

### V06 — Development length in bar diameters

Source: IS 456 cl. 26.2.1; SP 16 Table 65 · basis: published

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| M20, Fe415, tension | 47.000 φ | 47.012 φ | 0.0117 | 0.0500 |
| M25, Fe415, tension | 40.300 φ | 40.296 φ | 0.0042 | 0.0500 |
| M30, Fe415, tension | 37.600 φ | 37.609 φ | 0.0094 | 0.0500 |
| M20, Fe250, tension | 45.300 φ | 45.313 φ | 0.0125 | 0.0500 |
| M20, Fe415, compression | 37.600 φ | 37.609 φ | 0.0094 | 0.0500 |
| M20, Fe500, tension | 56.600 φ | 56.641 φ | 0.0406 | 0.0500 |

### V07 — Minimum tension steel in beams, 100 As / (b d) = 85 / fy

Source: IS 456 cl. 26.5.1.1 · basis: closed form

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| Fe250 | 0.3400 % | 0.3400 % | 0 | 0.0001 |
| Fe415 | 0.2048 % | 0.2048 % | 0.0000 | 0.0001 |
| Fe500 | 0.1700 % | 0.1700 % | 0 | 0.0001 |

### V08 — Two-way slab coefficients, simply supported with corners free to lift

Source: IS 456 Table 27 · basis: published

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| αx at ly/lx = 1 | 0.0620  | 0.0625  | 0.0005 | 0.0011 |
| αy at ly/lx = 1 | 0.0620  | 0.0625  | 0.0005 | 0.0011 |
| αx at ly/lx = 1.2 | 0.0840  | 0.0843  | 0.0003 | 0.0011 |
| αy at ly/lx = 1.2 | 0.0590  | 0.0586  | 0.0004 | 0.0011 |
| αx at ly/lx = 1.5 | 0.1040  | 0.1044  | 0.0004 | 0.0011 |
| αy at ly/lx = 1.5 | 0.0460  | 0.0464  | 0.0004 | 0.0011 |
| αx at ly/lx = 1.75 | 0.1130  | 0.1130  | 0.0000 | 0.0011 |
| αy at ly/lx = 1.75 | 0.0370  | 0.0369  | 0.0001 | 0.0011 |
| αx at ly/lx = 2 | 0.1180  | 0.1176  | 0.0004 | 0.0011 |
| αy at ly/lx = 2 | 0.0290  | 0.0294  | 0.0004 | 0.0011 |

### V09 — Two-way restrained slab coefficients, square panels

Source: IS 456 Table 26; positive αy = (24 + 2 Nd + 1.5 Nd²) / 1000 · basis: cross-check

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| Interior panel, positive (Nd = 0) | 0.0240  | 0.0240  | 0 | 0.0006 |
| One edge discontinuous (Nd = 1) | 0.0275  | 0.0280  | 0.0005 | 0.0006 |
| Two adjacent edges (Nd = 2) | 0.0340  | 0.0350  | 0.0010 | 0.0011 |
| Three edges (Nd = 3) | 0.0435  | 0.0430  | 0.0005 | 0.0006 |
| Four edges (Nd = 4) | 0.0560  | 0.0560  | 0 | 0.0006 |
| Interior panel, negative = 4/3 × positive | 0.0320  | 0.0320  | 0 | 0.0006 |

### V10 — Concrete stress block from the parabolic–rectangular curve

Source: IS 456 Fig. 21, 22: 0.36 fck xu acting at 0.42 xu · basis: closed form

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| Area coefficient (code rounds to 0.36) | 0.3600  | 0.3616  | 0.0016 | 0.0020 |
| Centroid depth (code rounds to 0.42) | 0.4200  | 0.4160  | 0.0040 | 0.0050 |
| Exact area coefficient 0.67/1.5 × 17/21 | 0.3616  | 0.3616  | 0 | 0.0000 |

### V11 — Design then analysis returns the design moment

Source: Annex G-1.1 formula against the stress block (rounded independently in the code) · basis: cross-check

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| Singly reinforced, Mu = 120 kN·m | 120.0 kN·m | 119.8 kN·m | 0.1962 | 0.6000 |
| Doubly reinforced, Mu = 260 kN·m | 260.0 kN·m | 260.0 kN·m | 0.0487 | 0.3000 |
| Balanced steel at Mu,lim | 1346.1 mm² | 1340.3 mm² | 5.754 | 7.000 |

### V12 — Column section limits

Source: IS 456 cl. 39.1; statics · basis: closed form

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| Strain at 3D/7 with the neutral axis outside | 0.0020  | 0.0020  | 0 | 0.0000 |
| Uniform strain in pure compression | 0.0020  | 0.0020  | 0.0000 | 0.0000 |
| Squash load 0.446 fck Ac + fs(0.002) Asc | 2303.1 kN | 2303.1 kN | 0.0000 | 0.0100 |
| Pure bending agrees with the beam routine | 115.4 kN·m | 115.6 kN·m | 0.2513 | 0.4615 |

### V13 — Biaxial interaction exponent αn

Source: IS 456 cl. 39.6 · basis: published

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| Pu/Puz = 0.2 | 1.000  | 1.000  | 0 | 0.0000 |
| Pu/Puz = 0.5 | 1.500  | 1.500  | 0 | 0.0000 |
| Pu/Puz = 0.8 | 2.000  | 2.000  | 0 | 0.0000 |

### V14 — Deflection modification factors

Source: IS 456 Fig. 4 and Fig. 5 (values read from the curves) · basis: published

| Quantity | Expected | RCForge | Difference | Allowed |
| --- | ---: | ---: | ---: | ---: |
| Fig. 4: fs = 240 MPa, pt = 0.6 % | 1.160  | 1.164  | 0.0039 | 0.0500 |
| Fig. 4: fs = 240 MPa, pt = 1.2 % | 0.9500  | 0.9548  | 0.0048 | 0.0400 |
| Fig. 4: fs = 145 MPa, pt = 1.0 % | 1.450  | 1.445  | 0.0047 | 0.0500 |
| Fig. 4: upper limit | 2.000  | 2.000  | 0 | 0.0000 |
| Fig. 5: pc = 1.0 % | 1.250  | 1.250  | 0 | 0.0100 |
| Fig. 5: upper limit | 1.500  | 1.500  | 0 | 0.0000 |
