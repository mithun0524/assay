/**
 * Attack surface probe — run against a LOCAL dev server you own.
 *
 *   BASE_URL=http://localhost:3001 node test/attack-surface.mjs
 *
 * Checks authentication, CSRF, rate limiting, redirect handling, traversal and
 * injection on every route. Prints PASS/FAIL/INFO per probe.
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const out = [];
const log = (verdict, name, detail = '') => {
  out.push({ verdict, name });
  console.log(`${verdict.padEnd(4)} ${name}${detail ? '  — ' + detail : ''}`);
};

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, { redirect: 'manual', ...opts });
  let body = '';
  try { body = (await res.text()).slice(0, 300); } catch { /* ignore */ }
  return { status: res.status, headers: res.headers, body };
}

const json = (obj, extra = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: BASE, ...extra },
  body: JSON.stringify(obj),
});

console.log('\n── 1. Authentication on state-changing routes ──');
const MUTATING = [
  ['/api/chat', { messages: [], model: 'x' }],
  ['/api/classify', { message: 'hi', context: {} }],
  ['/api/search', { query: 'test' }],
  ['/api/share', { name: 'x', files: { 'a.ts': { content: 'x' } } }],
  ['/api/github/push', { owner: 'a', repo: 'b', files: {}, commitMessage: 'x' }],
  ['/api/github/clone', { owner: 'a', repo: 'b' }],
  ['/api/github/repos', { name: 'x' }],
  ['/api/deploy', { files: { 'a.ts': 'x' }, projectName: 'x' }],
];
for (const [path, body] of MUTATING) {
  const r = await req(path, json(body));
  log(r.status === 401 ? 'PASS' : 'FAIL', `unauthenticated POST ${path}`, `${r.status}`);
}

console.log('\n── 2. CSRF ──');
// Without a session, middleware rejects with 401 before the route's CSRF check
// runs — both outcomes mean "request refused". Proving CSRF specifically needs
// an authenticated cookie.
for (const [path, body] of MUTATING.slice(0, 4)) {
  const r = await req(path, json(body, { Origin: 'https://evil.example' }));
  log([401, 403].includes(r.status) ? 'PASS' : 'FAIL', `cross-origin POST ${path} refused`, `${r.status}`);
}
{
  const r = await req('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'x', files: {} }),
  });
  log(r.status === 401 || r.status === 403 ? 'PASS' : 'INFO',
    'POST with no Origin/Referer header', `${r.status} (header-less clients are allowed through CSRF by design)`);
}
{
  const r = await req('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: 'https://evil.example/x' },
    body: JSON.stringify({ name: 'x', files: {} }),
  });
  log([401, 403].includes(r.status) ? 'PASS' : 'FAIL', 'forged Referer only refused', `${r.status}`);
}

console.log('\n── 3. Rate limiting ──');
{
  let blocked = 0;
  for (let i = 0; i < 60; i++) {
    const r = await req(`/api/share?id=probe-${i}`);
    if (r.status === 429) blocked++;
  }
  log(blocked > 0 ? 'PASS' : 'FAIL', 'per-route limiter blocks a burst', `${blocked}/60 blocked`);

  // Rotating the forwarded-for header defeats per-IP buckets by design; the
  // global ceiling is what actually stops it. 2500 > MAX_GLOBAL_HITS.
  let spoofBlocked = 0;
  for (let i = 0; i < 2500; i++) {
    const r = await req('/api/classify', json({ message: 'hi', context: {} }, { 'X-Forwarded-For': `10.${i % 250}.${i % 99}.${i % 37}` }));
    if (r.status === 429) spoofBlocked++;
  }
  log(spoofBlocked > 0 ? 'PASS' : 'FAIL', 'IP-rotating flood hits the global ceiling', `${spoofBlocked}/2500 blocked`);
}

