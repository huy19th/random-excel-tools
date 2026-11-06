import { useState } from 'preact/hooks';
import { FileDropzone } from '../components/FileDropzone';
import { SheetPicker, allIndices } from '../components/SheetPicker';
import { JobStatus, type Status } from '../components/JobStatus';
import { readFile, runJob } from '../lib/client';
import { downloadBlob } from '../lib/download';
import type { NamingMode } from '../lib/merge';
import type { SheetInfo } from '../lib/split';

interface Item {
  id: number;
  file: File;
  sheets?: SheetInfo[];
  selected: Set<number>;
  error?: string;
}

let nextId = 1;

export function MergePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [naming, setNaming] = useState<NamingMode>('file');
  const [status, setStatus] = useState<Status>({ busy: false });

  const update = (id: number, patch: Partial<Item>) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addFiles = (files: File[]) => {
    const added = files.map((file) => ({ id: nextId++, file, selected: new Set<number>() }));
    setItems((list) => [...list, ...added]);
    for (const it of added) {
      readFile(it.file)
        .then((f) => runJob({ type: 'listSheets', file: f }))
        .then((sheets) => update(it.id, { sheets, selected: allIndices(sheets) }))
        .catch((e) => update(it.id, { error: e.message }));
    }
  };

  const move = (index: number, delta: number) =>
    setItems((list) => {
      const next = [...list];
      const [it] = next.splice(index, 1);
      next.splice(index + delta, 0, it);
      return next;
    });

  const ready = items.filter((it) => it.sheets && it.selected.size > 0);
  const loading = items.some((it) => !it.sheets && !it.error);
  const sheetCount = ready.reduce((n, it) => n + it.selected.size, 0);

  const merge = async () => {
    setStatus({ busy: true });
    try {
      const files = await Promise.all(
        ready.map(async (it) => ({ ...(await readFile(it.file)), sheets: [...it.selected].sort((a, b) => a - b) })),
      );
      const out = await runJob({ type: 'merge', files, naming }, (done, total) =>
        setStatus({ busy: true, progress: { done, total } }),
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
        <h1>Merge file Excel</h1>
        <p>Copy sheets from multiple files into a single workbook, in the order shown below.</p>
      </hgroup>

      <FileDropzone multiple onFiles={addFiles} />

      {items.map((it, i) => (
        <article key={it.id} class="file-card">
          <header>
            <strong>{it.file.name}</strong>
            <button class="secondary outline" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button class="secondary outline" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button class="secondary outline" onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))} aria-label="Remove">✕</button>
          </header>
          {it.error ? (
            <small style={{ color: 'var(--pico-del-color)' }}>{it.error}</small>
          ) : it.sheets ? (
            <SheetPicker sheets={it.sheets} selected={it.selected} onChange={(selected) => update(it.id, { selected })} />
          ) : (
            <progress />
          )}
        </article>
      ))}

      {items.length > 0 && (
        <>
          <label>
            Sheet naming
            <select value={naming} onChange={(e) => setNaming(e.currentTarget.value as NamingMode)}>
              <option value="file">File name (adds the sheet name if the file has several sheets)</option>
              <option value="file-sheet">FileName_SheetName</option>
              <option value="sheet">Keep original sheet names</option>
            </select>
            <small>Duplicate names get a (2), (3)… suffix. Excel limits sheet names to 31 characters.</small>
          </label>
          <button onClick={merge} disabled={status.busy || loading || ready.length === 0} aria-busy={status.busy}>
            Merge {sheetCount} {sheetCount === 1 ? 'sheet' : 'sheets'} and download
          </button>
          <small class="hint">
            Note: charts, pivot tables and macros are not copied to the merged file.
          </small>
        </>
      )}
      <JobStatus status={status} />
    </>
  );
}
