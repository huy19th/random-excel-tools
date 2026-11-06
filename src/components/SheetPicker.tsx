import type { SheetInfo } from '../lib/split';

interface Props {
  sheets: SheetInfo[];
  selected: Set<number>;
  onChange: (selected: Set<number>) => void;
}

export function SheetPicker({ sheets, selected, onChange }: Props) {
  const toggle = (i: number) => {
    const next = new Set(selected);
    next.has(i) ? next.delete(i) : next.add(i);
    onChange(next);
  };
  return (
    <fieldset class="sheet-list">
      {sheets.map((s) => (
        <label key={s.index}>
          <input type="checkbox" checked={selected.has(s.index)} onChange={() => toggle(s.index)} />
          {s.name}
          {s.hidden && <span class="muted"> (hidden)</span>}
        </label>
      ))}
    </fieldset>
  );
}

export function allIndices(sheets: SheetInfo[]): Set<number> {
  return new Set(sheets.map((s) => s.index));
}
