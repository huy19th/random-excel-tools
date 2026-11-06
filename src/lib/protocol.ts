import type { NamingMode } from './merge';
import type { SheetInfo } from './split';

export interface InputFile {
  name: string;
  data: ArrayBuffer;
}

export type Job =
  | { type: 'listSheets'; file: InputFile }
  | { type: 'merge'; files: (InputFile & { sheets?: number[] })[]; naming: NamingMode }
  | { type: 'split'; file: InputFile; sheets?: number[] };

export interface JobResult {
  listSheets: SheetInfo[];
  merge: { name: string; data: ArrayBuffer };
  /** A single file if one sheet was selected, otherwise a .zip of all files. */
  split: { name: string; data: ArrayBuffer };
}

export type WorkerMessage =
  | { id: number; kind: 'progress'; done: number; total: number }
  | { id: number; kind: 'done'; result: unknown }
  | { id: number; kind: 'error'; message: string };
