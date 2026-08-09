/**
 * Live model check — does NOT run in `npm test` (needs a real key + network).
 *
 *   OPENROUTER_API_KEY=... node test/live-model-check.mjs
 *
 * Answers two questions with data instead of argument:
 *   A. Do the three allow-listed models emit our <boltAction> protocol correctly?
 *   B. Do they emit valid tool calls, i.e. is the AI SDK agent loop viable here?
 */

import { readFileSync } from 'node:fs';

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error('Set OPENROUTER_API_KEY');
  process.exit(1);
}

const MODELS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'poolside/laguna-s-2.1:free',
  'inclusionai/ling-3.0-flash:free',
];

const SYSTEM_PROMPT = readFileSync('lib/systemPrompt.ts', 'utf-8')
  .replace(/^[\s\S]*?export const SYSTEM_PROMPT = `/, '')
  .replace(/`;\s*$/, '')
  .replace(/\\`/g, '`');

const CASES = [
  {
    id: 'new-project',
    user: 'Build a counter app with a plus and minus button.',
    check: (t) => ({
      'file actions': /<boltAction\s+type="file"\s+filePath="[^"]+"\s*>/.test(t),
      'package.json': /filePath="package\.json"/.test(t),
      'install before start': (() => {
        const i = t.search(/type="shell"[^>]*>\s*npm\s+(install|i)\b/);
        const s = t.search(/type="start"/);
        if (s === -1) return null; // truncated before the start action — not a failure
        return i !== -1 && i < s;
      })(),
      'closes every tag': (t.match(/<boltAction/g) || []).length === (t.match(/<\/boltAction>/g) || []).length,
      'no truncation marker': !/\.\.\.\s*(rest of|remaining|etc)/i.test(t),
    }),
  },
  {
    id: 'inspect-before-edit',
    user: 'Rename the Card component to Tile everywhere it is used. I have not shown you the files.',
    context: '<current_files>\nsrc/App.tsx (truncated)\nsrc/components/Card.tsx (truncated)\n</current_files>',
    check: (t) => ({
      'asked to read or list': /<boltAction\s+type="(read|list)"/.test(t),
      'did not blind-write': !/<boltAction\s+type="file"/.test(t) || /<boltAction\s+type="(read|list)"/.test(t),
    }),
  },
  {
    id: 'research-when-unsure',
    user: 'Set up TanStack Router v1 file-based routing in this project. Use the current API exactly.',
    check: (t) => ({ 'emitted a search': /<boltAction\s+type="search"/.test(t) }),
  },
];

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write a file into the project sandbox',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  },
];

async function call(model, body) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'DevForge model check',
    },
    body: JSON.stringify({ model, ...body }),
    signal: AbortSignal.timeout(120_000),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    return { error: json.error?.message || `HTTP ${res.status}` };
  }
  return { message: json.choices?.[0]?.message ?? {}, finish: json.choices?.[0]?.finish_reason };
}

console.log('\n=== A. <boltAction> protocol adherence ===\n');
for (const model of MODELS) {
  console.log(`--- ${model}`);
  for (const c of CASES) {
    const r = await call(model, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + (c.context ? `\n\n${c.context}` : '') },
        { role: 'user', content: c.user },
      ],
      max_tokens: 6000,
      temperature: 0.2,
    });
    if (r.error) {
      console.log(`  ${c.id}: ERROR ${r.error}`);
      continue;
    }
    const text = r.message.content || '';
    const results = c.check(text);
    const scored = Object.entries(results).filter(([, v]) => v !== null);
    const pass = scored.filter(([, v]) => v).length;
    const total = scored.length;
    const failed = scored.filter(([, v]) => !v).map(([k]) => k);
    const skipped = Object.entries(results).filter(([, v]) => v === null).map(([k]) => k);
    if (skipped.length) failed.push(`(n/a: ${skipped.join(', ')})`);
    console.log(
      `  ${c.id}: ${pass}/${total}${failed.length ? '  missing: ' + failed.join(', ') : ''}` +
        `  [${text.length} chars, finish=${r.finish}]`
    );
  }
}

console.log('\n=== B. tool-calling viability (AI SDK agent loop) ===\n');
for (const model of MODELS) {
  const r = await call(model, {
    messages: [
      { role: 'system', content: 'You write files by calling the write_file tool. Never answer in prose.' },
      { role: 'user', content: 'Create src/App.tsx with a React component that renders Hello.' },
    ],
    tools: TOOLS,
    tool_choice: 'auto',
    max_tokens: 500,
  });
  if (r.error) {
    console.log(`--- ${model}: ERROR ${r.error}`);
    continue;
  }
  const calls = r.message.tool_calls || [];
  let argsValid = false;
  if (calls.length) {
    try {
      const a = JSON.parse(calls[0].function.arguments);
      argsValid = typeof a.path === 'string' && typeof a.content === 'string';
    } catch { argsValid = false; }
  }
  console.log(
    `--- ${model}: tool_calls=${calls.length} valid_args=${argsValid} finish=${r.finish}` +
      (calls.length === 0 ? `  (fell back to prose: ${(r.message.content || '').slice(0, 60)}…)` : '')
  );
}
console.log('');
