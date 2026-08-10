/**
 * Agent harness — runs the real router against a fixture table.
 *
 *   npm test
 *
 * Covers the deterministic path only (classifyLocally / routeToAgent), which is
 * what both the client fallback and /api/classify use when the LLM is
 * unavailable. No network, no API key.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyLocally, routeToAgent, ROLE_MODEL, VALID_ROLES, isAgentRole } from '../lib/agents/router';
import { AGENTS, getAgent, getAllAgentRoles } from '../lib/agents';
import type { AgentContext, AgentRole } from '../lib/agents/types';
import { FREE_MODELS, MODEL_IDS, AUTO_MODEL_ID, isValidModelId, resolveModelId, DEFAULT_MODEL_ID, fallbackChain } from '../lib/openrouter';

const EMPTY: AgentContext = {
  hasProject: false,
  fileCount: 0,
  hasErrors: false,
  lastMessage: '',
  hasImages: false,
};
const PROJECT: AgentContext = { ...EMPTY, hasProject: true, fileCount: 5 };

type Case = [message: string, context: AgentContext, expected: AgentRole];

const CASES: Case[] = [
  // Greetings
  ['hi', EMPTY, 'architect'],
  ['hello!', PROJECT, 'coder'],
  ['test', PROJECT, 'coder'],            // bare "test" is a smoke message, not QA
  ['how are you', PROJECT, 'coder'],

  // Errors
  ['fix the crash on submit', PROJECT, 'debugger'],
  ['the login button is broken', PROJECT, 'debugger'],
  ['add a footer', { ...PROJECT, hasErrors: true }, 'debugger'],

  // Design
  ['make the buttons look modern', PROJECT, 'designer'],
  ['change the primary color to teal', PROJECT, 'designer'],
  ['add a footer', { ...PROJECT, hasImages: true }, 'designer'],

  // Tests
  ['write unit tests for the cart', PROJECT, 'tester'],
  ['improve test coverage', PROJECT, 'tester'],

  // Questions
  ['what is a react server component?', PROJECT, 'assistant'],
  ['explain how the auth flow works', PROJECT, 'assistant'],
  ['what is next.js?', EMPTY, 'assistant'],   // question wins over empty workspace

  // Architecture / cold start
  ['build me a todo app', EMPTY, 'architect'],
  ['build a kanban board with a dark theme', EMPTY, 'architect'],  // styling words don't beat "no project yet"
  ['make a landing page that looks modern', EMPTY, 'architect'],
  ['write tests for a new library', EMPTY, 'architect'],
  ['plan the folder structure', PROJECT, 'architect'],
  ['scaffold a new project', PROJECT, 'architect'],

  // Default
  ['add a delete button to each row', PROJECT, 'coder'],
  ['implement pagination', PROJECT, 'coder'],

  // Regressions: substring matching used to misroute these
  ['build a dashboard', PROJECT, 'coder'],           // "b-ui-ld" is not UI work
  ['show the latest orders first', PROJECT, 'coder'],  // "la-test-" is not a test request
  ['add a quick filter', PROJECT, 'coder'],          // "q-ui-ck" is not UI work
  ['suffix the id', PROJECT, 'coder'],               // "suf-fix-" is not a bug report
];

test('router picks the expected agent', () => {
  for (const [message, context, expected] of CASES) {
    const got = classifyLocally(message, context);
    assert.equal(got.role, expected, `"${message}" → ${got.role} (want ${expected}) [${got.reasoning}]`);
    assert.equal(routeToAgent(message, context), expected, `routeToAgent disagrees for "${message}"`);
  }
});

test('every classification returns a callable model + reason', () => {
  for (const [message, context] of CASES) {
    const { role, model, reasoning } = classifyLocally(message, context);
    assert.ok(isValidModelId(model), `"${message}" → un-callable model "${model}"`);
    assert.equal(model, ROLE_MODEL[role]);
    assert.ok(reasoning.length > 0, `"${message}" → empty reasoning`);
  }
});

test('bad input never throws', () => {
  const junk: unknown[] = [undefined, null, 42, {}, [], '   ', '🙂'];
  for (const message of junk) {
    for (const context of [undefined, null, {}, { hasProject: true, fileCount: 2 }]) {
      const res = classifyLocally(message, context as Partial<AgentContext>);
      assert.ok(isAgentRole(res.role), `junk input produced role "${res.role}"`);
      assert.ok(isValidModelId(res.model));
    }
  }
  // hasProject=true with zero files is still an empty workspace
  assert.equal(classifyLocally('add a button', { hasProject: true, fileCount: 0 }).role, 'architect');
});

test('agent registry is complete and consistent', () => {
  assert.deepEqual(getAllAgentRoles().sort(), [...VALID_ROLES].sort());
  for (const role of VALID_ROLES) {
    const agent = getAgent(role);
    assert.equal(agent.role, role);
    assert.ok(agent.name && agent.description && agent.systemPrompt.length > 50, `${role} agent is under-configured`);
    assert.equal(agent.model, ROLE_MODEL[role], `${role} model drifted from ROLE_MODEL`);
    assert.ok(agent.temperature >= 0 && agent.temperature <= 1, `${role} temperature out of range`);
  }
  // Unknown role degrades instead of crashing the badge
  assert.equal(getAgent('nonsense' as AgentRole).role, 'coder');
  assert.equal(Object.keys(AGENTS).length, VALID_ROLES.length);
});

test('only allow-listed models are callable, and the picker offers the three picks', () => {
  // Widened: the literal union would reject any id not already in the map,
  // including the withdrawn one this test exists to keep out.
  const ids: string[] = Object.values(MODEL_IDS);

  // The three a user can choose, in order. Everything after them exists only so
  // the fallback chain has somewhere to go when the free tier is exhausted.
  const PICKS = [
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'poolside/laguna-s-2.1:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
  ];
  assert.deepEqual(ids.slice(0, PICKS.length), PICKS);

  // OpenRouter exposes a paid twin of every free model under the same name
  // minus the suffix, so a missing ':free' there silently starts charging
  // whoever's key is configured. Groq encodes nothing in the slug — its free
  // tier is a property of the account — so the rule applies to OpenRouter ids
  // only rather than being dropped for everyone.
  for (const id of ids.filter((x) => !x.startsWith('groq/'))) {
    assert.ok(id.endsWith(':free'), `${id} is an OpenRouter id without :free`);
  }
  // The withdrawn model must not come back: it 404s, and while it sat in the
  // chain it burned a retry slot and masked the real error.
  assert.ok(!ids.includes('inclusionai/ling-3.0-flash:free'), 'withdrawn model is back in the list');

  // Picker = Auto + the three picks only; fallbacks are not user-selectable.
  assert.deepEqual(FREE_MODELS.map((m) => m.id), [AUTO_MODEL_ID, ...PICKS]);
  for (const m of FREE_MODELS) {
    assert.ok(m.label.trim().length > 0 && m.contextLength > 0, `${m.id} missing label/contextLength`);
  }
  assert.equal(isValidModelId(AUTO_MODEL_ID), false, "'auto' is a sentinel, not a callable model");
  assert.equal(resolveModelId('gpt-4o'), DEFAULT_MODEL_ID);
  assert.equal(resolveModelId(undefined), DEFAULT_MODEL_ID);
  assert.equal(resolveModelId(MODEL_IDS.laguna), MODEL_IDS.laguna);
});

test('every model has somewhere to fall back to when the free tier is exhausted', () => {
  for (const id of Object.values(MODEL_IDS)) {
    const chain = fallbackChain(id);
    assert.equal(chain[0], id, 'preferred model must be tried first');
    assert.equal(new Set(chain).size, chain.length, 'no duplicate attempts');
    assert.deepEqual([...chain].sort(), [...Object.values(MODEL_IDS)].sort(), 'chain must cover every model');
  }
  // A junk id still yields a usable chain rather than an empty one
  assert.equal(fallbackChain('gpt-4o')[0], DEFAULT_MODEL_ID);
  assert.equal(fallbackChain(AUTO_MODEL_ID).length, Object.values(MODEL_IDS).length);
});

test('the fallback chain crosses providers and skips unconfigured ones', () => {
  const all = fallbackChain(MODEL_IDS.nemotron);
  assert.equal(all[0], MODEL_IDS.nemotron, 'preferred model must be tried first');

  // Interleaved, not blocked by provider. A rate limit is applied per account,
  // so a run of same-provider models fails together and the chain stalls
  // exactly when it is needed.
  const providers = all.slice(1).map((id) => (id.startsWith('groq/') ? 'groq' : 'openrouter'));
  assert.ok(providers.includes('groq'), 'chain never reaches the second provider');
  assert.ok(
    providers.slice(0, 2).includes('groq'),
    `second provider should appear immediately, got ${providers.slice(0, 3).join(',')}`,
  );

  // With Groq unconfigured, none of its models should be attempted.
  const openrouterOnly = fallbackChain(MODEL_IDS.nemotron, (id) => !id.startsWith('groq/'));
  assert.ok(openrouterOnly.length > 0, 'dropping a provider must not empty the chain');
  assert.ok(
    openrouterOnly.every((id) => !id.startsWith('groq/')),
    'an unconfigured provider still appeared in the chain',
  );
});

test('groq ids are prefixed for us and bare for the provider', async () => {
  const { providerOf, bareModelId } = await import('../lib/providers');
  assert.equal(providerOf('groq/llama-3.3-70b-versatile'), 'groq');
  assert.equal(bareModelId('groq/llama-3.3-70b-versatile'), 'llama-3.3-70b-versatile');
  // A Groq slug that itself contains a slash must survive intact.
  assert.equal(bareModelId('groq/openai/gpt-oss-120b'), 'openai/gpt-oss-120b');
  // OpenRouter ids contain slashes too and must never be trimmed.
  assert.equal(providerOf('nvidia/nemotron-3-ultra-550b-a55b:free'), 'openrouter');
  assert.equal(
    bareModelId('nvidia/nemotron-3-ultra-550b-a55b:free'),
    'nvidia/nemotron-3-ultra-550b-a55b:free',
  );
});
