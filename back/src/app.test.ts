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

test('bibliothèque : 21 exercices chargés, fiche avec meilleure perf', async () => {
  const list = await t.call('GET', '/exercises');
  assert.equal(list.body.length, 21);
  const ids = new Set(list.body.map((e: { id: string }) => e.id));
  for (const e of list.body) {
    if (e.easier) assert.ok(ids.has(e.easier), `${e.id}.easier`);
    if (e.harder) assert.ok(ids.has(e.harder), `${e.id}.harder`);
    assert.equal(e.cues.length, 3);
  }
  const one = await t.call('GET', '/exercises/squat-goblet');
  assert.equal(one.body.name, 'Squat goblet');
  assert.deepEqual(one.body.defaultLoads, [6, 8, 12]);
  assert.equal(one.body.best, null);
  assert.equal((await t.call('GET', '/exercises/inconnu')).status, 404);
});
