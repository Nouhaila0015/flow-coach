import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { startTestServer } from './testing.js';

const t = await startTestServer();
after(() => t.close());

test('GET /api/health répond', async () => {
  const res = await t.call('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('route API inconnue → 404 JSON', async () => {
  const res = await t.call('GET', '/nope');
  assert.equal(res.status, 404);
});
