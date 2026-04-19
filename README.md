# EngineeringPaper.xyz — Standalone Edition

A standalone build of [EngineeringPaper.xyz](https://engineeringpaper.xyz) that runs entirely in the browser with no server required.

> **Fork notice:** This is a fork of the original EngineeringPaper.xyz, based on version **20260313**. The upstream project is hosted at [engineeringpaper.xyz](https://engineeringpaper.xyz).

---

## What Is EngineeringPaper.xyz?

A web app for engineering calculations with:
- Automatic unit conversion and dimensional analysis
- Plotting and data tables
- Systems of equations
- Documentation cells with rich text

Calculations run in-browser using **Pyodide** (Python compiled to WebAssembly) with **SymPy** as the computation engine.

---

## What's Different in Standalone Mode

This fork removes all server dependencies. Everything runs locally:

| Feature | Original | Standalone |
|---------|----------|------------|
| Computation | In-browser (Pyodide/SymPy) | Same |
| `.epxyz` save/load | Local file | Same |
| Markdown export | Local file | Same |
| DOCX export | Server-side (pandoc) | In-browser via `pandoc-wasm` |
| PDF export | Server-side | Browser print dialog |
| LaTeX export | Server-side | Hidden (not available) |
| Shareable links | Server-required | Hidden |
| Example sheets | Server-required | Hidden |
| Prebuilt tables | Server-required | Hidden |

DOCX export uses `pandoc-wasm` (the full pandoc engine compiled to WebAssembly). Equations are converted to native Word OMML format — editable in Microsoft Word, not images. The WASM binary (~58 MB) loads on-demand the first time you export to DOCX.

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

Output goes to `public/`.

### Serve locally

```bash
npm run start:standalone
```

Opens at **http://localhost:8788**

### Combined build + serve

```bash
npm run build:standalone && npm run start:standalone
```

### Live-reload dev mode

```bash
npm run dev:standalone
```

Watches for file changes and rebuilds automatically.

---

## Packaging as a Windows Executable

Produces a single `EngineeringPaper.exe` (~330 MB) with Node.js and all assets embedded. No prior software installation required on the target machine — double-click to launch.

### Build the exe

```bash
npm run package:win
```

This runs `build:standalone` first, then packages everything into `dist/EngineeringPaper.exe`.

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

> If port 8788 is already in use (e.g. another instance is running), the exe will print an error and exit.

### Choosing a browser (browser.txt)

By default, the exe opens your system's default browser. To use a specific browser, create a `browser.txt` file in the same folder as the exe (`dist/browser.txt`).

**For Chrome:**

```
chrome
```

**For Firefox:**

```
firefox
```

**For a specific browser path:**

```
C:\Program Files\Google\Chrome\Application\chrome.exe
```

The file should contain just one line with the browser name or full path. Delete the file (or leave it empty) to revert to system default.

You can also override via command line:

```bash
./dist/EngineeringPaper.exe --browser firefox
```

### Troubleshooting: port 8788 already in use

If the exe opens the browser but shows an old version, a previous server process may still be running. Kill it first:

```bash
netstat -ano | findstr :8788
taskkill /PID <pid> /F
```

Then relaunch the exe.

---

## New Features in This Fork

### Annotation Column for Math Cells

Math cells have an optional annotation column to the right for units descriptions, notes, or labels (e.g., "velocity", "kg/m^3").

- Click a math cell to reveal the annotation input
- Saves automatically and persists with the sheet
- Included in Markdown/DOCX export as `*[annotation]*`
- Hidden on narrow screens (< 500px)

### Extreme Value Analysis (EVA) Cell

A new cell type that finds worst-case min/max of an output expression by evaluating all 2^n combinations of input parameter bounds, plus sensitivity analysis.

**Usage:**

1. Define parameters on the sheet (e.g., `V = 10 [V]`, `R = 1000 [Ω]`, `I = V / R =`)
2. Insert an EVA cell (button 0 in the insert menu, or the Analytics icon)
3. Set the **Query** field to the expression to evaluate (e.g., `I=`)
4. Add parameter rows with **Parameter** name, **Min**, and **Max** values

**How it works:**

- Evaluates all 2^n combinations of min/max bounds (max 20 parameters)
- Shows nominal value plus extreme min and max
- Sensitivity analysis: varies each parameter while holding others at midpoint, reports percentage contribution (sorted highest to lowest)

---

## Files Added for Packaging

| File | Purpose |
|------|---------|
| `launcher.cjs` | Streaming HTTP server + browser launcher (CommonJS, embedded by pkg) |
| `dist/EngineeringPaper.exe` | Final executable (gitignored) |

---

## Technical Details

### Standalone compile flag

`ROLLUP_STANDALONE=1` sets the `__STANDALONE__` boolean at build time via `@rollup/plugin-replace`. Code guarded by `__STANDALONE__` disables server-dependent features and routes exports through local alternatives.

### Key file changes

| File | Change |
|------|--------|
| `package.json` | Added `build:standalone`, `dev:standalone`, `start:standalone`, `package:win` scripts; added `cross-env`, `@rollup/plugin-replace`, `@rollup/plugin-url`, `pandoc-wasm`, `@yao-pkg/pkg` dependencies |
| `rollup.config.js` | Reads `ROLLUP_STANDALONE` env var; skips `_worker.ts` bundle; injects `__STANDALONE__` boolean; handles `.wasm` files as URL assets |
| `src/App.svelte` | Guards server features; routes DOCX/PDF export locally; hides server-dependent UI |
| `src/DownloadDocumentModal.svelte` | Updates export labels; hides LaTeX and shareable link options |
| `src/docxExport.ts` *(new)* | Wraps `pandoc-wasm` for in-browser DOCX generation |
| `src/cells/ExtremeValueCell.svelte.ts` *(new)* | EVA cell model |
| `src/ExtremeValueCell.svelte` *(new)* | EVA cell UI |
| `public/dimensional_analysis.py` | EVA evaluation and sensitivity analysis |

---

## License

See the original [EngineeringPaper.xyz](https://engineeringpaper.xyz) project for license information.
