import type { FootingDesign, SlabDesign } from '../../is456';
import { CONCRETE, Dim, INK, MONO, SOFT, spread } from './kit';

/** Section through one metre of slab, cut parallel to the short span. */
export function SlabSection({ design }: { design: SlabDesign }) {
  const { input, steel, distribution } = design;
  const W = 380;
  const H = 190;
  const left = 40;
  const width = 300;
  const depth = Math.min(96, Math.max(46, input.D * 0.42));
  const top = 34;
  const sy = depth / input.D;
  const sx = width / 1000;
  const main = steel.find((s) => s.direction === 'short' && s.face === 'bottom') ?? steel[0];
  const topSteel = steel.find((s) => s.direction === 'short' && s.face === 'top');
  const longBottom = steel.find((s) => s.direction === 'long' && s.face === 'bottom');
  const crossSpacing = longBottom?.spacing ?? distribution?.spacing ?? 250;
  const crossDia = longBottom?.diameter ?? distribution?.diameter ?? 8;
  const r = (dia: number) => Math.max((dia * sy) / 2, 2);
  const cantilever = main.face === 'top';
  const yMain = cantilever
    ? top + (input.cover + main.diameter / 2) * sy
    : top + depth - (input.cover + main.diameter / 2) * sy;
  const yCross = cantilever
    ? yMain + (main.diameter / 2 + crossDia / 2) * sy
    : yMain - (main.diameter / 2 + crossDia / 2) * sy;
  const dots = spread(
    Math.max(2, Math.floor(1000 / crossSpacing) + 1),
    left + 14,
    left + width - 14,
  );
  const yTop = top + (input.cover + (topSteel?.diameter ?? 10) / 2) * sy;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Slab section">
      <rect
        x={left}
        y={top}
        width={width}
        height={depth}
        fill={CONCRETE}
        stroke={INK}
        strokeWidth={1.6}
      />
      <line
        x1={left + 8}
        y1={yMain}
        x2={left + width - 8}
        y2={yMain}
        stroke={INK}
        strokeWidth={Math.max(1.6, main.diameter * sy)}
        strokeLinecap="round"
      />
      {dots.map((x) => (
        <circle key={x} cx={x} cy={yCross} r={r(crossDia)} fill={INK} />
      ))}
      {topSteel && !cantilever && (
        <>
          <line
            x1={left + 8}
            y1={yTop}
            x2={left + width * 0.3}
            y2={yTop}
            stroke={INK}
            strokeWidth={Math.max(1.6, topSteel.diameter * sy)}
            strokeLinecap="round"
          />
          <line
            x1={left + width * 0.7}
            y1={yTop}
            x2={left + width - 8}
            y2={yTop}
            stroke={INK}
            strokeWidth={Math.max(1.6, topSteel.diameter * sy)}
            strokeLinecap="round"
          />
        </>
      )}
      <Dim
        from={[left, top + depth + 14]}
        to={[left + width, top + depth + 14]}
        label="1000 (one metre strip)"
      />
      <Dim from={[left - 14, top]} to={[left - 14, top + depth]} label={`${input.D}`} />
      <g fontFamily={MONO} fontSize={10.5} fill={INK}>
        <text x={left} y={top - 20}>
          {cantilever ? 'Top' : 'Bottom'}, short span: {main.diameter}φ @ {main.spacing} c/c
        </text>
        <text x={left} y={top - 7} fill={SOFT}>
          {longBottom ? 'Long span' : 'Distribution'}: {crossDia}φ @ {crossSpacing} c/c
          {topSteel && !cantilever
            ? ` · top at supports: ${topSteel.diameter}φ @ ${topSteel.spacing}`
            : ''}
        </text>
      </g>
      <text x={left + width} y={H - 6} fill={SOFT} fontFamily={MONO} fontSize={9} textAnchor="end">
        depth drawn {(sy / sx).toFixed(1)}× for clarity
      </text>
    </svg>
  );
}

