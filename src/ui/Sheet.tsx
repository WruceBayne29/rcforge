import { describe } from '../model/project';
import type { Design, Project } from '../model/project';
import { BeamSection } from './drawings/BeamSection';
import { ColumnSection, InteractionChart } from './drawings/ColumnDrawings';
import { FootingDrawing, SlabSection } from './drawings/SlabFootingDrawings';
import { MARK, VERDICT, provisions } from './summary';

function Figures({ design }: { design: Design }) {
  switch (design.kind) {
    case 'beam':
      return (
        <figure>
          <BeamSection design={design.result} />
          <figcaption>Cross-section, to scale · dimensions in mm</figcaption>
        </figure>
      );
    case 'column':
      return (
        <>
          <figure>
            <ColumnSection design={design.result} />
            <figcaption>Cross-section, to scale · dimensions in mm</figcaption>
          </figure>
          <figure>
            <InteractionChart design={design.result} />
            <figcaption>Interaction diagrams from strain compatibility</figcaption>
          </figure>
        </>
      );
    case 'slab':
      return (
        <figure>
          <SlabSection design={design.result} />
          <figcaption>Section through a one metre strip</figcaption>
        </figure>
      );
    case 'footing':
      return (
        <figure>
          <FootingDrawing design={design.result} />
          <figcaption>Plan and section · dimensions in mm</figcaption>
        </figure>
      );
  }
}

/** The calculation sheet: title block, drawing and verdict, then the working in three columns. */
export function Sheet({
  project,
  design,
  onEdit,
}: {
  project: Project;
  design: Design;
  onEdit: (patch: Partial<Project>) => void;
}) {
  const { sections, checks, status } = design.result;
  const today = new Date().toISOString().slice(0, 10);
  let stepNumber = 0;
  return (
    <article className="sheet" data-tour="sheet">
      <header className="title-block">
        <div>
          <small>Calculation sheet</small>
          <b>RCForge</b>
        </div>
        <div>
          <small>Job</small>
          <input
            aria-label="Job title"
            value={project.title}
            onChange={(e) => onEdit({ title: e.target.value })}
          />
        </div>
        <div>
          <small>Code</small>
          <span className="value">IS 456 : 2000</span>
        </div>
        <div>
          <small>Sheet</small>
          <span className="value">1 of 1</span>
        </div>
        <div>
          <small>Element</small>
          <span className="value">{project.element}</span>
        </div>
        <div>
          <small>Description</small>
          <span className="value" title={describe(project)}>
            {describe(project)}
          </span>
        </div>
        <div>
          <small>Prepared by</small>
          <input
            className="value"
            aria-label="Prepared by"
            placeholder="your name"
            value={project.author}
            onChange={(e) => onEdit({ author: e.target.value })}
          />
        </div>
        <div>
          <small>Date</small>
          <span className="value">{today}</span>
        </div>
      </header>

      <section className="overview">
        <div className="figure">
          <Figures design={design} />
        </div>
        <div className="verdict">
          <div className={`stamp ${status}`} data-status={status}>
            {VERDICT[status]}
          </div>
          <ul className="provide">
            {provisions(design).map(([label, value]) => (
              <li key={label}>
                <span>{label}</span>
                <span>{value}</span>
              </li>
            ))}
          </ul>
          <table className="checks">
            <tbody>
              {checks.map((c) => (
                <tr key={c.name}>
                  <td className={`mark-${c.status}`}>{MARK[c.status]}</td>
                  <td>{c.name}</td>
                  <td>{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <table className="calc">
        <colgroup>
          <col className="ref" />
          <col />
          <col className="out" />
        </colgroup>
        <thead>
          <tr>
            <th>Reference</th>
            <th>Calculations</th>
            <th>Output</th>
          </tr>
        </thead>
        <tbody>
          {sections.flatMap((section, s) => [
            <tr key={`h${s}`} className="heading">
              <td colSpan={3}>
                <i>{s + 1}</i>
                {section.title}
              </td>
            </tr>,
            ...section.steps.map((step) => {
              stepNumber += 1;
              return (
                <tr key={`s${stepNumber}`}>
                  <td className="ref-cell">{step.ref ?? ''}</td>
                  <td className="work">
                    <b>{step.title}</b>
                    {step.lines.map((line, k) => (
                      <span key={k}>{line}</span>
                    ))}
                  </td>
                  <td className={`out-cell ${step.status ?? ''}`}>{step.output ?? ''}</td>
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>
      <footer className="footnote">
        Limit state design to IS 456 : 2000. A learning tool: have every design checked by a
        qualified engineer before it is built.
      </footer>
    </article>
  );
}
