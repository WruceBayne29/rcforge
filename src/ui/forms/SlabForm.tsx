import { TABLE_26 } from '../../is456';
import type { SlabInput } from '../../is456';
import { Choice, Field, Materials, NumberEntry, SelectEntry, diameterOptions } from '../fields';

export function SlabForm({
  value,
  onChange,
}: {
  value: SlabInput;
  onChange: (next: SlabInput) => void;
}) {
  const set = (patch: Partial<SlabInput>) => onChange({ ...value, ...patch });
  const twoWay = value.type === 'two-way';
  return (
    <>
      <h2>Slab</h2>
      <p className="lede">A one-way strip or a two-way panel, designed per metre width.</p>
      <fieldset>
        <legend>Panel</legend>
        <Choice
          name="Slab type"
          value={value.type}
          options={[
            { value: 'two-way', label: 'Two-way' },
            { value: 'one-way', label: 'One-way' },
          ]}
          onChange={(type) => set({ type })}
        />
        <Field label={twoWay ? 'Short span lx' : 'Effective span'}>
          <NumberEntry name="Short span" value={value.lx} unit="m" onCommit={(lx) => set({ lx })} />
        </Field>
        {twoWay && (
          <Field label="Long span ly">
            <NumberEntry
              name="Long span"
              value={value.ly}
              unit="m"
              onCommit={(ly) => set({ ly })}
            />
          </Field>
        )}
        <Field label="Overall depth D">
          <NumberEntry
            name="Overall depth"
            value={value.D}
            unit="mm"
            onCommit={(D) => set({ D })}
          />
        </Field>
        <Field label="Clear cover">
          <NumberEntry
            name="Cover"
            value={value.cover}
            unit="mm"
            onCommit={(cover) => set({ cover })}
          />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Edges</legend>
        {twoWay ? (
          <Field
            label="Edge conditions"
            wide
            hint="Table 26 case, or Table 27 when the corners are free to lift"
          >
            <SelectEntry
              name="Edge conditions"
              value={value.panel}
              options={[
                ...TABLE_26.map((c) => ({ value: c.id, label: `${c.id}. ${c.name}` })),
                { value: 0, label: 'Simply supported, corners free to lift' },
              ]}
              onChange={(panel) => set({ panel })}
            />
          </Field>
        ) : (
          <Field label="Support">
            <SelectEntry
              name="Support condition"
              value={value.support}
              options={[
                { value: 'simple', label: 'Simply supported' },
                { value: 'continuous', label: 'Continuous' },
                { value: 'cantilever', label: 'Cantilever' },
              ]}
              onChange={(support) => set({ support })}
            />
          </Field>
        )}
      </fieldset>

      <fieldset>
        <legend>Loading</legend>
        <Field label="Finishes and partitions" hint="Self-weight is added">
          <NumberEntry
            name="Superimposed dead load"
            value={value.dead}
            unit="kN/m²"
            onCommit={(dead) => set({ dead })}
          />
        </Field>
        <Field label="Imposed load">
          <NumberEntry
            name="Imposed load"
            value={value.live}
            unit="kN/m²"
            onCommit={(live) => set({ live })}
          />
        </Field>
      </fieldset>

      <Materials concrete={value.concrete} steel={value.steel} onChange={set} />

      <fieldset>
        <legend>Bars</legend>
        <Field label="Main bars">
          <SelectEntry
            name="Main bar diameter"
            value={value.mainDiameter}
            options={diameterOptions([8, 10, 12, 16])}
            onChange={(mainDiameter) => set({ mainDiameter })}
          />
        </Field>
        {!twoWay && (
          <Field label="Distribution bars">
            <SelectEntry
              name="Distribution bar diameter"
              value={value.distributionDiameter}
              options={diameterOptions([6, 8, 10])}
              onChange={(distributionDiameter) => set({ distributionDiameter })}
            />
          </Field>
        )}
      </fieldset>
    </>
  );
}
