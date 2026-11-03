/**
 * 用腾讯云 SCF API 直接部署数字分身云函数（无需控制台点击）。
 *
 * 用法：
 *   1. 在 .deepworks/tmp/tencent-keys.txt 填 SecretId / SecretKey / Region
 *   2. node scripts/deploy-cloud-function.mjs
 *
 * 做的事：
 *   - 创建或更新函数 gf-twin-chat
 *   - 上传 dist/cloud-function.zip
 *   - 写入环境变量（Key 取自 digital-twin/.env，不会打印）
 *   - 开启函数 URL（免鉴权）
 *   - 调用 /api/health 验证
 *
 * 脚本不会输出任何密钥内容。
 */

import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const KEY_FILE = resolve(ROOT, '..', '.deepworks', 'tmp', 'tencent-keys.txt');

const SERVICE = 'scf';
const VERSION = '2018-04-16';
const HOST = 'scf.tencentcloudapi.com';
const FUNCTION_NAME = 'gf-twin-chat';

function loadKeys() {
  if (!existsSync(KEY_FILE)) {
    throw new Error(`缺少密钥文件: ${KEY_FILE}`);
  }
  const map = {};
  for (const line of readFileSync(KEY_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z]+)\s*[=:]\s*(.+?)\s*$/);
    if (m) map[m[1].toLowerCase()] = m[2];
  }
  if (!map.secretid || !map.secretkey) {
    throw new Error('密钥文件里需要 SecretId 和 SecretKey 两行');
  }
  return {
    secretId: map.secretid,
    secretKey: map.secretkey,
    region: map.region || 'ap-guangzhou',
  };
}

