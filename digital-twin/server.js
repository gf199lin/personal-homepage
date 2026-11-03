import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { loadEnv, ROOT, env, envInt } from './lib/env.js';
import { answerChat, healthInfo } from './lib/chat-service.js';
import { TwinError } from './lib/deepseek.js';

loadEnv();

const PORT = envInt('PORT', 8787);
const STATIC_DIR = resolve(ROOT, env('STATIC_DIR', '../publish-site'));
const MAX_BODY = 64 * 1024;
const RATE_LIMIT = envInt('RATE_LIMIT_PER_MIN', 12);
const ALLOWED = env('ALLOWED_ORIGINS', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/* ---------- 限流：内存滑动窗口，够单机演示用 ---------- */
const hits = new Map();

function rateLimited(ip) {
  if (RATE_LIMIT <= 0) return false;
  const now = Date.now();
  const windowStart = now - 60_000;
  const list = (hits.get(ip) || []).filter((t) => t > windowStart);
  if (list.length >= RATE_LIMIT) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [ip, list] of hits) {
    const kept = list.filter((t) => t > cutoff);
    if (kept.length) hits.set(ip, kept);
    else hits.delete(ip);
  }
}, 60_000).unref();

/* ---------- 工具 ---------- */
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED.includes('*') || ALLOWED.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

function json(res, status, body, req) {
  cors(req, res);
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new TwinError('请求体过大', { status: 413, code: 'body_too_large' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => reject(new TwinError('读取请求失败', { status: 400, code: 'bad_request' })));
  });
}

/* ---------- /api/chat ---------- */
async function handleChat(req, res) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return json(res, 429, { error: '问得有点快，歇一分钟再来。', code: 'rate_limited' }, req);
  }

  let payload;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw || '{}');
  } catch (err) {
    if (err instanceof TwinError) return json(res, err.status, { error: err.message, code: err.code }, req);
    return json(res, 400, { error: '请求格式不对', code: 'invalid_json' }, req);
  }

  const result = await answerChat({ question: payload.question, history: payload.history });
  return json(res, result.status, result.body, req);
}

/* ---------- 静态文件 ---------- */
function serveStatic(req, res) {
  if (!existsSync(STATIC_DIR)) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(`静态目录不存在：${STATIC_DIR}\n请在 .env 里设置 STATIC_DIR。`);
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    return res.end('bad request');
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  const target = resolve(join(STATIC_DIR, pathname));
  if (target !== STATIC_DIR && !target.startsWith(STATIC_DIR + sep)) {
    res.writeHead(403);
    return res.end('forbidden');
  }

  if (!existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('not found');
  }

  const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  createReadStream(target).pipe(res);
}

/* ---------- 入口 ---------- */
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') {
    cors(req, res);
    res.writeHead(204);
    return res.end();
  }

  if (pathname === '/api/health') {
    return json(
      res,
      200,
      {
        ...healthInfo(),
        staticDir: STATIC_DIR,
      },
      req
    );
  }

  if (pathname === '/api/chat') {
    if (req.method !== 'POST') return json(res, 405, { error: '只支持 POST' }, req);
    return handleChat(req, res);
  }

  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res);

  json(res, 404, { error: 'not found' }, req);
});

server.listen(PORT, () => {
  const live = healthInfo().live;
  console.log('');
  console.log('  gf 数字分身 本地服务');
  console.log('  ────────────────────────────────');
  console.log(`  页面   http://localhost:${PORT}/`);
  console.log(`  接口   http://localhost:${PORT}/api/chat`);
  console.log(`  健康   http://localhost:${PORT}/api/health`);
  console.log(`  静态   ${STATIC_DIR}`);
  console.log(`  模式   ${live ? 'live（调用 DeepSeek）' : 'mock（未配置 API Key）'}`);
  console.log('');
});
