import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CONCRETE_GRADES, STEEL_GRADES } from '../is456';

/** A labelled row: name on the left, the entry on the right, like a form being filled in. */
export function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span>
        {label}
        {hint && <span className="hint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/**
 * Numeric entry that keeps its own text while typing and commits on blur or Enter, so a
 * half-typed value never reaches the calculation.
 */
export function NumberEntry({
  value,
  onCommit,
  unit,
  name,
}: {
  value: number;
  onCommit: (value: number) => void;
  unit?: string;
  name: string;
}) {
  const shown = String(Number(value.toFixed(6)));
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const parsed = Number(text);
    if (text.trim() === '' || !Number.isFinite(parsed)) {
      setText(shown);
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <span className="entry">
      <input
        type="number"
        inputMode="decimal"
        step="any"
        aria-label={name}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setText(shown);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </span>
  );
}

export function SelectEntry<T extends string | number>({
  value,
  options,
  onChange,
  name,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  name: string;
}) {
  return (
    <span className="entry">
      <select
        aria-label={name}
        value={String(value)}
        onChange={(e) => {
          const picked = options.find((o) => String(o.value) === e.target.value);
          if (picked) onChange(picked.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

export function Choice<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  name: string;
}) {
  return (
    <div className="choice" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <label key={o.value}>
          <input
            type="radio"
            name={name}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** Concrete and steel grade pickers, shared by every element form. */
export function Materials({
  concrete,
  steel,
  onChange,
}: {
  concrete: string;
  steel: string;
  onChange: (patch: { concrete?: string; steel?: string }) => void;
}) {
  return (
    <fieldset>
      <legend>Materials</legend>
      <Field label="Concrete">
        <SelectEntry
          name="Concrete grade"
          value={concrete}
          options={CONCRETE_GRADES.map((g) => ({ value: g.name, label: g.name }))}
          onChange={(v) => onChange({ concrete: v })}
        />
      </Field>
      <Field label="Steel">
        <SelectEntry
          name="Steel grade"
          value={steel}
          options={STEEL_GRADES.map((g) => ({ value: g.name, label: g.name }))}
          onChange={(v) => onChange({ steel: v })}
        />
      </Field>
    </fieldset>
  );
}

export const diameterOptions = (list: readonly number[]) =>
  list.map((d) => ({ value: d, label: `${d} mm` }));