console.log('\n── 4. Redirect handling ──');
for (const next of ['//evil.example', 'https://evil.example', '/app/../../etc', '/\\evil.example', '/app']) {
  const r = await req(`/api/auth/callback?code=fake&next=${encodeURIComponent(next)}`);
  const loc = r.headers.get('location') || '';
  const escapes = /^https?:\/\//i.test(loc) && !loc.startsWith(BASE);
  log(escapes ? 'FAIL' : 'PASS', `open redirect via next=${next}`, loc || `${r.status}`);
}

console.log('\n── 5. Path traversal / injection in public routes ──');
for (const id of ['../../etc/passwd', "' OR 1=1 --", '%2e%2e%2f%2e%2e%2f', '<script>alert(1)</script>']) {
  const r = await req(`/api/share?id=${encodeURIComponent(id)}`);
  const leaked = /root:|passwd|<script>/i.test(r.body);
  log(!leaked && r.status >= 400 ? 'PASS' : 'FAIL', `share GET with hostile id`, `${r.status} ${leaked ? 'REFLECTED' : ''}`);
}
{
  const r = await req('/api/share?id=abc');
  const reflects = r.body.includes('abc') && r.headers.get('content-type')?.includes('html');
  log(reflects ? 'FAIL' : 'PASS', 'share GET does not reflect input as HTML', r.headers.get('content-type') || '');
}

console.log('\n── 6. Header / response splitting ──');
{
  const r = await req('/api/share?id=abc%0d%0aX-Injected:%20yes');
  log(r.headers.get('x-injected') ? 'FAIL' : 'PASS', 'CRLF in query does not inject a header');
}

console.log('\n── 7. Security headers ──');
{
  const r = await req('/app');
  const h = (n) => r.headers.get(n);
  log(h('cross-origin-opener-policy') === 'same-origin' ? 'PASS' : 'FAIL', 'COOP set (WebContainer isolation)', h('cross-origin-opener-policy') || 'missing');
  log(h('cross-origin-embedder-policy') === 'require-corp' ? 'PASS' : 'FAIL', 'COEP set', h('cross-origin-embedder-policy') || 'missing');
  log(h('x-frame-options') || h('content-security-policy') ? 'PASS' : 'FAIL', 'clickjacking protection', h('x-frame-options') || h('content-security-policy') || 'missing');
  log(h('x-content-type-options') === 'nosniff' ? 'PASS' : 'FAIL', 'X-Content-Type-Options', h('x-content-type-options') || 'missing');
  log(h('strict-transport-security') ? 'PASS' : 'INFO', 'HSTS', h('strict-transport-security') || 'missing (dev over http)');
  log(h('referrer-policy') ? 'PASS' : 'FAIL', 'Referrer-Policy', h('referrer-policy') || 'missing');
}

console.log('\n── 8. Error disclosure ──');
{
  const r = await req('/api/classify', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE }, body: '{bad json' });
  const leaks = /at .*\(|node_modules|\/Users\//.test(r.body);
  log(leaks ? 'FAIL' : 'PASS', 'malformed JSON does not leak a stack trace', `${r.status} ${r.body.slice(0, 80)}`);
}
{
  const r = await req('/api/share?id=' + 'a'.repeat(5000));
  const leaks = /at .*\(|node_modules|\/Users\//.test(r.body);
  log(leaks ? 'FAIL' : 'PASS', 'oversized input does not leak internals', `${r.status}`);
}

console.log('\n── 9. Method handling ──');
for (const method of ['PUT', 'DELETE', 'PATCH']) {
  const r = await req('/api/share', { method, headers: { Origin: BASE } });
  log(r.status === 405 || r.status === 404 || r.status === 401 ? 'PASS' : 'INFO', `${method} /api/share`, `${r.status}`);
}

const fails = out.filter((o) => o.verdict === 'FAIL');
console.log(`\n${out.length - fails.length}/${out.length} probes clean, ${fails.length} FAIL`);
if (fails.length) console.log('FAILING: ' + fails.map((f) => f.name).join('; '));
