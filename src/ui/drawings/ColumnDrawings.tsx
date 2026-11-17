import type { ColumnDesign, InteractionPoint } from '../../is456';
import { CONCRETE, Dim, FAINT, INK, Leader, MONO, OLIVE, RUST, SOFT } from './kit';

/** Cross-section of the column with its bars and tie. */
export function ColumnSection({ design }: { design: ColumnDesign }) {
  const { input, bars, tie } = design;
  const circular = input.shape === 'circular';
  const b = circular ? input.D : input.b;
  const D = input.D;
  const W = 380;
  const H = 270;
  const s = Math.min(180 / b, 190 / D);
  const cx = 150;
  const cy = 124;
  const left = cx - (b * s) / 2;
  const top = cy - (D * s) / 2;
  const inset = (input.cover + input.tieDiameter / 2) * s;
  const r = Math.max((input.barDiameter * s) / 2, 2.4);
  const corner = bars.reduce((a, p) => (p.x + p.y > a.x + a.y ? p : a), bars[0]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Column cross-section">
      {circular ? (
        <>
          <circle cx={cx} cy={cy} r={(D * s) / 2} fill={CONCRETE} stroke={INK} strokeWidth={1.6} />
          <circle
            cx={cx}
            cy={cy}
            r={(D * s) / 2 - inset}
            fill="none"
            stroke={INK}
            strokeWidth={Math.max(1, input.tieDiameter * s)}
          />
        </>
      ) : (
        <>
          <rect
            x={left}
            y={top}
            width={b * s}
            height={D * s}
            fill={CONCRETE}
            stroke={INK}
            strokeWidth={1.6}
          />
          <rect
            x={left + inset}
            y={top + inset}
            width={b * s - 2 * inset}
            height={D * s - 2 * inset}
            rx={Math.max(2, 2 * input.tieDiameter * s)}
            fill="none"
            stroke={INK}
            strokeWidth={Math.max(1, input.tieDiameter * s)}
          />
        </>
      )}
      {bars.map((bar, k) => (
        <circle key={k} cx={cx + bar.x * s} cy={cy - bar.y * s} r={r} fill={INK} />
      ))}
      <Dim
        from={[left, top + D * s + 16]}
        to={[left + b * s, top + D * s + 16]}
        label={circular ? `D = ${D}` : `b = ${b}`}
      />
      {!circular && (
        <Dim from={[left - 16, top]} to={[left - 16, top + D * s]} label={`D = ${D}`} />
      )}
      <Leader
        at={[cx + corner.x * s, cy - corner.y * s]}
        to={[left + b * s + 24, top + 12]}
        text={`${bars.length}–${input.barDiameter}φ`}
      />
      <Leader
        at={[circular ? cx + (D * s) / 2 - inset : left + b * s - inset, cy + 8]}
        to={[left + b * s + 24, cy + 14]}
        text={`${tie.diameter}φ ties @ ${tie.pitch}`}
      />
      {!circular && (
        <text x={cx} y={top - 9} fill={SOFT} fontFamily={MONO} fontSize={9.5} textAnchor="middle">
          x–x axis is horizontal: Mux bends across D
        </text>
      )}
    </svg>
  );
}

function niceStep(range: number): number {
  const raw = range / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= raw) return m * pow;
  return 10 * pow;
}

