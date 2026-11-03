import { buildSystemPrompt, buildMessages } from './prompt.js';
import { chatWithDeepSeek, hasApiKey, TwinError } from './deepseek.js';
import { mockReply } from './mock.js';
import { env, envInt } from './env.js';

const MAX_TURNS = envInt('MAX_HISTORY_TURNS', 8);

/**
 * 对话核心：与 HTTP 框架无关。
 * 本地 server 和云函数适配层都调这里，保证行为一致。
 */
export async function answerChat({ question, history }) {
  const clean = typeof question === 'string' ? question.trim() : '';

  if (!clean) {
    return { status: 400, body: { error: '问点什么吧', code: 'empty_question' } };
  }
  if (clean.length > 1000) {
    return { status: 400, body: { error: '问题太长了', code: 'question_too_long' } };
  }

  const mode = env('MOCK_MODE', 'auto');
  const useMock = mode === 'true' || (mode === 'auto' && !hasApiKey());

  if (useMock) {
    return {
      status: 200,
      body: { reply: mockReply(clean), mode: 'mock', model: 'mock' },
    };
  }

  const messages = buildMessages({
    system: buildSystemPrompt(),
    history,
    question: clean,
    maxTurns: MAX_TURNS,
  });

  try {
    const result = await chatWithDeepSeek(messages);
    return {
      status: 200,
      body: {
        reply: result.reply,
        mode: 'live',
        model: result.model,
        usage: result.usage,
      },
    };
  } catch (err) {
    if (err instanceof TwinError) {
      if (err.detail) console.error('[upstream]', err.status, String(err.detail).slice(0, 500));
      const friendly =
        err.code === 'timeout'
          ? '我这边卡住了，等会儿再试一次？'
          : err.code === 'rate_limited_upstream'
            ? '问得太密了，缓一下再问。'
            : '我这会儿有点接不上，过一会儿再聊。';
      return { status: err.status, body: { error: friendly, code: err.code } };
    }
    console.error('[chat]', err);
    return { status: 500, body: { error: '出了点问题，稍后再试。', code: 'internal_error' } };
  }
}

export function healthInfo() {
  return {
    ok: true,
    live: hasApiKey(),
    mockMode: env('MOCK_MODE', 'auto'),
    model: env('DEEPSEEK_MODEL', 'deepseek-chat'),
  };
}