function loadEnvFile() {
  const path = join(ROOT, '.env');
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function hmac(key, text) {
  return createHmac('sha256', key).update(text, 'utf8').digest();
}

async function callApi(action, payload, keys) {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const canonicalHeaders =
    'content-type:application/json; charset=utf-8\n' +
    `host:${HOST}\n` +
    `x-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256Hex(body),
  ].join('\n');

  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const secretDate = hmac('TC3' + keys.secretKey, date);
  const secretService = hmac(secretDate, SERVICE);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = createHmac('sha256', secretSigning).update(stringToSign, 'utf8').digest('hex');

  const authorization =
    `TC3-HMAC-SHA256 Credential=${keys.secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${HOST}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json; charset=utf-8',
      Host: HOST,
      'X-TC-Action': action,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': VERSION,
      'X-TC-Region': keys.region,
    },
    body,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`响应不是 JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  const resp = json.Response || {};
  if (resp.Error) {
    const err = new Error(`${action} 失败: ${resp.Error.Code} - ${resp.Error.Message}`);
    err.code = resp.Error.Code;
    throw err;
  }
  return resp;
}

async function getFunction(keys) {
  try {
    return await callApi('GetFunction', { FunctionName: FUNCTION_NAME, Namespace: 'default' }, keys);
  } catch (err) {
    if (String(err.code || '').includes('ResourceNotFound')) return null;
    throw err;
  }
}

async function waitNotBusy(keys, maxMs = 90000) {
  const start = Date.now();
  let fn = await getFunction(keys);
  while (fn && /Updating|Creating|Deleting/i.test(fn.Status || '') && Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 3000));
    fn = await getFunction(keys);
  }
  return fn;
}

async function main() {
  const keys = loadKeys();
  const envMap = loadEnvFile();
  const zipPath = join(ROOT, 'dist', 'cloud-function.zip');
  if (!existsSync(zipPath)) throw new Error('缺少 dist/cloud-function.zip，先运行 npm run build:cloud');

  if (!envMap.DEEPSEEK_API_KEY) throw new Error('.env 里没有 DEEPSEEK_API_KEY');

  const zipBase64 = readFileSync(zipPath).toString('base64');
  console.log(`地域: ${keys.region}`);
  console.log(`函数: ${FUNCTION_NAME}`);
  console.log(`代码包: ${(readFileSync(zipPath).length / 1024).toFixed(1)} KB`);

  const common = {
    FunctionName: FUNCTION_NAME,
    Namespace: 'default',
  };

  // 1. 创建或更新代码
  const createPayload = {
    ...common,
    Runtime: 'Nodejs18.15',
    Handler: 'index.main',
    Description: 'gf 个人主页数字分身 · DeepSeek 后端',
    MemorySize: 128,
    Timeout: 30,
    Code: { ZipFile: zipBase64 },
    Environment: {
      Variables: [
        { Key: 'DEEPSEEK_API_KEY', Value: envMap.DEEPSEEK_API_KEY },
        { Key: 'DEEPSEEK_MODEL', Value: envMap.DEEPSEEK_MODEL || 'deepseek-chat' },
        { Key: 'ALLOWED_ORIGINS', Value: 'https://gf199lin.github.io' },
        { Key: 'MOCK_MODE', Value: 'auto' },
        { Key: 'RATE_LIMIT_PER_MIN', Value: '12' },
      ],
    },
  };

  const existing = await waitNotBusy(keys);
  if (!existing) {
    await callApi('CreateFunction', createPayload, keys);
    console.log('已创建函数');
  } else if (/CreateFailed|Failed/i.test(existing.Status || '')) {
    console.log(`函数状态为 ${existing.Status}，删除后重建`);
    await callApi('DeleteFunction', common, keys);
    await new Promise((r) => setTimeout(r, 8000));
    await callApi('CreateFunction', createPayload, keys);
    console.log('已重建函数');
  } else {
    console.log(`函数已存在（状态 ${existing.Status || 'Active'}），更新代码与配置`);
    await callApi('UpdateFunctionCode', { ...common, Code: { ZipFile: zipBase64 } }, keys);
    await waitNotBusy(keys);
    await callApi(
      'UpdateFunctionConfiguration',
      {
        ...common,
        MemorySize: 128,
        Timeout: 30,
        Environment: { Variables: createPayload.Environment.Variables },
      },
      keys
    );
    console.log('已更新代码与配置');
  }
  await waitNotBusy(keys);

  // 2. 查询/创建函数 URL
  let url = null;
  try {
    const r = await callApi(
      'DescribeFunctionUrl',
      { ...common, Qualifier: '$LATEST' },
      keys
    );
    url = r.Url || (r.FunctionUrl && r.FunctionUrl.Url) || null;
  } catch (err) {
    console.log(`查询函数 URL 失败: ${err.code || err.message}`);
  }

  if (!url) {
    try {
      const r = await callApi(
        'CreateFunctionUrl',
        {
          ...common,
          Qualifier: '$LATEST',
          AuthType: 'NONE',
          Cors: {
            AllowOrigins: ['https://gf199lin.github.io'],
            AllowMethods: ['GET', 'POST', 'OPTIONS'],
            AllowHeaders: ['*'],
            MaxAge: 3600,
          },
        },
        keys
      );
      url = r.Url || (r.FunctionUrl && r.FunctionUrl.Url) || null;
    } catch (err) {
      console.log(`创建函数 URL 失败: ${err.code || err.message}`);
      console.log('如果提示接口不存在，请在控制台「函数 URL」手动开启一次，之后脚本可复用');
    }
  }

  if (!url) {
    console.log('未能获取函数 URL，请在控制台开启后重新运行本脚本');
    return;
  }

  console.log(`函数 URL: ${url}`);

  // 3. 健康检查
  const healthUrl = url.replace(/\/+$/, '') + '/api/health';
  await new Promise((r) => setTimeout(r, 8000));
  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    console.log(`health: HTTP ${res.status} ${text.slice(0, 200)}`);
  } catch (err) {
    console.log(`health 请求失败（函数可能还在冷启动）: ${err.message}`);
    console.log(`请手动打开: ${healthUrl}`);
  }

  console.log('');
  console.log('下一步：把下面这行加进 publish-site/index.html');
  console.log(`window.TWIN_API = '${url.replace(/\/+$/, '')}/api/chat';`);
}

main().catch((err) => {
  console.error('部署失败:', err.message);
  process.exit(1);
});
