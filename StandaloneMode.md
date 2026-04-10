# Standalone Mode + Local DOCX Export

A standalone build of EngineeringPaper.xyz that runs entirely in the browser with no server required. Computation already ran in-browser via Pyodide/SymPy. This build additionally moves DOCX export in-browser using `pandoc-wasm` and routes PDF export to the browser print dialog.

---

## How to Build and Run

### One-time setup

```bash
npm install
```

### Build the standalone version

```bash
npm run build:standalone
```

Output goes to `public/` as usual.

### Serve locally

```bash
npm run start:standalone
```

Opens at **http://localhost:8788**

> The `--single` flag is required so the dev server falls back to `index.html` for all routes (SPA behavior).

### Combined build + serve

```bash
npm run build:standalone && npm run start:standalone
```

### Live-reload dev mode

```bash
npm run dev:standalone
```

This watches for file changes and rebuilds automatically. The dev server starts automatically after the first build.

---

## Packaging as a Windows Executable

Produces a single `EngineeringPaper.exe` (~330 MB) with Node.js and all assets embedded. No prior software installation required on the target machine — double-click to launch.

### One-time setup

```bash
npm install
```

### Build the exe

```bash
npm run package:win
```

This runs `build:standalone` first (rebuilds `public/`), then packages everything into `dist/EngineeringPaper.exe`.

### Build steps separately (for debugging)

```bash
npm run build:standalone
npx pkg launcher.cjs --config package.json --targets node20-win-x64 --output dist/EngineeringPaper
```

### Build with verbose output

```bash
npm run build:standalone
npx pkg launcher.cjs --config package.json --targets node20-win-x64 --output dist/EngineeringPaper --debug
```

### Run

Double-click `dist/EngineeringPaper.exe`, or from a terminal:

```bash
./dist/EngineeringPaper.exe
```

The server starts at `http://localhost:8788` and your default browser opens automatically. Press `Ctrl+C` in the terminal to stop.

> If port 8788 is already in use (e.g. another instance is running), the exe will print an error and exit rather than hanging silently.

### Files added for packaging

| File | Purpose |
|------|---------|
| `launcher.cjs` | Streaming HTTP server + browser launcher (CommonJS, embedded by pkg) |
| `dist/EngineeringPaper.exe` | Final executable (gitignored) |

**`package.json` additions:** `package:win` script; `@yao-pkg/pkg` devDependency; `pkg.assets` config block pointing to `public/**/*`.

---

## What Is Disabled in Standalone Mode

| Feature | Behavior |
|---------|----------|
| Get Shareable Link | Button hidden from toolbar |
| Example Sheets | Hidden from sidebar |
| Prebuilt Tables | Hidden from sidebar |
| Load sheet from URL hash | Falls back to blank sheet |
| LaTeX export | Hidden from Save dialog |
| "Create shareable link" checkbox | Hidden from Save dialog |

`.epxyz` file save/load and autosave checkpoints work normally.

---

## What Changes for Export

| Format | Normal mode | Standalone mode |
|--------|-------------|-----------------|
| `.epxyz` | Local file | Local file (unchanged) |
| Markdown | Local file | Local file (unchanged) |
| DOCX | Sent to EngineeringPaper.xyz server | Generated locally via `pandoc-wasm` |
| PDF | Sent to EngineeringPaper.xyz server | Browser print dialog |
| LaTeX | Sent to EngineeringPaper.xyz server | Hidden (not available) |

DOCX export uses `pandoc-wasm` (the full pandoc engine compiled to WebAssembly, same engine as the server). Equations are converted to native Word OMML format — editable in Microsoft Word, not images. The WASM binary (~58 MB) is loaded on-demand the first time the user exports to DOCX.

---

## Extreme Value Analysis (EVA) Cell

A new cell type that finds worst-case min/max of an output expression by evaluating it at all 2^n combinations of input parameter min/max bounds, plus sensitivity analysis showing each parameter's contribution to the output variation.

### Usage

1. Define parameters on the sheet (e.g., `V = 10 [V]`, `R = 1000 [Ω]`, `I = V / R =`)
2. Insert an EVA cell (button 0 in the insert menu, or the Analytics icon)
3. Set the **Query** field to the expression to evaluate (e.g., `I=`)
4. Add parameter rows with **Parameter** name, **Min**, and **Max** values (plain numbers — units inherited from the sheet)
5. Results display the overall min and max output values, followed by a sensitivity list

### How it works

- For n parameters, the tool evaluates all 2^n combinations of min/max bounds
- Overrides `parameter_subs` in the existing SymPy evaluation pipeline (no full re-evaluation per combination)
- Max 20 parameters (2^20 = ~1M combinations)
- Results show the nominal value plus the extreme min and max
- **Sensitivity analysis**: For each parameter, varies it from min to max while holding others at their midpoint, measures the output change, and reports percentage contribution (sorted highest to lowest)

### Files added/changed

| File | Change |
|------|--------|
| `src/cells/ExtremeValueCell.svelte.ts` *(new)* | Cell model with parameter/min/max MathFields, query field, statement parsing |
| `src/ExtremeValueCell.svelte` *(new)* | UI component with grid table layout, result display |
| `src/cells/BaseCell.ts` | Added `"extremeValue"` to CellTypes, `DatabaseExtremeValueCell` type |
| `src/cells/Cells.ts` | Added to Cell union and cellFactory |
| `src/stores.svelte.ts` | Added to addCell, ExtremeValueResult in result types |
| `src/InsertCell.svelte` | Added EVA button (Analytics icon, key 0) |
| `src/Cell.svelte` | Added routing for ExtremeValueCell |
| `src/App.svelte` | Statement collection, result distribution, parsing error check |
| `src/types.ts` | `ExtremeValueDefinition`, `ExtremeValueParameter` types |
| `src/resultTypes.ts` | `SensitivityEntry`, `ExtremeValueResult` types and guard |
| `src/sheet/Sheet.ts` | Added ExtremeValueResult to Sheet results type |
| `public/dimensional_analysis.py` | EVA types, 2^n combination evaluation, sensitivity analysis in `evaluate_statements()` |

---

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Added `build:standalone`, `dev:standalone`, `start:standalone` scripts; added `cross-env`, `@rollup/plugin-replace`, `@rollup/plugin-url`, `pandoc-wasm` dependencies |
| `rollup.config.js` | Reads `ROLLUP_STANDALONE` env var; skips `_worker.ts` bundle when standalone; injects `__STANDALONE__` boolean via `replace` plugin; handles `.wasm` files as URL assets via `url` plugin; uses `npx serve` instead of wrangler in standalone dev mode |
| `src/App.svelte` | Declares `__STANDALONE__`; guards `uploadSheet()` with early return; falls back to blank sheet for hash URL navigation; routes DOCX export to `docxExport.ts`; routes PDF export to `window.print()`; hides "Get Shareable Link" toolbar button; hides Example Sheets and Prebuilt Tables sidebar menus |
| `src/DownloadDocumentModal.svelte` | Declares `__STANDALONE__`; updates DOCX/PDF labels for standalone; hides LaTeX radio button; hides "Create a shareable link" checkbox |
| `src/docxExport.ts` *(new)* | Wraps `pandoc-wasm` `convert()` to generate a `.docx` Blob from markdown input |
| `src/pandoc-wasm.d.ts` *(new)* | TypeScript type declarations for `pandoc-wasm` |
