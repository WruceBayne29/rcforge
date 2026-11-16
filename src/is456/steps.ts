/**
 * Worked calculation steps. Every design routine returns its result together with the steps
 * that produced it, laid out like a hand calculation sheet: a clause reference, the working,
 * and the value carried to the output column.
 */
export type StepStatus = 'ok' | 'fail' | 'warn';

export interface Step {
  /** Clause or table of IS 456:2000 the step relies on, e.g. "Cl. 38.1". */
  ref?: string;
  /** What is being worked out. */
  title: string;
  /** Lines of working: the expression, the substitution, intermediate values. */
  lines: string[];
  /** The value carried to the output column, e.g. "Ast = 942 mm²". */
  output?: string;
  status?: StepStatus;
}

/** Formats a number for a calculation sheet: sensible significant figures, no exponent noise. */
export function num(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '–';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs >= 10000) return value.toFixed(0);
  if (abs >= 1000) return value.toFixed(Math.max(0, digits - 4));
  if (abs >= 100) return value.toFixed(Math.max(0, digits - 3));
  if (abs >= 10) return value.toFixed(Math.max(0, digits - 2));
  if (abs >= 1) return value.toFixed(Math.max(0, digits - 1));
  if (abs >= 0.01) return value.toFixed(digits);
  return value.toPrecision(Math.max(1, digits - 1));
}

/** Fixed number of decimals, for quantities with a conventional precision (stresses, ratios). */
export function fix(value: number, decimals: number): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : '–';
}

/** Small builder so routines can add steps without repeating the array plumbing. */
export class Sheet {
  readonly steps: Step[] = [];

  add(step: Step): this {
    this.steps.push(step);
    return this;
  }

  /** Adds a pass / fail check comparing a demand with a limit. */
  check(
    ref: string | undefined,
    title: string,
    lines: string[],
    passed: boolean,
    output: string,
  ): this {
    this.steps.push({ ref, title, lines, output, status: passed ? 'ok' : 'fail' });
    return this;
  }
}

/** Overall status of a set of steps: fail beats warn beats ok. */
export function worstStatus(steps: Step[]): StepStatus {
  if (steps.some((s) => s.status === 'fail')) return 'fail';
  if (steps.some((s) => s.status === 'warn')) return 'warn';
  return 'ok';
}
