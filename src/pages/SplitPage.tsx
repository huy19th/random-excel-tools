import { useState } from 'preact/hooks';
import { FileDropzone } from '../components/FileDropzone';
import { SheetPicker, allIndices } from '../components/SheetPicker';
import { JobStatus, type Status } from '../components/JobStatus';
import { readFile, runJob } from '../lib/client';
import { downloadBlob } from '../lib/download';
import type { SheetInfo } from '../lib/split';

export function SplitPage() {
  const [file, setFile] = useState<File>();
  const [sheets, setSheets] = useState<SheetInfo[]>();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<Status>({ busy: false });

  const pick = async ([f]: File[]) => {
    setFile(f);
    setSheets(undefined);
    setStatus({ busy: true });
    try {
      const list = await runJob({ type: 'listSheets', file: await readFile(f) });
      setSheets(list);
      setSelected(allIndices(list));
      setStatus({ busy: false });
    } catch (e) {
      setStatus({ busy: false, error: (e as Error).message });
    }
  };

  const split = async () => {
    if (!file) return;
    setStatus({ busy: true });
    try {
      const out = await runJob(
        { type: 'split', file: await readFile(file), sheets: [...selected].sort((a, b) => a - b) },
        (done, total) => setStatus({ busy: true, progress: { done, total } }),
      );
      downloadBlob(out.data, out.name);
      setStatus({ busy: false });
    } catch (e) {
      setStatus({ busy: false, error: (e as Error).message });
    }
  };

  return (
    <>
      <hgroup>
        <h1>Split file Excel</h1>
        <p>Turn every sheet into its own file. Formatting, charts, images and macros are preserved.</p>
      </hgroup>

      <FileDropzone onFiles={pick} label={file ? `Selected: ${file.name}. Drop another file to replace it` : undefined} />

      {sheets && (
        <article>
          <header>Choose sheets to split</header>
          <SheetPicker sheets={sheets} selected={selected} onChange={setSelected} />
          <footer>
            <button onClick={split} disabled={status.busy || selected.size === 0} aria-busy={status.busy}>
              {selected.size > 1 ? `Split ${selected.size} sheets (download .zip)` : 'Split and download'}
            </button>
            <small class="hint">
              Formulas that reference other sheets become #REF! when Excel recalculates.
            </small>
          </footer>
        </article>
      )}
      <JobStatus status={status} />
    </>
  );
}
