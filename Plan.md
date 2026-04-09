# Plan: Standalone Mode + Local DOCX Export

## Context

EngineeringPaper.xyz currently requires a Cloudflare Pages backend for three things:
1. **Sheet save/load** via Cloudflare KV (shareable links)
2. **Doc generation** (DOCX/PDF/TEX) via an external `DOCGEN_API` service (which uses pandoc on the server)
3. **CSP headers and canonical URLs** (worker-level HTML rewriting)

All computation already runs in-browser (Pyodide/SymPy). The goal is to create a standalone build that works without any server, with local DOCX export using `pandoc-wasm` (same engine as the server, producing identical output with native Word OMML equations). PDF export will use the browser's print dialog (print styles already exist). LaTeX export will be disabled in standalone mode.

---

## Part 1: Build System — Standalone Flag

### `package.json`
Add scripts:
```
"dev:standalone": "cross-env ROLLUP_STANDALONE=1 rollup -c -w"
"build:standalone": "cross-env ROLLUP_STANDALONE=1 rollup -c"
"start:standalone": "npx serve public -l 8788 --single"
```
Add dev dependencies: `cross-env`, `@rollup/plugin-replace`

### `rollup.config.js`
- Read `const standalone = !!process.env.ROLLUP_STANDALONE;`
- **Skip the `_worker.ts` bundle** (first entry in the array, lines 44-60) when `standalone` is true
- Add `@rollup/plugin-replace` to the main app bundle (5th entry) to define `__STANDALONE__` as `"true"` or `"false"`
- In `serve()` function (lines 22-41): when standalone, spawn `npx serve public -l 8788 --single` instead of `npm run start` (wrangler). The `--single` flag is needed for SPA route fallback.

---

## Part 2: Frontend — Gate Server Features

### `src/App.svelte`

Declare at top of script: `declare const __STANDALONE__: boolean;`

**Disable when `__STANDALONE__`:**

| Feature | Lines (approx) | Action |
|---------|------|--------|
| `uploadSheet()` | ~1093 | Early-return with error modal "Not available in standalone mode" |
| `loadSheetFromUrl()` for hash paths | ~786-788 | Show "not available" modal instead of fetching |
| "Get Shareable Link" button/menu | ~2575 | Hide with `{#if !__STANDALONE__}` |
| Example Sheets links | sidebar menu | Hide with `{#if !__STANDALONE__}` |
| Prebuilt Tables links | sidebar menu | Hide with `{#if !__STANDALONE__}` |
| Recent Sheets (URL-based only) | sidebar | Filter to file-handle entries only |

**Modify `getDocument()` (~line 1991):**
- For `docx`: route to pandoc-wasm local export (see Part 3)
- For `pdf`: call `window.print()` (existing print styles already handle layout)
- For `tex`: disable in standalone (hide option in download modal)

### `src/DownloadDocumentModal.svelte`

- Import `__STANDALONE__` flag
- When standalone:
  - Change docx label from "processed on the EngineeringPaper.xyz server" → "generated locally, no data leaves your computer"
  - Change PDF label to "Uses browser print dialog (no data leaves your computer)"
  - Hide LaTeX option (`{#if !__STANDALONE__}`)
  - Hide "Create a shareable link" checkbox

---

## Part 3: Local DOCX Export via pandoc-wasm

### New dependency: `pandoc-wasm`

pandoc-wasm is the full pandoc engine compiled to WebAssembly. The server's docgen endpoint already uses pandoc, so this produces **identical output** — including native Word OMML equations from LaTeX math (`$...$` and `$$...$$`).

The WASM binary is ~15MB and will be loaded on-demand only when the user exports to DOCX (via dynamic import + code splitting).

### New file: `src/docxExport.ts`

```typescript
import { init, run } from "pandoc-wasm";

let initialized = false;

export async function generateDocx(
  markdown: string,
  title: string,
  paperSize: "a4" | "letter"
): Promise<Blob> {
  if (!initialized) {
    await init();  // loads the WASM binary
    initialized = true;
  }

  const geometry = paperSize === "a4"
    ? "a4paper,margin=1in"
    : "letterpaper,margin=1in";

  const result = await run({
    input: markdown,
    from: "markdown",
    to: "docx",
    options: [
      "--metadata", `title=${title}`,
      "--variable", `geometry:${geometry}`,
      "--standalone"
    ]
  });

  return new Blob([result], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}
```

**Key points:**
- `pandoc-wasm` handles the full markdown→docx pipeline including LaTeX→OMML conversion
- Paper size is passed via pandoc's `--variable geometry:` option
- The `--standalone` flag produces a complete document
- No need for MathJax, marked, or html-to-docx — pandoc does everything
- Plot images are already embedded as base64 PNGs in the markdown (`![](data:image/png;base64,...)`)

### Integration in `getDocument()` (`src/App.svelte` ~line 1999)

After the markdown early-return (line 1999-2001), add:

```typescript
if (settings.docType === "docx" && __STANDALONE__) {
  modalInfo = {state: "generatingDocument", modalOpen: true, heading: "Generating Document"};
  try {
    const { generateDocx } = await import("./docxExport");
    const docxBlob = await generateDocx(markDown, appState.title, settings.paperSize);
    saveFileBlob(docxBlob, `${appState.title}.docx`);
    modalInfo.modalOpen = false;
  } catch (error) {
    console.log(`Error creating docx document: ${error}`);
    modalInfo = {state: "error", error, modalOpen: true, heading: modalInfo.heading};
  }
  return;
}

if (settings.docType === "pdf" && __STANDALONE__) {
  window.print();
  return;
}
```

Dynamic `import()` ensures code-splitting — pandoc-wasm only loads when user exports.

---

## Part 4: Local PDF via Browser Print

The app already has extensive `@media print` styles across many components (App.svelte, Cell.svelte, CellList.svelte, MathCell.svelte, PlotCell.svelte, etc.). In standalone mode, selecting "PDF" triggers `window.print()`.

---

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add scripts, add `cross-env`, `@rollup/plugin-replace`, `pandoc-wasm` deps |
| `rollup.config.js` | Conditional worker skip, `@rollup/plugin-replace`, conditional serve |
| `src/App.svelte` | Gate server features, wire local DOCX (pandoc-wasm) + print-to-PDF |
| `src/DownloadDocumentModal.svelte` | Adjust labels, hide LaTeX, hide shareable link |
| **`src/docxExport.ts`** (new) | pandoc-wasm wrapper (~20 lines) |

## Existing Code to Reuse

- `saveFileBlob()` — `src/utility.ts` — triggers file download
- `getMarkdown()` — `src/App.svelte:1966` — generates markdown from all cells (already produces LaTeX math syntax that pandoc understands)
- Print styles — already exist across all cell components

## Verification

1. `npm run build:standalone && npx serve public -l 8788 --single`
2. Open http://localhost:8788 — app should load with a blank sheet
3. Verify no network requests to external servers (DevTools Network tab)
4. Open the example `240V CRPS.epxyz` file via File > Open
5. Export as DOCX — compare with reference `240V CRPS RC 301k.docx` — equations should be native Word equations (editable in Word), not images
6. Export as PDF — browser print dialog should open with correct layout
7. Verify "Share" / "Get Shareable Link" options are hidden
8. Verify .epxyz save/load still works
9. Verify autosave checkpoints still work
10. Test in Chrome and Firefox
