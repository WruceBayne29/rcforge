import type { BeamInput } from '../../is456';
import { Choice, Field, Materials, NumberEntry, SelectEntry, diameterOptions } from '../fields';

export function BeamForm({
  value,
  onChange,
}: {
  value: BeamInput;
  onChange: (next: BeamInput) => void;
}) {
  const set = (patch: Partial<BeamInput>) => onChange({ ...value, ...patch });
  const loading = value.loading;
  return (
    <>
      <h2>Beam</h2>
      <p className="lede">Flexure, shear, deflection and anchorage of one beam section.</p>
      <fieldset>
        <legend>Section</legend>
        <Choice
          name="Beam shape"
          value={value.shape}
          options={[
            { value: 'rectangular', label: 'Rectangular' },
            { value: 'tee', label: 'T-beam' },
            { value: 'ell', label: 'L-beam' },
          ]}
          onChange={(shape) => set({ shape })}
        />
        <Field label={value.shape === 'rectangular' ? 'Width b' : 'Web width bw'}>
          <NumberEntry name="Width" value={value.b} unit="mm" onCommit={(b) => set({ b })} />
        </Field>
        <Field label="Overall depth D">
          <NumberEntry
            name="Overall depth"
            value={value.D}
            unit="mm"
            onCommit={(D) => set({ D })}
          />
        </Field>
        {value.shape !== 'rectangular' && (
          <>
            <Field label="Flange width bf" hint="Effective width, cl. 23.1.2">
              <NumberEntry
                name="Flange width"
                value={value.bf}
                unit="mm"
                onCommit={(bf) => set({ bf })}
              />
            </Field>
            <Field label="Flange thickness Df">
              <NumberEntry
                name="Flange thickness"
                value={value.Df}
                unit="mm"
                onCommit={(Df) => set({ Df })}
              />
            </Field>
          </>
        )}
        <Field label="Clear cover" hint="To the stirrups">
          <NumberEntry
            name="Cover"
            value={value.cover}
            unit="mm"
            onCommit={(cover) => set({ cover })}
          />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Span</legend>
        <Field label="Effective span">
          <NumberEntry name="Span" value={value.span} unit="m" onCommit={(span) => set({ span })} />
        </Field>
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
      </fieldset>

      <fieldset>
        <legend>Loading</legend>
        <Choice
          name="Loading type"
          value={loading.kind}
          options={[
            { value: 'udl', label: 'Uniform load' },
            { value: 'forces', label: 'Mu and Vu known' },
          ]}
          onChange={(kind) =>
            set({
              loading:
                kind === 'udl'
                  ? { kind: 'udl', dead: 15, live: 10, selfWeight: true }
                  : { kind: 'forces', Mu: 180, Vu: 120 },
            })
          }
        />
        {loading.kind === 'udl' ? (
          <>
            <Field label="Dead load" hint="Characteristic, excluding self-weight">
              <NumberEntry
                name="Dead load"
                value={loading.dead}
                unit="kN/m"
                onCommit={(dead) => set({ loading: { ...loading, dead } })}
              />
            </Field>
            <Field label="Imposed load" hint="Characteristic">
              <NumberEntry
                name="Imposed load"
                value={loading.live}
                unit="kN/m"
                onCommit={(live) => set({ loading: { ...loading, live } })}
              />
            </Field>
            <label className="tick">
              <input
                type="checkbox"
                checked={loading.selfWeight}
                onChange={(e) => set({ loading: { ...loading, selfWeight: e.target.checked } })}
              />
              Add the beam's self-weight
            </label>
          </>
        ) : (
          <>
            <Field label="Design moment Mu" hint="Factored">
              <NumberEntry
                name="Design moment"
                value={loading.Mu}
                unit="kN·m"
                onCommit={(Mu) => set({ loading: { ...loading, Mu } })}
              />
            </Field>
            <Field label="Design shear Vu" hint="Factored">
              <NumberEntry
                name="Design shear"
                value={loading.Vu}
                unit="kN"
                onCommit={(Vu) => set({ loading: { ...loading, Vu } })}
              />
            </Field>
          </>
        )}
      </fieldset>

      <Materials concrete={value.concrete} steel={value.steel} onChange={set} />

      <fieldset>
        <legend>Bars</legend>
        <Field label="Main bars">
          <SelectEntry
            name="Main bar diameter"
            value={value.mainDiameter}
            options={[
              { value: 0, label: 'Choose for me' },
              ...diameterOptions([12, 16, 20, 25, 32]),
            ]}
            onChange={(mainDiameter) => set({ mainDiameter })}
          />
        </Field>
        <Field label="Stirrups">
          <SelectEntry
            name="Stirrup diameter"
            value={value.stirrupDiameter}
            options={diameterOptions([6, 8, 10, 12])}
            onChange={(stirrupDiameter) => set({ stirrupDiameter })}
          />
        </Field>
        <Field label="Stirrup legs">
          <SelectEntry
            name="Stirrup legs"
            value={value.stirrupLegs}
            options={[2, 4, 6].map((n) => ({ value: n, label: `${n}-legged` }))}
            onChange={(stirrupLegs) => set({ stirrupLegs })}
          />
        </Field>
      </fieldset>
    </>
  );
}
