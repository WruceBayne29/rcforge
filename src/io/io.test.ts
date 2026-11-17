import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../model/examples';
import { defaultProject } from '../model/project';
import {
  parseProject,
  parseProjectText,
  ProjectFormatError,
  serializeProject,
} from './projectFile';
import { decodeProject, encodeProject, payloadFromHash, shareUrl } from './share';

describe('project files', () => {
  it('round-trips every example', () => {
    for (const example of EXAMPLES) {
      const project = example.build();
      expect(parseProjectText(serializeProject(project))).toEqual(project);
    }
  });

  it('fills in defaults and ignores unknown fields', () => {
    const p = parseProject({ title: 'Mine', beam: { b: 350, bogus: 1 }, nonsense: true });
    expect(p.title).toBe('Mine');
    expect(p.beam.b).toBe(350);
    expect(p.beam.D).toBe(defaultProject().beam.D);
    expect('bogus' in p.beam).toBe(false);
    expect('nonsense' in p).toBe(false);
  });

  it('reads both kinds of beam loading', () => {
    const forces = parseProject({ beam: { loading: { kind: 'forces', Mu: 150, Vu: 90 } } });
    expect(forces.beam.loading).toEqual({ kind: 'forces', Mu: 150, Vu: 90 });
    const udl = parseProject({
      beam: { loading: { kind: 'udl', dead: 5, live: 4, selfWeight: false } },
    });
    expect(udl.beam.loading).toEqual({ kind: 'udl', dead: 5, live: 4, selfWeight: false });
  });

  it('rejects malformed input with a readable message', () => {
    const bad = (data: unknown, pattern: RegExp) => {
      expect(() => parseProject(data)).toThrow(ProjectFormatError);
      expect(() => parseProject(data)).toThrow(pattern);
    };
    bad(null, /not an RCForge project/);
    bad([1], /not an RCForge project/);
    bad({ version: 3 }, /newer version/);
    bad({ beam: { b: 'wide' } }, /"beam.b" must be a number/);
    bad({ title: 5 }, /"title" must be a short text/);
    bad({ element: 'bridge' }, /"element" must be one of/);
    bad({ column: { concrete: 'M999' } }, /"column.concrete" must be one of/);
    bad({ beam: { loading: { kind: 'wind' } } }, /"udl" or "forces"/);
    bad({ beam: { loading: { kind: 'forces', Mu: 'x', Vu: 1 } } }, /beam.loading.Mu/);
    expect(() => parseProjectText('{nope')).toThrow(/not valid JSON/);
  });
});

describe('share links', () => {
  it('round-trips a project through a URL', async () => {
    const project = EXAMPLES[5].build();
    const url = await shareUrl(project, 'https://example.org/rcforge/#old');
    expect(url.startsWith('https://example.org/rcforge/#m=1.')).toBe(true);
    expect(url.length).toBeLessThan(1500);
    const payload = payloadFromHash(new URL(url).hash);
    expect(await decodeProject(payload as string)).toEqual(project);
  });

  it('rejects damaged links', async () => {
    await expect(decodeProject('garbage')).rejects.toThrow(/does not contain/);
    await expect(decodeProject('1.!!!!')).rejects.toThrow(/damaged/);
    await expect(decodeProject(`0.${btoa('[1,2]')}`)).rejects.toThrow(/not an RCForge project/);
    expect(payloadFromHash('#other')).toBeNull();
    expect((await encodeProject(defaultProject())).startsWith('1.')).toBe(true);
    const plain = `0.${btoa(JSON.stringify(defaultProject())).replace(/=+$/, '')}`;
    expect(await decodeProject(plain)).toEqual(defaultProject());
  });
});
