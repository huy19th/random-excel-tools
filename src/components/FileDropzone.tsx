import { useState } from 'preact/hooks';

export const EXCEL_ACCEPT = '.xlsx,.xlsm';

interface Props {
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label?: string;
}

export function FileDropzone({ multiple, onFiles, label }: Props) {
  const [active, setActive] = useState(false);

  const accept = (list: FileList | null | undefined) => {
    const files = Array.from(list ?? []).filter((f) => /\.xls[xm]$/i.test(f.name));
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <label
      class={`dropzone${active ? ' active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setActive(true); }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => { e.preventDefault(); setActive(false); accept(e.dataTransfer?.files); }}
    >
      <input
        type="file"
        accept={EXCEL_ACCEPT}
        multiple={multiple}
        onChange={(e) => { accept(e.currentTarget.files); e.currentTarget.value = ''; }}
      />
      <p style={{ margin: 0 }}>
        {label ?? (multiple ? 'Drop Excel files here' : 'Drop an Excel file here')}
        <br />
        <small>or click to browse (.xlsx, .xlsm)</small>
      </p>
    </label>
  );
}
