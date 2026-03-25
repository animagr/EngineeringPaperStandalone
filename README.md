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

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Added `build:standalone`, `dev:standalone`, `start:standalone` scripts; added `cross-env`, `@rollup/plugin-replace`, `@rollup/plugin-url`, `pandoc-wasm` dependencies |
| `rollup.config.js` | Reads `ROLLUP_STANDALONE` env var; skips `_worker.ts` bundle when standalone; injects `__STANDALONE__` boolean via `replace` plugin; handles `.wasm` files as URL assets via `url` plugin; uses `npx serve` instead of wrangler in standalone dev mode |
| `src/App.svelte` | Declares `__STANDALONE__`; guards `uploadSheet()` with early return; falls back to blank sheet for hash URL navigation; routes DOCX export to `docxExport.ts`; routes PDF export to `window.print()`; hides "Get Shareable Link" toolbar button; hides Example Sheets and Prebuilt Tables sidebar menus |
| `src/DownloadDocumentModal.svelte` | Declares `__STANDALONE__`; updates DOCX/PDF labels for standalone; hides LaTeX radio button; hides "Create a shareable link" checkbox |
| `src/docxExport.ts` *(new)* | Wraps `pandoc-wasm` `convert()` to generate a `.docx` Blob from markdown input |
| `src/pandoc-wasm.d.ts` *(new)* | TypeScript type declarations for `pandoc-wasm` |
