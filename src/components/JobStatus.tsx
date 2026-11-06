export interface Status {
  busy: boolean;
  progress?: { done: number; total: number };
  error?: string;
}

export function JobStatus({ status }: { status: Status }) {
  if (status.error) return <p role="alert" style={{ color: 'var(--pico-del-color)' }}>Error: {status.error}</p>;
  if (!status.busy) return null;
  const p = status.progress;
  return p ? <progress value={p.done} max={p.total} /> : <progress />;
}
