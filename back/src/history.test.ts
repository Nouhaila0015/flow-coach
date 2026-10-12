import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addDays, today } from './dates.js';
import { startTestServer } from './testing.js';

const t = await startTestServer();
after(() => t.close());
const d = (n: number) => addDays(today(), n);

async function runSession(desire: string, status: 'done' | 'interrupted') {
  const s = (await t.call('POST', '/checkins', { energy: 3, minutes: 10, place: 'sans_materiel', desire })).body;
  await t.call('POST', `/sessions/${s.id}/start`);
  await t.call('POST', `/sessions/${s.id}/finish`, { status, rpe: 6, durationSec: 540 });
  return s.id as number;
}

let renfo: number;
let doux: number;

before(async () => {
  await t.call('PUT', '/profile', { goal: 'force', level: 'intermediaire', equipment: [], weeklyTarget: 3, periodLength: 5 });
  await t.call('POST', '/periods/init', { dates: [d(-75), d(-46), d(-17)] });
  renfo = await runSession('renfo', 'done');
  doux = await runSession('doux', 'interrupted');
  await t.call('POST', '/checkins', { energy: 3, minutes: 10, place: 'sans_materiel', desire: 'cardio' }); // planifiée : hors historique
});

test('historique : séances terminées et interrompues, la plus récente en premier', async () => {
  const res = await t.call('GET', '/sessions');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((s: { id: number }) => s.id), [doux, renfo]);
  assert.deepEqual(res.body[1], {
    id: renfo, date: today(), type: 'renfo', intensity: 'moderee', status: 'done', durationSec: 540, rpe: 6,
    phase: 'luteale', cycleDay: 18, energy: 3,
  });
  assert.equal(res.body[0].status, 'interrupted');
  assert.equal(res.body[0].rpe, null);
});

test('historique : filtres par type et par phase', async () => {
  assert.deepEqual((await t.call('GET', '/sessions?type=doux')).body.map((s: { id: number }) => s.id), [doux]);
  assert.equal((await t.call('GET', '/sessions?phase=luteale')).body.length, 2);
  assert.equal((await t.call('GET', '/sessions?phase=menstruelle')).body.length, 0);
  assert.equal((await t.call('GET', '/sessions?type=renfo&phase=luteale')).body.length, 1);
  assert.equal((await t.call('GET', '/sessions?type=yoga')).status, 400);
  assert.equal((await t.call('GET', '/sessions?phase=lune')).status, 400);
});

test('suppression d\'une séance', async () => {
  assert.equal((await t.call('DELETE', `/sessions/${doux}`)).status, 204);
  assert.equal((await t.call('GET', `/sessions/${doux}`)).status, 404);
  assert.equal((await t.call('DELETE', `/sessions/${doux}`)).status, 404);
  assert.deepEqual((await t.call('GET', '/sessions')).body.map((s: { id: number }) => s.id), [renfo]);
  assert.equal(t.db.prepare('SELECT COUNT(*) AS n FROM session_items WHERE session_id = ?').get(doux)!.n, 0);
});
