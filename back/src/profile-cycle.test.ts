import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { addDays, today } from './dates.js';
import { startTestServer } from './testing.js';

const t = await startTestServer();
after(() => t.close());

const PROFILE = { goal: 'muscle', level: 'intermediaire', equipment: ['dumbbells', 'mat'], weeklyTarget: 3, periodLength: 5 };
const d = (n: number) => addDays(today(), n);

test('pas de profil au départ', async () => {
  assert.equal((await t.call('GET', '/profile')).body, null);
});

test('init des règles refusée sans profil', async () => {
  const res = await t.call('POST', '/periods/init', { dates: [d(-70), d(-40), d(-10)] });
  assert.equal(res.status, 400);
});

test('profil : validation puis enregistrement', async () => {
  assert.equal((await t.call('PUT', '/profile', { ...PROFILE, goal: 'yoga' })).status, 400);
  assert.equal((await t.call('PUT', '/profile', { ...PROFILE, weeklyTarget: 8 })).status, 400);
  assert.equal((await t.call('PUT', '/profile', { ...PROFILE, periodLength: 1 })).status, 400);
  const res = await t.call('PUT', '/profile', PROFILE);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ...PROFILE, onboarded: false });
});

test('init : exactement 3 dates passées et distinctes', async () => {
  assert.equal((await t.call('POST', '/periods/init', { dates: [d(-40), d(-10)] })).status, 400);
  assert.equal((await t.call('POST', '/periods/init', { dates: [d(-40), d(-40), d(-10)] })).status, 400);
  assert.equal((await t.call('POST', '/periods/init', { dates: [d(-40), d(-10), d(2)] })).status, 400);
  const close = await t.call('POST', '/periods/init', { dates: [d(-70), d(-15), d(-10)] });
  assert.equal(close.status, 409);
  assert.equal(close.body.needsConfirm, true);
});

test('init réussie : profil marqué comme terminé et phase calculée', async () => {
  const res = await t.call('POST', '/periods/init', { dates: [d(-17), d(-75), d(-46)] });
  assert.equal(res.status, 200);
  assert.equal(res.body.periods.length, 3);
  assert.equal(res.body.periods[0].startDate, d(-17)); // plus récent en premier
  assert.equal(res.body.periods[0].cycleLength, null);
  assert.equal(res.body.periods[1].cycleLength, 29);
  assert.equal(res.body.cycle.day, 18);
  assert.equal(res.body.cycle.averageLength, 29);
  assert.equal(res.body.cycle.phase, 'luteale');
  assert.equal((await t.call('GET', '/profile')).body.onboarded, true);
});

test('ajout de règles : contrôles et recalcul de la phase', async () => {
  assert.equal((await t.call('POST', '/periods', { startDate: d(1) })).status, 400);
  assert.equal((await t.call('POST', '/periods', { startDate: d(-17) })).status, 400);
  assert.equal((await t.call('POST', '/periods', { startDate: '2026-02-30' })).status, 400);
  const warn = await t.call('POST', '/periods', { startDate: d(-5) });
  assert.equal(warn.status, 409);
  const res = await t.call('POST', '/periods', { startDate: d(0) });
  assert.equal(res.status, 201);
  assert.equal(res.body.cycle.day, 1);
  assert.equal(res.body.cycle.phase, 'menstruelle');
  assert.equal((await t.call('GET', '/cycle/today')).body.cycle.phase, 'menstruelle');
});

test('modification et suppression', async () => {
  const { periods } = (await t.call('GET', '/periods')).body;
  const latest = periods[0];
  assert.equal((await t.call('PUT', `/periods/${latest.id}`, { startDate: d(-1) })).status, 200);
  const del = await t.call('DELETE', `/periods/${latest.id}`);
  assert.equal(del.status, 200);
  assert.equal(del.body.periods.length, 3);
  assert.equal(del.body.cycle.day, 18);
  assert.equal((await t.call('DELETE', `/periods/${latest.id}`)).status, 404);
});
