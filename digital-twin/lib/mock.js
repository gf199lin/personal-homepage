import { retrieve } from './knowledge.js';

/**
 * Mock 模式：没有 API Key 时让 UI 全链路可跑。
 * 它只做检索，不做生成——回答会明确标注是演示模式，避免被误当成真分身。
 */
export function mockReply(question) {
  const hits = retrieve(question, 2);

  if (!hits.length) {
    return (
      '【演示模式】我还没接上真模型，现在只能说这些。\n' +
      '资料里没有这一条，等配好 API Key 之后，我会照他的资料正经回答。'
    );
  }

  const body = hits
    .map((h) => h.text.replace(/\s+/g, ' ').trim())
    .join('\n');

  return `【演示模式】我先从资料里翻到这些：\n${body}\n\n配好 DEEPSEEK_API_KEY 之后，这里会换成像他本人说话的口吻。`;
}
