import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
const HOST = process.env.HOST || '127.0.0.1';
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
const rateBuckets = new Map();

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 254;
}

function clientAddress(req) {
  return req.socket.remoteAddress || 'unknown';
}

function isRateLimited(req) {
  const now = Date.now();
  const key = clientAddress(req);
  const bucket = rateBuckets.get(key) || { startedAt: now, count: 0 };
  if (now - bucket.startedAt >= RATE_WINDOW_MS) {
    bucket.startedAt = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count > RATE_LIMIT;
}

/**
 * Mengambil CSRF token dan Session Cookie dari server target
 */
async function fetchTargetCsrf() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://otp.carikartun.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Server target mengembalikan status ${res.status}`);
    }

    const html = await res.text();
    const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
    const cookieHeader = (cookies || []).filter(Boolean).map(c => c.split(';')[0]).join('; ');

    const match = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
    const csrfToken = match ? match[1] : null;

    if (!csrfToken) {
      throw new Error('CSRF token tidak ditemukan pada halaman sumber');
    }

    return { csrfToken, cookieHeader };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Meminta OTP ke endpoint API target
 */
async function queryTargetOtp(email) {
  const { csrfToken, cookieHeader } = await fetchTargetCsrf();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://otp.carikartun.com/api/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
        'Cookie': cookieHeader,
        'Referer': 'https://otp.carikartun.com/',
        'Origin': 'https://otp.carikartun.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({ email: email.trim() }),
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`Server target mengembalikan status ${res.status}`);
    const data = await res.json();
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// MIME types untuk static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const isAllowedOrigin = !origin || 
    origin.startsWith('http://localhost:') || 
    origin.startsWith('http://127.0.0.1:') || 
    origin.includes('rahmatpremium.cloud');

  if (!isAllowedOrigin) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Origin tidak diizinkan' }));
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // Endpoint API OTP (Mendukung POST dan GET)
  if (pathname === '/api/otp' || pathname === '/api/get-otp') {
    if (isRateLimited(req)) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': '60' });
      res.end(JSON.stringify({ ok: false, error: 'Terlalu banyak permintaan. Coba lagi nanti.' }));
      return;
    }
    let email = null;

    if (req.method === 'GET') {
      email = reqUrl.searchParams.get('email');
      handleOtpRequest(email, res);
      return;
    }

    if (req.method === 'POST') {
      let bodyStr = '';
      req.on('data', chunk => {
        bodyStr += chunk;
        if (bodyStr.length > 1e5) req.destroy();
      });

      req.on('end', () => {
        try {
          const parsed = JSON.parse(bodyStr || '{}');
          email = parsed.email;
          handleOtpRequest(email, res);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'Format JSON request tidak valid' }));
        }
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Metode HTTP tidak didukung' }));
    return;
  }

  // Handler Static Files dari folder public
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Akses Ditolak');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Halaman tidak ditemukan');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

async function handleOtpRequest(email, res) {
  if (!isValidEmail(email)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Alamat email wajib diisi dengan format yang benar' }));
    return;
  }

  try {
    const result = await queryTargetOtp(email.trim());
    const status = result && result.ok === false ? 502 : 200;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: Boolean(result && result.ok),
      email: email.trim(),
      otps: Array.isArray(result && result.otps) ? result.otps : [],
      ...(result && result.ok === false ? { error: 'Belum ada OTP masuk atau layanan sedang sibuk.' } : {})
    }));
  } catch (err) {
    console.error(`[Error] Gagal mengambil OTP untuk ${email}:`, err.message);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: false,
      error: 'Layanan sedang sibuk, silakan coba beberapa saat lagi.'
    }));
  }
}

function startServer(port) {
  server.listen(port, HOST, () => {
    const url = `http://localhost:${port}`;
    console.log(`==========================================================`);
    console.log(`  🚀 OTP LEONARDO Berhasil Berjalan!`);
    console.log(`  🔗 Tampilan Web : ${url}`);
    console.log(`  📡 API GET      : ${url}/api/get-otp?email=user@domain.com`);
    console.log(`  📡 API POST     : ${url}/api/get-otp (JSON: {"email": "..."})`);
    console.log(`==========================================================`);

    // Buka browser jika parameter --open diberikan
    if (process.argv.includes('--open')) {
      const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
      exec(`${startCmd} ${url}`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Pemberitahuan] Port ${port} sedang dipakai, mencoba port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[Error Server]:', err);
    }
  });
}

startServer(DEFAULT_PORT);
