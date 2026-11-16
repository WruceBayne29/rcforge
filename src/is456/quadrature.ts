const POINTS: ReadonlyArray<readonly [number, number]> = [
  [-Math.sqrt(3 / 5), 5 / 9],
  [0, 8 / 9],
  [Math.sqrt(3 / 5), 5 / 9],
];

/** Integrates f over [a, b] with 3-point Gauss–Legendre quadrature (exact up to degree 5). */
export function gauss3(f: (x: number) => number, a: number, b: number): number {
  const half = (b - a) / 2;
  const mid = (a + b) / 2;
  let sum = 0;
  for (const [xi, w] of POINTS) sum += w * f(mid + half * xi);
  return sum * half;
}
