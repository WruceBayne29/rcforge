import type { BeamDesign } from '../../is456';
import { CONCRETE, Dim, INK, Leader, spread } from './kit';
import type { P } from './kit';

/** Cross-section of the beam with the bars and stirrup as designed, drawn to scale. */
export function BeamSection({ design }: { design: BeamDesign }) {
  const { input, tension, top, shear } = design;
  const flanged = input.shape !== 'rectangular';
  const { b, D, cover, stirrupDiameter: st } = input;
  const bf = flanged ? Math.max(input.bf, b) : b;
  const W = 380;
  const H = 300;
  const boxW = 190;
  const boxH = 205;
  const s = Math.min(boxW / bf, boxH / D);
  const top0 = 38;
  // The web sits at the left for an L-beam, in the middle otherwise.
  const flangeLeft = 96 - (flanged ? Math.min(0, 0) : 0) + (boxW - bf * s) / 2;
  const webLeft = input.shape === 'ell' ? flangeLeft : flangeLeft + ((bf - b) * s) / 2;
  const webRight = webLeft + b * s;
  const bottom = top0 + D * s;
  const flangeBottom = top0 + (flanged ? input.Df : 0) * s;
  const outline: P[] = flanged
    ? [
        [flangeLeft, top0],
        [flangeLeft + bf * s, top0],
        [flangeLeft + bf * s, flangeBottom],
        [webRight, flangeBottom],
        [webRight, bottom],
        [webLeft, bottom],
        [webLeft, flangeBottom],
        [flangeLeft, flangeBottom],
      ]
    : [
        [webLeft, top0],
        [webRight, top0],
        [webRight, bottom],
        [webLeft, bottom],
      ];

  const inset = (cover + st / 2) * s;
  const barLeft = (dia: number) => webLeft + (cover + st + dia / 2) * s;
  const barRight = (dia: number) => webRight - (cover + st + dia / 2) * s;
  const radius = (dia: number) => Math.max((dia * s) / 2, 2.3);

  const perLayer = Math.ceil(tension.count / tension.layers);
  const gap = Math.max(tension.diameter, 25);
  const bottomBars: Array<{ x: number; y: number }> = [];
  let remaining = tension.count;
  for (let layer = 0; layer < tension.layers; layer++) {
    const n = Math.min(perLayer, remaining);
    remaining -= n;
    const y = bottom - (cover + st + tension.diameter / 2 + layer * (tension.diameter + gap)) * s;
    for (const x of spread(n, barLeft(tension.diameter), barRight(tension.diameter)))
      bottomBars.push({ x, y });
  }
  const topY = top0 + (cover + st + top.diameter / 2) * s;
  const topBars = spread(top.count, barLeft(top.diameter), barRight(top.diameter));
  const noteX = Math.max(webRight, flangeLeft + bf * s) + 22;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Beam cross-section">
      <polygon
        points={outline.map((p) => p.join(',')).join(' ')}
        fill={CONCRETE}
        stroke={INK}
        strokeWidth={1.6}
      />
      <rect
        x={webLeft + inset}
        y={top0 + inset}
        width={b * s - 2 * inset}
        height={D * s - 2 * inset}
        rx={Math.max(2, 2 * st * s)}
        fill="none"
        stroke={INK}
        strokeWidth={Math.max(1, st * s)}
      />
      {topBars.map((x) => (
        <circle
          key={`t${x}`}
          cx={x}
          cy={topY}
          r={radius(top.diameter)}
          fill={design.topIsStructural ? INK : CONCRETE}
          stroke={INK}
          strokeWidth={1}
        />
      ))}
      {bottomBars.map((p, k) => (
        <circle key={k} cx={p.x} cy={p.y} r={radius(tension.diameter)} fill={INK} />
      ))}

      <Dim from={[webLeft, bottom + 16]} to={[webRight, bottom + 16]} label={`${b}`} />
      <Dim from={[flangeLeft - 16, top0]} to={[flangeLeft - 16, bottom]} label={`${D}`} />
      {flanged && (
        <Dim
          from={[flangeLeft, top0 - 12]}
          to={[flangeLeft + bf * s, top0 - 12]}
          label={`bf = ${bf}`}
          side={-1}
        />
      )}
      {flanged && (
        <Dim
          from={[flangeLeft + bf * s + 10, top0]}
          to={[flangeLeft + bf * s + 10, flangeBottom]}
          label={`${input.Df}`}
          side={-1}
        />
      )}

      <Leader
        at={[topBars[topBars.length - 1], topY]}
        to={[noteX, topY + (flanged ? 26 : 0)]}
        text={`${top.count}–${top.diameter}φ ${design.topIsStructural ? 'compression' : 'hangers'}`}
      />
      <Leader
        at={[webRight - inset, (top0 + bottom) / 2]}
        to={[noteX, (top0 + bottom) / 2 + 6]}
        text={`${st}φ ${input.stirrupLegs}L @ ${shear.spacing}`}
      />
      <Leader
        at={[bottomBars[Math.min(perLayer, bottomBars.length) - 1].x, bottomBars[0].y]}
        to={[noteX, bottomBars[0].y]}
        text={`${tension.count}–${tension.diameter}φ${tension.layers > 1 ? `, ${tension.layers} layers` : ''}`}
      />
    </svg>
  );
}
