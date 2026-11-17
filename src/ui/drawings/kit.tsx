/**
 * Drawing primitives. Colours and fonts are set as attributes (not CSS classes) so that a
 * drawing can be serialised on its own for the PDF sheet.
 */
export const INK = '#2b2620';
export const SOFT = '#7d7263';
export const FAINT = '#c9bfad';
export const CONCRETE = '#efe8da';
export const RUST = '#a4421b';
export const OLIVE = '#55652a';
export const OCHRE = '#a9730f';
export const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

export type P = [number, number];

/** A dimension line with slashed ends and its value written alongside. */
export function Dim({
  from,
  to,
  label,
  side = 1,
}: {
  from: P;
  to: P;
  label: string;
  side?: 1 | -1;
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tick = (p: P) => (
    <line
      x1={p[0] - (ux - uy) * 3.5}
      y1={p[1] - (uy + ux) * 3.5}
      x2={p[0] + (ux - uy) * 3.5}
      y2={p[1] + (uy + ux) * 3.5}
      stroke={SOFT}
      strokeWidth={1}
    />
  );
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;
  const vertical = Math.abs(dy) > Math.abs(dx);
  const tx = mx + (vertical ? -9 * side : 0);
  const ty = my + (vertical ? 0 : 13 * side) + (vertical ? 0 : side > 0 ? 0 : 6);
  return (
    <g>
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={SOFT} strokeWidth={0.8} />
      {tick(from)}
      {tick(to)}
      <text
        x={tx}
        y={ty}
        fill={INK}
        fontFamily={MONO}
        fontSize={10.5}
        textAnchor="middle"
        transform={vertical ? `rotate(-90 ${tx} ${ty})` : undefined}
      >
        {label}
      </text>
    </g>
  );
}

/** A note connected to a point by a thin leader line. */
export function Leader({
  at,
  text,
  to,
  anchor = 'start',
}: {
  at: P;
  to: P;
  text: string;
  anchor?: 'start' | 'end';
}) {
  return (
    <g>
      <line x1={at[0]} y1={at[1]} x2={to[0]} y2={to[1]} stroke={SOFT} strokeWidth={0.7} />
      <circle cx={at[0]} cy={at[1]} r={1.3} fill={SOFT} />
      <text
        x={to[0] + (anchor === 'start' ? 3 : -3)}
        y={to[1] + 3.5}
        fill={INK}
        fontFamily={MONO}
        fontSize={10.5}
        textAnchor={anchor}
      >
        {text}
      </text>
    </g>
  );
}

/** Evenly spaced positions between two ends (a single item sits in the middle). */
export function spread(count: number, from: number, to: number): number[] {
  if (count <= 1) return [(from + to) / 2];
  return Array.from({ length: count }, (_, k) => from + ((to - from) * k) / (count - 1));
}
