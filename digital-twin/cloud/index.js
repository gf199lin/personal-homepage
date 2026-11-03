'use strict';

/**
 * 腾讯云云函数（SCF）入口：CJS 壳 + 动态加载 ESM 业务层。
 * 这样不需要改动 lib/ 里的源码，也不依赖运行时对 ESM 入口的支持。
 *
 * 控制台配置：入口 index.main，运行时 Nodejs18.15+，超时 >= 30 秒。
 * 环境变量：DEEPSEEK_API_KEY、DEEPSEEK_MODEL=deepseek-chat、
 *          ALLOWED_ORIGINS=https://gf199lin.github.io、MOCK_MODE=auto
 */

let appPromise = null;

function loadApp() {
  if (!appPromise) appPromise = import('./app.mjs');
  return appPromise;
}

const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const RATE_LIMIT = Number.parseInt(process.env.RATE_LIMIT_PER_MIN || '12', 10);

const hits = new Map();

function rateLimited(ip, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return false;
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => t > now - 60_000);
  if (list.length >= limit) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  return false;
}

function normalizeHeaders(headers) {
  const out = {};
  for (const key of Object.keys(headers || {})) {
    out[String(key).toLowerCase()] = headers[key];
  }
  return out;
}

function corsHeaders(origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (origin && (ALLOWED.includes('*') || ALLOWED.includes(origin))) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
    headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return headers;
}

function reply(statusCode, body, headers) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
    isBase64Encoded: false,
  };
}

exports.main = async (event) => {
  const ev = event || {};
  const method = String(ev.httpMethod || (ev.requestContext && ev.requestContext.httpMethod) || 'GET').toUpperCase();
  const path = ev.path || (ev.requestContext && ev.requestContext.path) || '/';
  const headers = normalizeHeaders(ev.headers);
  const origin = headers.origin;
  const outHeaders = corsHeaders(origin);

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: outHeaders, body: '', isBase64Encoded: false };
  }

  const sourceIp =
    (ev.requestContext && ev.requestContext.sourceIp) ||
    (headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    'unknown';

  if (rateLimited(sourceIp, RATE_LIMIT)) {
    return reply(429, { error: '问得有点快，歇一分钟再来。', code: 'rate_limited' }, outHeaders);
  }

  let app;
  try {
    app = await loadApp();
  } catch (err) {
    console.error('[boot]', err);
    return reply(500, { error: '服务没起来，稍后再试。', code: 'boot_failed' }, outHeaders);
  }

  if (path === '/api/health') {
    return reply(200, app.healthInfo(), outHeaders);
  }

  if (path === '/api/chat') {
    if (method !== 'POST') {
      return reply(405, { error: '只支持 POST' }, outHeaders);
    }

    let payload = {};
    try {
      let raw = ev.body || '';
      if (ev.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      return reply(400, { error: '请求格式不对', code: 'invalid_json' }, outHeaders);
    }

    const result = await app.answerChat({
      question: payload.question,
      history: payload.history,
    });
    return reply(result.status, result.body, outHeaders);
  }

  return reply(404, { error: 'not found' }, outHeaders);
};
