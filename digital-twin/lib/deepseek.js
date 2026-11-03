import { env, envFloat, envInt } from './env.js';

const DEFAULT_BASE = 'https://api.deepseek.com';

export class TwinError extends Error {
  constructor(message, { status = 500, code = 'internal_error' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function hasApiKey() {
  return Boolean(env('DEEPSEEK_API_KEY'));
}

export async function chatWithDeepSeek(messages, { signal, temperature, maxTokens } = {}) {
  const apiKey = env('DEEPSEEK_API_KEY');
  if (!apiKey) throw new TwinError('未配置 DEEPSEEK_API_KEY', { status: 503, code: 'no_key' });

  const base = env('DEEPSEEK_BASE_URL', DEFAULT_BASE).replace(/\/+$/, '');
  const model = env('DEEPSEEK_MODEL', 'deepseek-chat');

  const payload = {
    model,
    messages,
    temperature: temperature ?? envFloat('DEEPSEEK_TEMPERATURE', 0.8),
    max_tokens: maxTokens ?? envInt('DEEPSEEK_MAX_TOKENS', 600),
    stream: false,
  };

  let res;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new TwinError('请求超时', { status: 504, code: 'timeout' });
    }
    throw new TwinError('上游网络不可达', { status: 502, code: 'upstream_unreachable' });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // 不把上游原始报文直接回给浏览器，避免泄露账户信息；只保留状态码用于排查。
    throw new TwinError(`上游返回 ${res.status}`, {
      status: res.status === 429 ? 429 : 502,
      code: res.status === 429 ? 'rate_limited_upstream' : 'upstream_error',
      detail,
    });
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new TwinError('上游返回为空', { status: 502, code: 'empty_completion' });
  }

  return {
    reply: content.trim(),
    usage: data.usage || null,
    model: data.model || model,
  };
}
