import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { loadEnv, ROOT } from '../lib/env.js';
import { buildSystemPrompt, buildMessages } from '../lib/prompt.js';
import { chatWithDeepSeek, hasApiKey } from '../lib/deepseek.js';
import { mockReply } from '../lib/mock.js';

loadEnv();

const args = process.argv.slice(2);
const httpTarget = argValue('--http');
const only = argValue('--only'); // 例如 F,B
const outFile = argValue('--out') || resolve(ROOT, '..', 'docs', 'persona', 'test-report.md');

const { cases, meta } = JSON.parse(
  readFileSync(resolve(ROOT, 'test', 'cases.json'), 'utf8')
);

const selected = cases.filter((c) => {
  if (!only) return true;
  const tags = only.split(',').map((s) => s.trim().toUpperCase());
  return tags.some((t) => c.id.toUpperCase().startsWith(t[0]));
});

if (!selected.length) {
  console.error('没有匹配的用例，检查 --only 参数');
  process.exit(1);
}

const live = hasApiKey() && !httpTarget;
const mode = httpTarget ? `http:${httpTarget}` : live ? 'lib:live' : 'lib:mock';

console.log(`用例 ${selected.length} 条 · 模式 ${mode}`);
if (!live && !httpTarget) {
  console.log('提示：当前是 mock 模式，只验证链路与检索，不能当作验收结果。\n');
}

const results = [];
for (const c of selected) {
  const answer = await ask(c.question);
  const verdict = judge(answer, c);
  results.push({ ...c, answer, ...verdict });
  console.log(
    `${verdict.pass ? 'PASS' : 'FAIL'}  ${c.id}  ${c.category}  ${truncate(c.question, 24)}`
  );
}

const passed = results.filter((r) => r.pass).length;
const rate = ((passed / results.length) * 100).toFixed(1);

console.log(`\n命中率 ${passed}/${results.length} = ${rate}%`);

writeReport();

async function ask(question) {
  if (httpTarget) {
    const res = await fetch(httpTarget, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, history: [] }),
    });
    const data = await res.json().catch(() => ({}));
    return data.reply || `[HTTP ${res.status}] ${data.error || ''}`;
  }

  if (!hasApiKey()) return mockReply(question);

  const messages = buildMessages({
    system: buildSystemPrompt(),
    history: [],
    question,
    maxTurns: 0,
  });
  const { reply } = await chatWithDeepSeek(messages);
  return reply;
}

function judge(answer, c) {
  const text = String(answer || '');
  const groupHits = c.require.map((group) => group.filter((w) => text.includes(w)));
  const missing = c.require.filter((_, i) => groupHits[i].length === 0);
  const forbidden = (c.forbid || []).filter((w) => text.includes(w));
  return {
    pass: missing.length === 0 && forbidden.length === 0,
    missing,
    forbidden,
  };
}

function writeReport() {
  const lines = [];
  lines.push('# 数字分身验收报告');
  lines.push('');
  lines.push(`- 运行时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push(`- 模式：\`${mode}\``);
  lines.push(`- 用例：${results.length} 条，用例版本 ${meta.version}`);
  lines.push(`- 命中率：**${passed}/${results.length} = ${rate}%**`);
  if (!live && !httpTarget) {
    lines.push('');
    lines.push('> 本次为 mock 模式，结果只反映检索链路，**不作为验收依据**。');
  }
  lines.push('');
  lines.push('| ID | 类别 | 结果 | 问题 |');
  lines.push('| --- | --- | --- | --- |');
  for (const r of results) {
    lines.push(`| ${r.id} | ${r.category} | ${r.pass ? '通过' : '**未通过**'} | ${escapeCell(r.question)} |`);
  }

  lines.push('');
  lines.push('## 逐条明细');
  for (const r of results) {
    lines.push('');
    lines.push(`### ${r.id} · ${r.category} · ${r.pass ? '通过' : '未通过'}`);
    lines.push('');
    lines.push(`**问**：${r.question}`);
    lines.push('');
    lines.push(`**答**：${r.answer.replace(/\n{2,}/g, '\n')}`);
    if (r.missing.length) {
      lines.push('');
      lines.push(`**缺关键词**：${r.missing.map((g) => g.join(' / ')).join('；')}`);
    }
    if (r.forbidden.length) {
      lines.push('');
      lines.push(`**出现禁用词**：${r.forbidden.join('、')}`);
    }
    if (r.note) {
      lines.push('');
      lines.push(`**判分要点**：${r.note}`);
    }
  }

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`报告已写入 ${outFile}`);
}

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|');
}

function truncate(s, n) {
  const str = String(s);
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}
