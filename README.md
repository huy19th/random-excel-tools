# Excel Tools

Excel tools that run entirely in the browser, hosted on GitHub Pages. Files are never uploaded anywhere.

- **Merge**: combine sheets from multiple `.xlsx`/`.xlsm` files into a single workbook.
- **Split**: turn each sheet into its own file (multiple sheets are downloaded as a `.zip`).

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest
npm run build    # outputs to dist/
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which tests, builds and deploys the site.
The first time, go to **Settings → Pages → Source** and select **GitHub Actions**.

## Architecture

| File | Purpose |
|---|---|
| `src/lib/split.ts` | Splits by editing the OOXML package directly (JSZip). Preserves styles, charts, images and macros. |
| `src/lib/merge.ts` | Merges with ExcelJS, copying cells, styles, merged ranges, column widths/row heights, validation and images. |
| `src/lib/worker.ts` | Runs merge/split in a Web Worker so the UI stays responsive. |
| `src/lib/client.ts` | Promise-based wrapper for sending jobs to the worker, with progress reporting. |
| `src/pages/*` | Preact pages using hash routing (`#/merge`, `#/split`). |

## Known limitations

- Merge: charts, pivot tables, macros and slicers are not copied (ExcelJS limitation).
- Split: formulas that reference removed sheets become `#REF!` when Excel recalculates.
- Legacy `.xls` (binary format) is not supported yet.
