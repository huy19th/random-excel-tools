/** Name helpers shared by merge and split. */

export const MAX_SHEET_NAME = 31;

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

export function extName(fileName: string): string {
  return /\.[^.]+$/.exec(fileName)?.[0].toLowerCase() ?? '';
}

/** Excel forbids \ / ? * [ ] : in sheet names, and they cannot start/end with '. */
export function sanitizeSheetName(name: string): string {
  const clean = name
    .replace(/[\\/?*[\]:]/g, '_')
    .replace(/^'+|'+$/g, '')
    .trim();
  return (clean || 'Sheet').slice(0, MAX_SHEET_NAME);
}

/**
 * Return a sheet name that is not in `used` (case-insensitive, as Excel compares them),
 * appending " (2)", " (3)"... while respecting the 31-character limit. Adds it to `used`.
 */
export function uniqueSheetName(wanted: string, used: Set<string>): string {
  const base = sanitizeSheetName(wanted);
  let name = base;
  for (let n = 2; used.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    name = base.slice(0, MAX_SHEET_NAME - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'file';
}
