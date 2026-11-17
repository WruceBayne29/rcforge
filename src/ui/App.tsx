import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/source-serif-4/500.css';
import '@fontsource/source-serif-4/600.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseProjectText, ProjectFormatError, serializeProject } from '../io/projectFile';
import { decodeProject, payloadFromHash, shareUrl } from '../io/share';
import { EXAMPLES } from '../model/examples';
import { ELEMENTS, defaultProject, solve } from '../model/project';
import type { Project } from '../model/project';
import { BeamForm } from './forms/BeamForm';
import { ColumnForm } from './forms/ColumnForm';
import { FootingForm } from './forms/FootingForm';
import { SlabForm } from './forms/SlabForm';
import { Sheet } from './Sheet';
import { notify, Toasts } from './toast';
import './styles.css';

const STORAGE_KEY = 'rcforge-project';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be full or disabled; the app works without it.
  }
}

function initialProject(): Project {
  const saved = read(STORAGE_KEY);
  if (saved) {
    try {
      return parseProjectText(saved);
    } catch {
      // Fall through to the default.
    }
  }
  return defaultProject();
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'rcforge';

export function App() {
  const [project, setProject] = useState<Project>(initialProject);
  const fileInput = useRef<HTMLInputElement>(null);
  const outcome = useMemo(() => solve(project), [project]);
  const edit = useCallback(
    (patch: Partial<Project>) => setProject((p) => ({ ...p, ...patch })),
    [],
  );

  // Open a design from a share link; keep the last design for the next visit.
  useEffect(() => {
    const load = () => {
      const payload = payloadFromHash(window.location.hash);
      if (!payload) return;
      decodeProject(payload)
        .then((shared) => {
          setProject(shared);
          notify(`Opened shared design "${shared.title}".`);
        })
        .catch((e: unknown) =>
          notify(e instanceof Error ? e.message : 'Could not open that link.', 'error'),
        );
    };
    load();
    window.addEventListener('hashchange', load);
    return () => window.removeEventListener('hashchange', load);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => write(STORAGE_KEY, serializeProject(project)), 300);
    return () => window.clearTimeout(timer);
  }, [project]);

  const openFile = async (file: File) => {
    try {
      setProject(parseProjectText(await file.text()));
      notify(`Opened ${file.name}`);
    } catch (e) {
      notify(e instanceof ProjectFormatError ? e.message : 'Could not read that file.', 'error');
    }
  };

  const share = async () => {
    try {
      const url = await shareUrl(project, window.location.href);
      window.history.replaceState(null, '', url);
      try {
        await navigator.clipboard.writeText(url);
        notify('Link copied. Anyone who opens it sees this design.');
      } catch {
        notify('The link is in the address bar — copy it from there.');
      }
    } catch {
      notify('Could not create a link.', 'error');
    }
  };

  return (
    <div className="app">
      <header className="masthead">
        <div className="wordmark">
          <strong>RCForge</strong>
          <span>Reinforced concrete to IS 456 : 2000</span>
        </div>
        <nav
          className="elements"
          role="tablist"
          aria-label="Element to design"
          data-tour="elements"
        >
          {ELEMENTS.map((e) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={project.element === e.id}
              onClick={() => edit({ element: e.id })}
            >
              {e.label}
            </button>
          ))}
        </nav>
        <div className="spacer" />
        <div className="actions" data-tour="actions">
          <select
            aria-label="Load a worked example"
            value=""
            onChange={(e) => {
              const example = EXAMPLES.find((x) => x.id === e.target.value);
              if (example) setProject(example.build());
              e.target.blur();
            }}
          >
            <option value="" disabled>
              Worked examples…
            </option>
            {EXAMPLES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} — {x.note}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Open
          </button>
          <button
            type="button"
            onClick={() =>
              download(
                `${slug(project.title)}.json`,
                new Blob([serializeProject(project)], { type: 'application/json' }),
              )
            }
          >
            Save
          </button>
          <button type="button" onClick={share}>
            Share
          </button>
          <button type="button" className="solid" onClick={() => window.print()}>
            Print sheet
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Open a design file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void openFile(file);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      <div className="workspace">
        <aside className="inputs" aria-label="Design inputs" data-tour="inputs">
          {project.element === 'beam' && (
            <BeamForm value={project.beam} onChange={(beam) => edit({ beam })} />
          )}
          {project.element === 'column' && (
            <ColumnForm value={project.column} onChange={(column) => edit({ column })} />
          )}
          {project.element === 'slab' && (
            <SlabForm value={project.slab} onChange={(slab) => edit({ slab })} />
          )}
          {project.element === 'footing' && (
            <FootingForm value={project.footing} onChange={(footing) => edit({ footing })} />
          )}
        </aside>
        <main className="desk">
          {outcome.ok ? (
            <Sheet project={project} design={outcome.design} onEdit={edit} />
          ) : (
            <div className="problems" role="alert">
              <h3>These inputs cannot be designed</h3>
              <ul>
                {outcome.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </main>
      </div>
      <Toasts />
    </div>
  );
}
