/// <reference lib="webworker" />
import { mergeWorkbooks } from './merge';
import { listSheets, splitWorkbook, zipFiles } from './split';
import { baseName } from './names';
import type { Job, JobResult, WorkerMessage } from './protocol';

const post = (msg: WorkerMessage, transfer: Transferable[] = []) =>
  (self as DedicatedWorkerGlobalScope).postMessage(msg, transfer);

const toArrayBuffer = (u: Uint8Array): ArrayBuffer =>
  u.byteOffset === 0 && u.byteLength === u.buffer.byteLength
    ? (u.buffer as ArrayBuffer)
    : (u.slice().buffer as ArrayBuffer);

async function run(job: Job, progress: (done: number, total: number) => void) {
  switch (job.type) {
    case 'listSheets':
      return listSheets(job.file.data) satisfies Promise<JobResult['listSheets']>;

    case 'merge': {
      const data = await mergeWorkbooks(job.files, { naming: job.naming, onProgress: progress });
      return { name: 'merged.xlsx', data } satisfies JobResult['merge'];
    }

    case 'split': {
      const files = await splitWorkbook(job.file.name, job.file.data, job.sheets, progress);
      if (files.length === 1) return { name: files[0].name, data: toArrayBuffer(files[0].data) };
      const zip = await zipFiles(files);
      return { name: `${baseName(job.file.name)}.zip`, data: toArrayBuffer(zip) } satisfies JobResult['split'];
    }
  }
}

self.onmessage = async (e: MessageEvent<{ id: number; job: Job }>) => {
  const { id, job } = e.data;
  try {
    const result = await run(job, (done, total) => post({ id, kind: 'progress', done, total }));
    const data = (result as { data?: unknown }).data;
    post({ id, kind: 'done', result }, data instanceof ArrayBuffer ? [data] : []);
  } catch (err) {
    post({ id, kind: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
