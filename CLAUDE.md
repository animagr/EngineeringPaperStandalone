# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EngineeringPaper.xyz is a web app for engineering calculations with automatic unit conversion/checking, plotting, systems of equations, and documentation. Calculations run in-browser using Pyodide (Python/WebAssembly) with SymPy as the computation engine.

## Build & Development Commands

This is the **standalone** fork — no server required. Use the standalone scripts:

```bash
npm install                # Install dependencies
npm run dev:standalone     # Dev server with live reload (localhost:8788)
npm run build:standalone   # Build production version to public/
npm run start:standalone   # Serve public/ locally (localhost:8788)
npm run package:win        # Build Windows exe to dist/EngineeringPaper.exe
npm run test               # Run Playwright test suite
npx playwright install     # Install browsers (one-time setup)
```

The non-standalone scripts (`npm run dev`, `npm run build`, `npm run start`) also exist and build the original Cloudflare-hosted version.

Note: Run `npm run build:standalone` then `npm run start:standalone` before running tests. Tests require the server running on port 8788.

### Standalone compile flag

`ROLLUP_STANDALONE=1` sets the `__STANDALONE__` boolean at build time (via `@rollup/plugin-replace`). Code guarded by `__STANDALONE__` disables server-dependent features (shareable links, example sheets, server-side DOCX/PDF/LaTeX export) and routes DOCX export through `pandoc-wasm` and PDF export through `window.print()`.

## Architecture

### Frontend (Svelte 5 + TypeScript + Rollup)
- **src/App.svelte** - Main application component (very large file)
- **src/stores.svelte.ts** - Global reactive state using Svelte 5 runes (`$state`)
- **src/cells/** - Cell type implementations (MathCell, PlotCell, TableCell, DataTableCell, DocumentationCell, PiecewiseCell, SystemCell, FluidCell, CodeCell, ExtremeValueCell)
- **src/sheet/Sheet.ts** - Sheet data structure, config types, and serialization

### Parser Pipeline (LaTeX -> SymPy)
- **src/parser/LatexToSympy.ts** - Main parser visitor that converts LaTeX math input to SymPy code
- **src/parser/LatexLexer.ts**, **LatexParser.ts** - ANTLR-generated lexer/parser
- **src/parser/parserWorker.ts** - Web worker for parsing operations
- Uses Math.js for unit parsing

### Computation (Pyodide/Python)
- **src/pyodideWorker.ts** - Web worker that runs Python via Pyodide
- **public/dimensional_analysis.py** - Core Python computation logic executed by SymPy
- Results are cached using QuickLRU

### Backend (Cloudflare Pages Functions)
- **src/database/_worker.ts** - Cloudflare Worker handling sheet storage/retrieval via KV
- Sheets are stored with 22-character hashes; checkpoints use `temp-checkpoint-{uuid}` format

## Testing

Tests use Playwright with a shared Pyodide instance per test file for performance:
- **tests/utility.mjs** - Test helpers including `loadPyodide()`, `newSheet()`, `parseLatexFloat()`
- Use `page.setLatex(cellIndex, latex, subIndex)` to set cell content
- Use `page.forceDeleteCell(index)` to remove cells
- Wait for `text=Updating...` to be detached before assertions

Run a single test file:
```bash
npx playwright test tests/test_basic.spec.mjs
```

## Key Constraints

- Must work in Chrome, Safari, and Firefox
- Must be usable on desktop and mobile
- Must format properly when printing
- Must maintain backwards compatibility with old saved sheets
- Minimize bundle size (already large due to Pyodide dependency)
