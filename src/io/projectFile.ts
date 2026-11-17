/**
 * Reading and writing projects as JSON. `parseProject` treats its input as untrusted (a file the
 * user opens, or data from a share link): it starts from the defaults and copies across only
 * values of the right type and, for choices, from the allowed set.
 */
import { CONCRETE_GRADES, STEEL_GRADES } from '../is456';
import { defaultProject } from '../model/project';
import type { Project } from '../model/project';

export const FILE_FORMAT = 'rcforge-project';

export class ProjectFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectFormatError';
  }
}

export function serializeProject(project: Project): string {
  return JSON.stringify({ format: FILE_FORMAT, ...project }, null, 2);
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const GRADES = {
  concrete: CONCRETE_GRADES.map((g) => g.name),
  steel: STEEL_GRADES.map((g) => g.name),
};

/** Allowed values of every field that is a choice rather than free text or a number. */
const CHOICES: Record<string, readonly string[]> = {
  element: ['beam', 'column', 'slab', 'footing'],
  'beam.shape': ['rectangular', 'tee', 'ell'],
  'beam.support': ['cantilever', 'simple', 'continuous'],
  'beam.concrete': GRADES.concrete,
  'beam.steel': GRADES.steel,
  'column.shape': ['rectangular', 'circular'],
  'column.concrete': GRADES.concrete,
  'column.steel': GRADES.steel,
  'slab.type': ['one-way', 'two-way'],
  'slab.support': ['cantilever', 'simple', 'continuous'],
  'slab.concrete': GRADES.concrete,
  'slab.steel': GRADES.steel,
  'footing.shape': ['square', 'rectangular'],
  'footing.concrete': GRADES.concrete,
  'footing.steel': GRADES.steel,
};

/** Copies matching, well-typed fields of `source` over `target` (in place). */
function overlay(target: Json, source: Json, path: string): void {
  for (const key of Object.keys(target)) {
    const incoming = source[key];
    const current = target[key];
    const here = path ? `${path}.${key}` : key;
    if (incoming === undefined) continue;
    if (typeof current === 'number') {
      if (typeof incoming !== 'number' || !Number.isFinite(incoming)) {
        throw new ProjectFormatError(`"${here}" must be a number.`);
      }
      target[key] = incoming;
    } else if (typeof current === 'string') {
      if (typeof incoming !== 'string' || incoming.length > 200) {
        throw new ProjectFormatError(`"${here}" must be a short text value.`);
      }
      const allowed = CHOICES[here];
      if (allowed && !allowed.includes(incoming)) {
        throw new ProjectFormatError(`"${here}" must be one of: ${allowed.join(', ')}.`);
      }
      target[key] = incoming;
    } else if (typeof current === 'boolean') {
      target[key] = incoming === true;
    } else if (isObject(current) && isObject(incoming) && key !== 'loading') {
      overlay(current, incoming, here);
    }
  }
}

/** Validates arbitrary parsed JSON and returns a clean `Project`. */
export function parseProject(data: unknown): Project {
  if (!isObject(data)) throw new ProjectFormatError('This is not an RCForge project file.');
  if (data.version !== undefined && data.version !== 1) {
    throw new ProjectFormatError('This file was made by a newer version of RCForge.');
  }
  const project = defaultProject();
  overlay(project as unknown as Json, data, '');

  // The beam loading is a union, so it is read explicitly.
  const loading = isObject(data.beam) ? data.beam.loading : undefined;
  if (isObject(loading)) {
    const number = (v: unknown, name: string): number => {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new ProjectFormatError(`"beam.loading.${name}" must be a number.`);
      }
      return v;
    };
    if (loading.kind === 'forces') {
      project.beam.loading = {
        kind: 'forces',
        Mu: number(loading.Mu, 'Mu'),
        Vu: number(loading.Vu, 'Vu'),
      };
    } else if (loading.kind === 'udl') {
      project.beam.loading = {
        kind: 'udl',
        dead: number(loading.dead, 'dead'),
        live: number(loading.live, 'live'),
        selfWeight: loading.selfWeight !== false,
      };
    } else {
      throw new ProjectFormatError('"beam.loading.kind" must be "udl" or "forces".');
    }
  }
  project.version = 1;
  return project;
}

/** Parses the text of a project file. */
export function parseProjectText(text: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ProjectFormatError('This file is not valid JSON.');
  }
  return parseProject(data);
}
