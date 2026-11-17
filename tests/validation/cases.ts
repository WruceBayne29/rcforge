/**
 * Validation: values published in IS 456:2000 and SP 16, and closed-form identities, compared
 * with what the engine computes. Published values are printed to two or three figures, so each
 * check carries the tolerance its source allows.
 */
import {
  bendingSection,
  biaxialExponent,
  blockCoefficients,
  capacityRectangular,
  compressionFactor,
  DEFAULT_COLUMN,
  designRectangular,
  developmentLength,
  extremeStrain,
  findSteel,
  limitingValues,
  minimumTensionSteel,
  momentCapacity,
  restrainedCoefficients,
  shearStrengthConcrete,
  simplySupportedCoefficients,
  slabShearFactor,
  squashLoad,
  steelStress,
  tensionFactor,
  xuMaxRatio,
  barArea,
} from '../../src/is456';

export interface ValidationCheck {
  quantity: string;
  expected: number;
  actual: number;
  /** Absolute tolerance, set by the precision of the published value. */
  tolerance: number;
  unit: string;
}

export interface ValidationCase {
  id: string;
  title: string;
  source: string;
  /** How the expected values were obtained. */
  basis: 'published' | 'closed form' | 'cross-check';
  run: () => ValidationCheck[];
}

const check = (
  quantity: string,
  expected: number,
  actual: number,
  tolerance: number,
  unit = '',
): ValidationCheck => ({ quantity, expected, actual, tolerance, unit });

const Fe250 = findSteel('Fe250');
const Fe415 = findSteel('Fe415');
const Fe500 = findSteel('Fe500');