/** Plan and section of the footing with the bars in both directions. */
export function FootingDrawing({ design }: { design: FootingDesign }) {
  const { input, L, B, D, steel } = design;
  const W = 380;
  const H = 430;
  const s = Math.min(230 / L, 190 / B);
  const cx = 190;
  const planTop = 22;
  const left = cx - (L * s) / 2;
  const planBottom = planTop + B * s;
  const cyPlan = planTop + (B * s) / 2;
  const colW = input.cx * s;
  const colH = input.cy * s;
  const along = steel.find((b) => b.direction === 'L') ?? steel[0];
  const across = steel.find((b) => b.direction === 'B') ?? steel[0];
  const edge = (input.cover + input.barDiameter / 2) * s;
  const secTop = planBottom + 96;
  const padH = Math.max(D * s, 26);
  const stub = 34;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Footing plan and section">
      <rect
        x={left}
        y={planTop}
        width={L * s}
        height={B * s}
        fill={CONCRETE}
        stroke={INK}
        strokeWidth={1.6}
      />
      {spread(along.count, planTop + edge, planBottom - edge).map((y) => (
        <line
          key={`a${y}`}
          x1={left + edge}
          y1={y}
          x2={left + L * s - edge}
          y2={y}
          stroke={INK}
          strokeWidth={0.7}
        />
      ))}
      {spread(across.count, left + edge, left + L * s - edge).map((x) => (
        <line
          key={`b${x}`}
          x1={x}
          y1={planTop + edge}
          x2={x}
          y2={planBottom - edge}
          stroke={INK}
          strokeWidth={0.7}
          strokeDasharray="4 2"
        />
      ))}
      <rect
        x={cx - colW / 2}
        y={cyPlan - colH / 2}
        width={colW}
        height={colH}
        fill="#fcfaf5"
        stroke={INK}
        strokeWidth={1.6}
      />
      <line
        x1={cx - colW / 2}
        y1={cyPlan - colH / 2}
        x2={cx + colW / 2}
        y2={cyPlan + colH / 2}
        stroke={INK}
        strokeWidth={0.8}
      />
      <line
        x1={cx + colW / 2}
        y1={cyPlan - colH / 2}
        x2={cx - colW / 2}
        y2={cyPlan + colH / 2}
        stroke={INK}
        strokeWidth={0.8}
      />
      <Dim from={[left, planBottom + 15]} to={[left + L * s, planBottom + 15]} label={`L = ${L}`} />
      <Dim from={[left - 15, planTop]} to={[left - 15, planBottom]} label={`B = ${B}`} />
      <text
        x={cx}
        y={planBottom + 42}
        fill={SOFT}
        fontFamily={MONO}
        fontSize={9.5}
        textAnchor="middle"
      >
        PLAN — solid: {along.count}–{input.barDiameter}φ · dashed: {across.count}–
        {input.barDiameter}φ
      </text>

      <rect
        x={cx - colW / 2}
        y={secTop - stub}
        width={colW}
        height={stub}
        fill={CONCRETE}
        stroke={INK}
        strokeWidth={1.6}
      />
      <rect
        x={left}
        y={secTop}
        width={L * s}
        height={padH}
        fill={CONCRETE}
        stroke={INK}
        strokeWidth={1.6}
      />
      <polyline
        points={`${left + edge},${secTop + padH - 12} ${left + edge},${secTop + padH - 6} ${left + L * s - edge},${secTop + padH - 6} ${left + L * s - edge},${secTop + padH - 12}`}
        fill="none"
        stroke={INK}
        strokeWidth={1.6}
      />
      {spread(Math.min(across.count, 24), left + edge + 6, left + L * s - edge - 6).map((x) => (
        <circle key={`d${x}`} cx={x} cy={secTop + padH - 10} r={1.7} fill={INK} />
      ))}
      <Dim
        from={[left + L * s + 14, secTop]}
        to={[left + L * s + 14, secTop + padH]}
        label={`D = ${D}`}
        side={-1}
      />
      <text
        x={cx}
        y={secTop + padH + 16}
        fill={SOFT}
        fontFamily={MONO}
        fontSize={9.5}
        textAnchor="middle"
      >
        SECTION — column {input.cx} × {input.cy}
      </text>
    </svg>
  );
}
