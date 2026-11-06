import type { Job, JobResult, WorkerMessage } from './protocol';

type Pending = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  onProgress?: (done: number, total: number) => void;
};

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      const p = pending.get(msg.id);
      if (!p) return;
      if (msg.kind === 'progress') return p.onProgress?.(msg.done, msg.total);
      pending.delete(msg.id);
      if (msg.kind === 'done') p.resolve(msg.result);
      else p.reject(new Error(msg.message));
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || 'Worker crashed'));
      pending.clear();
      worker = undefined;
    };
  }
  return worker;
}

/** Input buffers are transferred to the worker (they become unusable here). */
export function runJob<T extends Job>(
  job: T,
  onProgress?: (done: number, total: number) => void,
): Promise<JobResult[T['type']]> {
  const id = nextId++;
  const transfer: ArrayBuffer[] =
    job.type === 'merge' ? job.files.map((f) => f.data) : [job.file.data];
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, job }, transfer);
  });
}

export async function readFile(file: File) {
  return { name: file.name, data: await file.arrayBuffer() };
}