export const VALIDATION_CASES: ValidationCase[] = [
  {
    id: 'V01',
    title: 'Limiting neutral axis depth xu,max / d',
    source: 'IS 456 cl. 38.1 (note)',
    basis: 'published',
    run: () => [
      check('Fe250', 0.53, xuMaxRatio(250), 0.0001),
      check('Fe415', 0.48, xuMaxRatio(415), 0.0001),
      check('Fe500', 0.46, xuMaxRatio(500), 0.0001),
    ],
  },
  {
    id: 'V02',
    title: 'Limiting moment coefficient Mu,lim / (fck b d²)',
    source: 'IS 456 Annex G-1.1 (c); SP 16 Table C',
    basis: 'published',
    run: () => [
      check('Fe250', 0.149, limitingValues(300, 500, 20, 250).coefficient, 0.001),
      check('Fe415', 0.138, limitingValues(300, 500, 20, 415).coefficient, 0.0005),
      check('Fe500', 0.133, limitingValues(300, 500, 20, 500).coefficient, 0.001),
    ],
  },
  {
    id: 'V03',
    title: 'Limiting percentage of tension steel pt,lim',
    source: 'SP 16 Table E',
    basis: 'published',
    run: () => [
      check('M20, Fe250', 1.76, limitingValues(250, 450, 20, 250).ptLim, 0.015, '%'),
      check('M20, Fe415', 0.96, limitingValues(250, 450, 20, 415).ptLim, 0.015, '%'),
      check('M25, Fe415', 1.19, limitingValues(250, 450, 25, 415).ptLim, 0.015, '%'),
      check('M30, Fe415', 1.43, limitingValues(250, 450, 30, 415).ptLim, 0.015, '%'),
      check('M20, Fe500', 0.76, limitingValues(250, 450, 20, 500).ptLim, 0.015, '%'),
      check('M25, Fe500', 0.94, limitingValues(250, 450, 25, 500).ptLim, 0.015, '%'),
    ],
  },
  {
    id: 'V04',
    title: 'Design stress–strain curve of cold-worked bars',
    source: 'IS 456 Fig. 23A; SP 16 Table A',
    basis: 'published',
    run: () => [
      check('Fe415 at ε = 0.00144', 288.7, steelStress(0.00144, Fe415), 1.5, 'MPa'),
      check('Fe415 at ε = 0.00192', 324.8, steelStress(0.00192, Fe415), 1.5, 'MPa'),
      check('Fe415 at ε = 0.00276', 351.8, steelStress(0.00276, Fe415), 1.5, 'MPa'),
      check('Fe415 at ε = 0.00380', 360.9, steelStress(0.0038, Fe415), 1.5, 'MPa'),
      check('Fe500 at ε = 0.00174', 347.8, steelStress(0.00174, Fe500), 1.8, 'MPa'),
      check('Fe500 at ε = 0.00226', 391.3, steelStress(0.00226, Fe500), 1.8, 'MPa'),
      check('Fe500 at ε = 0.00417', 434.8, steelStress(0.00417, Fe500), 1.8, 'MPa'),
      check('Fe250 yields at 0.87 fy', 217.5, steelStress(0.005, Fe250), 0.01, 'MPa'),
    ],
  },
  {
    id: 'V05',
    title: 'Design shear strength of concrete τc',
    source: 'IS 456 Table 19',
    basis: 'published',
    run: () => [
      check('M20, pt = 0.15 %', 0.28, shearStrengthConcrete(20, 0.15), 0.011, 'MPa'),
      check('M20, pt = 0.25 %', 0.36, shearStrengthConcrete(20, 0.25), 0.011, 'MPa'),
      check('M20, pt = 0.50 %', 0.48, shearStrengthConcrete(20, 0.5), 0.011, 'MPa'),
      check('M20, pt = 1.00 %', 0.62, shearStrengthConcrete(20, 1.0), 0.011, 'MPa'),
      check('M20, pt = 1.50 %', 0.72, shearStrengthConcrete(20, 1.5), 0.011, 'MPa'),
      check('M20, pt = 2.00 %', 0.79, shearStrengthConcrete(20, 2.0), 0.011, 'MPa'),
      check('M25, pt = 0.50 %', 0.49, shearStrengthConcrete(25, 0.5), 0.011, 'MPa'),
      check('M25, pt = 1.00 %', 0.64, shearStrengthConcrete(25, 1.0), 0.011, 'MPa'),
      check('M25, pt = 2.00 %', 0.82, shearStrengthConcrete(25, 2.0), 0.011, 'MPa'),
      check('Slab factor k, D = 175 mm', 1.25, slabShearFactor(175), 0.0001),
      check('Slab factor k, D = 250 mm', 1.1, slabShearFactor(250), 0.0001),
    ],
  },
  {
    id: 'V06',
    title: 'Development length in bar diameters',
    source: 'IS 456 cl. 26.2.1; SP 16 Table 65',
    basis: 'published',
    run: () => [
      check('M20, Fe415, tension', 47.0, developmentLength(16, 20, Fe415) / 16, 0.05, 'φ'),
      check('M25, Fe415, tension', 40.3, developmentLength(16, 25, Fe415) / 16, 0.05, 'φ'),
      check('M30, Fe415, tension', 37.6, developmentLength(16, 30, Fe415) / 16, 0.05, 'φ'),
      check('M20, Fe250, tension', 45.3, developmentLength(16, 20, Fe250) / 16, 0.05, 'φ'),
      check(
        'M20, Fe415, compression',
        37.6,
        developmentLength(16, 20, Fe415, true) / 16,
        0.05,
        'φ',
      ),
      check('M20, Fe500, tension', 56.6, developmentLength(16, 20, Fe500) / 16, 0.05, 'φ'),
    ],
  },
  {
    id: 'V07',
    title: 'Minimum tension steel in beams, 100 As / (b d) = 85 / fy',
    source: 'IS 456 cl. 26.5.1.1',
    basis: 'closed form',
    run: () => [
      check('Fe250', 0.34, (100 * minimumTensionSteel(300, 500, 250)) / 150000, 0.0001, '%'),
      check('Fe415', 0.2048, (100 * minimumTensionSteel(300, 500, 415)) / 150000, 0.0001, '%'),
      check('Fe500', 0.17, (100 * minimumTensionSteel(300, 500, 500)) / 150000, 0.0001, '%'),
    ],
  },
  {
    id: 'V08',
    title: 'Two-way slab coefficients, simply supported with corners free to lift',
    source: 'IS 456 Table 27',
    basis: 'published',
    run: () =>
      (
        [
          [1.0, 0.062, 0.062],
          [1.2, 0.084, 0.059],
          [1.5, 0.104, 0.046],
          [1.75, 0.113, 0.037],
          [2.0, 0.118, 0.029],
        ] as const
      ).flatMap(([r, ax, ay]) => [
        check(`αx at ly/lx = ${r}`, ax, simplySupportedCoefficients(r).alphaX, 0.0011),
        check(`αy at ly/lx = ${r}`, ay, simplySupportedCoefficients(r).alphaY, 0.0011),
      ]),
  },
  {
    id: 'V09',
    title: 'Two-way restrained slab coefficients, square panels',
    source: 'IS 456 Table 26; positive αy = (24 + 2 Nd + 1.5 Nd²) / 1000',
    basis: 'cross-check',
    run: () => [
      check(
        'Interior panel, positive (Nd = 0)',
        0.024,
        restrainedCoefficients(1, 1).shortPositive,
        0.0006,
      ),
      check(
        'One edge discontinuous (Nd = 1)',
        0.0275,
        restrainedCoefficients(2, 1).longPositive,
        0.0006,
      ),
      check(
        'Two adjacent edges (Nd = 2)',
        0.034,
        restrainedCoefficients(4, 1).longPositive,
        0.0011,
      ),
      check('Three edges (Nd = 3)', 0.0435, restrainedCoefficients(7, 1).longPositive, 0.0006),
      check('Four edges (Nd = 4)', 0.056, restrainedCoefficients(9, 1).longPositive, 0.0006),
      check(
        'Interior panel, negative = 4/3 × positive',
        0.032,
        restrainedCoefficients(1, 1).shortNegative,
        0.0006,
      ),
    ],
  },
  {
    id: 'V10',
    title: 'Concrete stress block from the parabolic–rectangular curve',
    source: 'IS 456 Fig. 21, 22: 0.36 fck xu acting at 0.42 xu',
    basis: 'closed form',
    run: () => [
      check('Area coefficient (code rounds to 0.36)', 0.36, blockCoefficients().area, 0.002),
      check('Centroid depth (code rounds to 0.42)', 0.42, blockCoefficients().centroid, 0.005),
      check(
        'Exact area coefficient 0.67/1.5 × 17/21',
        (0.67 / 1.5) * (17 / 21),
        blockCoefficients().area,
        1e-9,
      ),
    ],
  },
  {
    id: 'V11',
    title: 'Design then analysis returns the design moment',
    source: 'Annex G-1.1 formula against the stress block (rounded independently in the code)',
    basis: 'cross-check',
    run: () => {
      const section = { b: 250, d: 450, dc: 40, fck: 25, steel: Fe415 };
      const singly = designRectangular(section, 120);
      const doubly = designRectangular(section, 260);
      return [
        check(
          'Singly reinforced, Mu = 120 kN·m',
          120,
          capacityRectangular(section, singly.Ast).Mu,
          0.6,
          'kN·m',
        ),
        check(
          'Doubly reinforced, Mu = 260 kN·m',
          260,
          capacityRectangular(section, doubly.Ast, doubly.Asc).Mu,
          0.3,
          'kN·m',
        ),
        check(
          'Balanced steel at Mu,lim',
          singly.limits.AstLim,
          designRectangular(section, singly.limits.MuLim).Ast,
          7,
          'mm²',
        ),
      ];
    },
  },
  {
    id: 'V12',
    title: 'Column section limits',
    source: 'IS 456 cl. 39.1; statics',
    basis: 'closed form',
    run: () => {
      const sx = bendingSection(DEFAULT_COLUMN, 'x');
      const Asc = 8 * barArea(20);
      const squash = ((0.67 * 25) / 1.5) * (300 * 450 - Asc) + steelStress(0.002, Fe415) * Asc;
      const beamLike = {
        ...sx,
        bars: [[392, 3 * barArea(20)]] as Array<[number, number]>,
      };
      const beam = capacityRectangular(
        { b: 300, d: 392, dc: 40, fck: 25, steel: Fe415 },
        3 * barArea(20),
      );
      return [
        check(
          'Strain at 3D/7 with the neutral axis outside',
          0.002,
          (extremeStrain(900, 450) * (900 - (3 * 450) / 7)) / 900,
          1e-9,
        ),
        check('Uniform strain in pure compression', 0.002, extremeStrain(1e9, 450), 1e-9),
        check('Squash load 0.446 fck Ac + fs(0.002) Asc', squash / 1e3, squashLoad(sx), 0.01, 'kN'),
        check(
          'Pure bending agrees with the beam routine',
          beam.Mu,
          momentCapacity(beamLike, 0).M,
          0.004 * beam.Mu,
          'kN·m',
        ),
      ];
    },
  },
  {
    id: 'V13',
    title: 'Biaxial interaction exponent αn',
    source: 'IS 456 cl. 39.6',
    basis: 'published',
    run: () => [
      check('Pu/Puz = 0.2', 1.0, biaxialExponent(0.2), 1e-9),
      check('Pu/Puz = 0.5', 1.5, biaxialExponent(0.5), 1e-9),
      check('Pu/Puz = 0.8', 2.0, biaxialExponent(0.8), 1e-9),
    ],
  },
  {
    id: 'V14',
    title: 'Deflection modification factors',
    source: 'IS 456 Fig. 4 and Fig. 5 (values read from the curves)',
    basis: 'published',
    run: () => [
      check('Fig. 4: fs = 240 MPa, pt = 0.6 %', 1.16, tensionFactor(240, 0.6), 0.05),
      check('Fig. 4: fs = 240 MPa, pt = 1.2 %', 0.95, tensionFactor(240, 1.2), 0.04),
      check('Fig. 4: fs = 145 MPa, pt = 1.0 %', 1.45, tensionFactor(145, 1.0), 0.05),
      check('Fig. 4: upper limit', 2.0, tensionFactor(145, 0.3), 1e-9),
      check('Fig. 5: pc = 1.0 %', 1.25, compressionFactor(1), 0.01),
      check('Fig. 5: upper limit', 1.5, compressionFactor(3), 1e-9),
    ],
  },
];
