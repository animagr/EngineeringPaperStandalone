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

// Browser selection: --browser flag takes priority, then browser.txt next to the exe, then system default.
// browser.txt example contents: chrome
//                                firefox
//                                C:\Program Files\Google\Chrome\Application\chrome.exe
function getBrowser() {
  const argIdx = process.argv.indexOf('--browser');
  if (argIdx !== -1 && process.argv[argIdx + 1]) {
    return process.argv[argIdx + 1].trim();
  }
  const configPath = path.join(path.dirname(process.execPath), 'browser.txt');
  try {
    return fs.readFileSync(configPath, 'utf8').trim();
  } catch {
    return null; // file not present — use system default
  }
}

function openBrowser(url) {
  const browser = getBrowser();
  let cmd;
  if (browser) {
    console.log(`Opening browser: ${browser}`);
    cmd = process.platform === 'win32'
      ? `start "" "${browser}" "${url}"`
      : `"${browser}" "${url}"`;
  } else {
    cmd = process.platform === 'win32' ? `start "" "${url}"`
        : process.platform === 'darwin' ? `open "${url}"`
        : `xdg-open "${url}"`;
  }
  exec(cmd);
}

function pauseAndExit(code) {
  // Keep the window open so the user can read the error before it closes
  console.error('\nPress Enter to close...');
  process.stdin.setRawMode && process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(code));
}

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
  openBrowser(url);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // Another instance is already running — just open the browser to it
    const url = `http://localhost:${PORT}`;
    console.log(`Server already running at ${url} — opening browser.`);
    openBrowser(url);
    setTimeout(() => process.exit(0), 1000);
  } else {
    console.error(`Server error: ${err.message}`);
    pauseAndExit(1);
  }
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
