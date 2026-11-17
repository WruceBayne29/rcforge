import { useEffect, useLayoutEffect, useState } from 'react';

/** "How to read this sheet" — what the app does, its conventions and its limits. */
export function About({ onClose, onTour }: { onClose: () => void; onTour: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="veil" onClick={onClose}>
      <div
        className="note"
        role="dialog"
        aria-modal="true"
        aria-label="About RCForge"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>How to read this sheet</h2>
        <p>
          Fill in the form on the left. The sheet on the right is the design, set out the way a hand
          calculation is: the clause on the left, the working in the middle, and the figure you
          carry forward on the right. It recalculates as you type.
        </p>
        <h3>Conventions</h3>
        <p>
          Limit state method of IS 456 : 2000 with a load factor of 1.5 on dead and imposed load.
          Dimensions are in millimetres, spans in metres, forces in kN and moments in kN·m. Moments
          and shears you enter directly are taken as already factored.
        </p>
        <h3>What it does not do</h3>
        <p>
          It designs one section at a time and does not analyse the structure. It leaves out
          torsion, crack width calculations, redistribution of moments, ductile detailing to IS
          13920 and load combinations with wind or earthquake. The bar schedule is indicative.
        </p>
        <h3>Keys</h3>
        <p>
          <kbd>1</kbd> beam · <kbd>2</kbd> column · <kbd>3</kbd> slab · <kbd>4</kbd> footing ·{' '}
          <kbd>?</kbd> this note
        </p>
        <div className="row">
          <button type="button" onClick={onTour}>
            Show me round
          </button>
          <button type="button" className="solid" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const STEPS: Array<{ target: string; title: string; body: string }> = [
  {
    target: 'elements',
    title: 'Pick what you are designing',
    body: 'A beam, a column, a slab or a footing. Each keeps its own inputs, so you can move between them.',
  },
  {
    target: 'inputs',
    title: 'Fill in the form',
    body: 'Section, span, loads and materials. Leave the bar size on "Choose for me" and the program picks bars that fit.',
  },
  {
    target: 'sheet',
    title: 'Read the calculation',
    body: 'Every step is shown with its clause of IS 456, the working and the result, with a drawing of the section to scale.',
  },
  {
    target: 'actions',
    title: 'Keep it or pass it on',
    body: 'Load a worked example, save the design, copy a link to it, or download the sheet as a PDF.',
  },
];

/** First-visit walkthrough: one part of the page at a time. */
export function Tour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  useLayoutEffect(() => {
    const measure = () =>
      setRect(
        document.querySelector(`[data-tour="${step.target}"]`)?.getBoundingClientRect() ?? null,
      );
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (last) onClose();
        else setIndex(index + 1);
      }
      if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, last, onClose]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(330, vw - 24);
  const cardH = 170;
  let left = (vw - cardW) / 2;
  let top = (vh - cardH) / 2;
  if (rect) {
    if (rect.width > vw * 0.5 && rect.height > vh * 0.5) {
      left = rect.left + 30;
      top = rect.top + 30;
    } else if (rect.right + cardW + 20 < vw && rect.height > 140) {
      left = rect.right + 14;
      top = rect.top + 10;
    } else if (rect.bottom + cardH + 20 < vh) {
      left = rect.left;
      top = rect.bottom + 12;
    } else {
      left = rect.left;
      top = rect.top - cardH - 12;
    }
  }
  left = Math.min(Math.max(12, left), vw - cardW - 12);
  top = Math.min(Math.max(12, top), vh - cardH - 12);

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Introduction">
      {rect ? (
        <div
          className="tour-frame"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      ) : (
        <div className="veil" />
      )}
      <div className="note tour-card" style={{ left, top, width: cardW }}>
        <small>
          {index + 1} of {STEPS.length}
        </small>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="row">
          <button type="button" className="plain-button" onClick={onClose}>
            Skip
          </button>
          {index > 0 && (
            <button type="button" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          )}
          <button
            type="button"
            className="solid"
            onClick={() => (last ? onClose() : setIndex(index + 1))}
          >
            {last ? 'Start' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
