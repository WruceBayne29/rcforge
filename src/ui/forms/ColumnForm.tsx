import type { ColumnInput } from '../../is456';
import { Choice, Field, Materials, NumberEntry, SelectEntry, diameterOptions } from '../fields';

export function ColumnForm({
  value,
  onChange,
}: {
  value: ColumnInput;
  onChange: (next: ColumnInput) => void;
}) {
  const set = (patch: Partial<ColumnInput>) => onChange({ ...value, ...patch });
  const circular = value.shape === 'circular';
  return (
    <>
      <h2>Column</h2>
      <p className="lede">Axial load with bending about one or both axes, short or slender.</p>
      <fieldset>
        <legend>Section</legend>
        <Choice
          name="Column shape"
          value={value.shape}
          options={[
            { value: 'rectangular', label: 'Rectangular' },
            { value: 'circular', label: 'Circular' },
          ]}
          onChange={(shape) => set({ shape })}
        />
        {!circular && (
          <Field label="Width b">
            <NumberEntry name="Width" value={value.b} unit="mm" onCommit={(b) => set({ b })} />
          </Field>
        )}
        <Field label={circular ? 'Diameter D' : 'Depth D'}>
          <NumberEntry name="Depth" value={value.D} unit="mm" onCommit={(D) => set({ D })} />
        </Field>
        <Field label="Clear cover" hint="To the ties">
          <NumberEntry
            name="Cover"
            value={value.cover}
            unit="mm"
            onCommit={(cover) => set({ cover })}
          />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Reinforcement</legend>
        <Field label="Bar size">
          <SelectEntry
            name="Bar diameter"
            value={value.barDiameter}
            options={diameterOptions([12, 16, 20, 25, 32])}
            onChange={(barDiameter) => set({ barDiameter })}
          />
        </Field>
        {circular ? (
          <Field label="Number of bars">
            <NumberEntry
              name="Number of bars"
              value={value.barsRing}
              onCommit={(n) => set({ barsRing: Math.round(n) })}
            />
          </Field>
        ) : (
          <>
            <Field label="Bars in each b-face" hint="Corners included">
              <NumberEntry
                name="Bars in each wide face"
                value={value.barsWidth}
                onCommit={(n) => set({ barsWidth: Math.round(n) })}
              />
            </Field>
            <Field label="Extra bars in each side" hint="Between the corners">
              <NumberEntry
                name="Extra bars in each side face"
                value={value.barsDepth}
                onCommit={(n) => set({ barsDepth: Math.round(n) })}
              />
            </Field>
          </>
        )}
        <Field label="Ties">
          <SelectEntry
            name="Tie diameter"
            value={value.tieDiameter}
            options={diameterOptions([6, 8, 10, 12])}
            onChange={(tieDiameter) => set({ tieDiameter })}
          />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Length</legend>
        <Field label="Unsupported length">
          <NumberEntry
            name="Unsupported length"
            value={value.length}
            unit="m"
            onCommit={(length) => set({ length })}
          />
        </Field>
        <Field label="Effective length factor, x" hint="lex = factor × length">
          <NumberEntry
            name="Effective length factor x"
            value={value.kx}
            onCommit={(kx) => set({ kx })}
          />
        </Field>
        <Field label="Effective length factor, y">
          <NumberEntry
            name="Effective length factor y"
            value={value.ky}
            onCommit={(ky) => set({ ky })}
          />
        </Field>
      </fieldset>

      <fieldset>
        <legend>Factored loads</legend>
        <Field label="Axial load Pu">
          <NumberEntry
            name="Axial load"
            value={value.Pu}
            unit="kN"
            onCommit={(Pu) => set({ Pu })}
          />
        </Field>
        <Field label="Moment Mux" hint="Bending across the depth D">
          <NumberEntry
            name="Moment about x"
            value={value.Mux}
            unit="kN·m"
            onCommit={(Mux) => set({ Mux })}
          />
        </Field>
        <Field
          label="Moment Muy"
          hint={circular ? 'Bending the other way' : 'Bending across the width b'}
        >
          <NumberEntry
            name="Moment about y"
            value={value.Muy}
            unit="kN·m"
            onCommit={(Muy) => set({ Muy })}
          />
        </Field>
      </fieldset>

      <Materials concrete={value.concrete} steel={value.steel} onChange={set} />
    </>
  );
}
