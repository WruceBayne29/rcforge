import type { FootingInput } from '../../is456';
import { Choice, Field, Materials, NumberEntry, SelectEntry, diameterOptions } from '../fields';

export function FootingForm({
  value,
  onChange,
}: {
  value: FootingInput;
  onChange: (next: FootingInput) => void;
}) {
  const set = (patch: Partial<FootingInput>) => onChange({ ...value, ...patch });
  return (
    <>
      <h2>Footing</h2>
      <p className="lede">An isolated pad footing under an axially loaded column.</p>
      <fieldset>
        <legend>Column</legend>
        <Field label="Column size cx" hint="Along the footing length">
          <NumberEntry
            name="Column size cx"
            value={value.cx}
            unit="mm"
            onCommit={(cx) => set({ cx })}
          />
        </Field>
        <Field label="Column size cy">
          <NumberEntry
            name="Column size cy"
            value={value.cy}
            unit="mm"
            onCommit={(cy) => set({ cy })}
          />
        </Field>
        <Field label="Axial load P" hint="Characteristic (service) load">
          <NumberEntry name="Column load" value={value.P} unit="kN" onCommit={(P) => set({ P })} />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Ground</legend>
        <Field label="Safe bearing capacity">
          <NumberEntry
            name="Safe bearing capacity"
            value={value.bearing}
            unit="kN/m²"
            onCommit={(bearing) => set({ bearing })}
          />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Footing</legend>
        <Choice
          name="Footing shape"
          value={value.shape}
          options={[
            { value: 'square', label: 'Square' },
            { value: 'rectangular', label: 'Rectangular' },
          ]}
          onChange={(shape) => set({ shape })}
        />
        <Field label="Depth D" hint="0 finds the least depth">
          <NumberEntry name="Depth" value={value.D} unit="mm" onCommit={(D) => set({ D })} />
        </Field>
        <Field label="Clear cover">
          <NumberEntry
            name="Cover"
            value={value.cover}
            unit="mm"
            onCommit={(cover) => set({ cover })}
          />
        </Field>
        <Field label="Bars">
          <SelectEntry
            name="Bar diameter"
            value={value.barDiameter}
            options={diameterOptions([10, 12, 16, 20])}
            onChange={(barDiameter) => set({ barDiameter })}
          />
        </Field>
      </fieldset>

      <Materials concrete={value.concrete} steel={value.steel} onChange={set} />
    </>
  );
}
