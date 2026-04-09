# Plan: Standalone Executable Packaging

## Context

The app already has a standalone web build (no Cloudflare server required). The goal is to package it as a single double-clickable `.exe` for Windows that:
1. Starts a local HTTP server (required — the app uses Web Workers, Service Workers, and `fetch()`, none of which work from `file://` URLs)
2. Opens the user's default browser to `http://localhost:8788`
3. Requires no prior software installation (Node.js is embedded in the executable)

**Approach: `@yao-pkg/pkg` + minimal Node.js HTTP server**

- `@yao-pkg/pkg` (v6.x) is the actively maintained community fork of Vercel's `pkg` — it packages a Node.js script + static assets into a single native executable
- Uses the user's own browser (no Electron/Chromium overhead)
- The 165 MB `public/` directory is embedded into the exe via pkg's snapshot filesystem
- Final exe size: ~250 MB

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `launcher.cjs` | **New** — Streaming HTTP server + browser launcher (CommonJS for pkg compatibility) |
| `package.json` | Add `@yao-pkg/pkg` devDependency, add `package:win` script, add `pkg` config block |
| `.gitignore` | Add `dist/` |

---

## Part 1: `launcher.cjs`

A self-contained Node.js script. CommonJS (not ESM) because pkg works more reliably with CJS.

```js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.py': 'text/x-python',
  '.txt': 'text/plain',
  '.map': 'application/json',
};

// In a pkg executable, __dirname points into the snapshot filesystem
const PUBLIC = path.join(__dirname, 'public');
const PORT = 8788;

function serve(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // SPA fallback: paths without a file extension serve index.html
  if (!path.extname(urlPath)) {
    urlPath = '/index.html';
  }

  const filePath = path.join(PUBLIC, urlPath);

  // Use streaming to avoid buffering large files (WASM binaries, etc.) into memory
  const stream = fs.createReadStream(filePath);
  stream.on('open', () => {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    stream.pipe(res);
  });
  stream.on('error', () => {
    // Fallback to index.html for SPA routing
    const indexStream = fs.createReadStream(path.join(PUBLIC, 'index.html'));
    indexStream.on('open', () => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      indexStream.pipe(res);
    });
    indexStream.on('error', () => {
      res.writeHead(404);
      res.end('Not found');
    });
  });
}

const server = http.createServer(serve);

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`EngineeringPaper.xyz running at ${url}`);
  console.log('Press Ctrl+C to stop.');

  const cmd = process.platform === 'win32' ? `start "" "${url}"`
            : process.platform === 'darwin' ? `open "${url}"`
            : `xdg-open "${url}"`;
  exec(cmd);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Is EngineeringPaper already running?`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
```

**Key changes from original plan:**
- Uses `fs.createReadStream` + `pipe` instead of `fs.readFile` — avoids buffering 56 MB WASM files into memory per request
- Added `.woff`, `.mjs`, `.jpg` MIME types
- Added "Press Ctrl+C to stop" hint so the console window isn't confusing

---

## Part 2: `package.json` changes

### Add devDependency
```json
"@yao-pkg/pkg": "^6.14.1"
```

### Add script
```json
"package:win": "npm run build:standalone && npx pkg launcher.cjs --targets node20-win-x64 --output dist/EngineeringPaper"
```

Note: uses `npx pkg` (not bare `pkg`) so it works without a global install. The `--output` omits `.exe` — pkg appends the platform suffix automatically on Windows.

### Add pkg config block (top-level in package.json)
```json
"pkg": {
  "assets": ["public/**/*"]
}
```

The `assets` glob tells pkg to embed all files under `public/` into its snapshot virtual filesystem. The launcher reads them at runtime via `fs.createReadStream` — pkg intercepts these calls transparently.

---

## Part 3: `.gitignore`

Add `dist/` to `.gitignore` so the built executable isn't committed.

---

## Build & Run

```bash
npm install
npm run package:win
# Output: dist/EngineeringPaper.exe (~250 MB)

# Double-click or run from terminal:
./dist/EngineeringPaper.exe
# → Starts server at http://localhost:8788
# → Opens default browser automatically
```

---

## Verification

1. `npm run package:win` completes without errors, producing `dist/EngineeringPaper.exe`
2. Double-click the exe from any directory — browser opens to `http://localhost:8788`
3. App loads, Pyodide initializes (enter a math expression like `x = 5 [m]`)
4. DOCX export works (File > Save > DOCX)
5. PDF export opens browser print dialog
6. No "Get Shareable Link" button visible
7. Running a second instance shows "port already in use" error
8. Ctrl+C in the terminal shuts down cleanly

---

## Size Breakdown (estimated)

| Component | Size |
|-----------|------|
| Node.js runtime (embedded) | ~80 MB |
| `public/pyodide/` | 92 MB |
| `public/build/` (includes 56 MB pandoc WASM) | 64 MB |
| `public/` (fonts, images, html, etc.) | ~9 MB |
| **Total exe** | **~245 MB** |