/** P–M interaction diagrams about both axes with the design point marked. */
export function InteractionChart({ design }: { design: ColumnDesign }) {
  const W = 380;
  const H = 300;
  const m = { left: 56, right: 14, top: 16, bottom: 38 };
  const curves: Array<[InteractionPoint[], boolean]> = [
    [design.curveX, false],
    [design.curveY, true],
  ];
  const all = [...design.curveX, ...design.curveY];
  const maxM = Math.max(...all.map((p) => p.M), design.MuxDesign, design.MuyDesign) * 1.08;
  const maxP = Math.max(...all.map((p) => p.P), design.input.Pu) * 1.05;
  const minP = Math.min(...all.map((p) => p.P));
  const stepM = niceStep(maxM);
  const stepP = niceStep(maxP - minP);
  const x = (v: number) => m.left + (v / maxM) * (W - m.left - m.right);
  const y = (v: number) => m.top + ((maxP - v) / (maxP - minP)) * (H - m.top - m.bottom);
  const safe = design.status !== 'fail';
  const Pu = design.input.Pu;
  const ticksM: number[] = [];
  for (let v = 0; v <= maxM + 1e-9; v += stepM) ticksM.push(v);
  const ticksP: number[] = [];
  for (let v = Math.ceil(minP / stepP) * stepP; v <= maxP + 1e-9; v += stepP) ticksP.push(v);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Axial load and moment interaction diagram"
    >
      {ticksM.map((v) => (
        <g key={`m${v}`}>
          <line x1={x(v)} y1={m.top} x2={x(v)} y2={H - m.bottom} stroke={FAINT} strokeWidth={0.6} />
          <text
            x={x(v)}
            y={H - m.bottom + 13}
            fill={SOFT}
            fontFamily={MONO}
            fontSize={9.5}
            textAnchor="middle"
          >
            {Number(v.toFixed(1))}
          </text>
        </g>
      ))}
      {ticksP.map((v) => (
        <g key={`p${v}`}>
          <line
            x1={m.left}
            y1={y(v)}
            x2={W - m.right}
            y2={y(v)}
            stroke={Math.abs(v) < 1e-9 ? SOFT : FAINT}
            strokeWidth={Math.abs(v) < 1e-9 ? 1 : 0.6}
          />
          <text
            x={m.left - 6}
            y={y(v) + 3.5}
            fill={SOFT}
            fontFamily={MONO}
            fontSize={9.5}
            textAnchor="end"
          >
            {Number(v.toFixed(0))}
          </text>
        </g>
      ))}
      <rect
        x={m.left}
        y={m.top}
        width={W - m.left - m.right}
        height={H - m.top - m.bottom}
        fill="none"
        stroke={INK}
        strokeWidth={1}
      />
      {curves.map(([curve, dashed], k) => (
        <polyline
          key={k}
          points={curve.map((p) => `${x(p.M)},${y(p.P)}`).join(' ')}
          fill="none"
          stroke={INK}
          strokeWidth={1.6}
          strokeDasharray={dashed ? '5 3' : undefined}
          strokeLinejoin="round"
        />
      ))}
      <line
        x1={m.left}
        y1={y(Pu)}
        x2={W - m.right}
        y2={y(Pu)}
        stroke={SOFT}
        strokeWidth={0.8}
        strokeDasharray="2 3"
      />
      <circle cx={x(design.MuxDesign)} cy={y(Pu)} r={4.2} fill={safe ? OLIVE : RUST} />
      <circle
        cx={x(design.MuyDesign)}
        cy={y(Pu)}
        r={4.2}
        fill="#fcfaf5"
        stroke={safe ? OLIVE : RUST}
        strokeWidth={1.8}
      />
      <text
        x={(m.left + W - m.right) / 2}
        y={H - 6}
        fill={INK}
        fontFamily={MONO}
        fontSize={10.5}
        textAnchor="middle"
      >
        Mu (kN·m)
      </text>
      <text
        x={13}
        y={(m.top + H - m.bottom) / 2}
        fill={INK}
        fontFamily={MONO}
        fontSize={10.5}
        textAnchor="middle"
        transform={`rotate(-90 13 ${(m.top + H - m.bottom) / 2})`}
      >
        Pu (kN)
      </text>
      <g fontFamily={MONO} fontSize={9.5} fill={INK}>
        <line
          x1={W - 150}
          y1={m.top + 14}
          x2={W - 126}
          y2={m.top + 14}
          stroke={INK}
          strokeWidth={1.6}
        />
        <text x={W - 121} y={m.top + 17.5}>
          about x ● design
        </text>
        <line
          x1={W - 150}
          y1={m.top + 29}
          x2={W - 126}
          y2={m.top + 29}
          stroke={INK}
          strokeWidth={1.6}
          strokeDasharray="5 3"
        />
        <text x={W - 121} y={m.top + 32.5}>
          about y ○ design
        </text>
      </g>
    </svg>
  );
}
