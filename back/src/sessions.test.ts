import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addDays, today } from './dates.js';
import { startTestServer } from './testing.js';

const t = await startTestServer();
after(() => t.close());

const d = (n: number) => addDays(today(), n);
const CHECKIN = { energy: 3, minutes: 30, place: 'avec_materiel', desire: 'renfo' };

before(async () => {
  await t.call('PUT', '/profile', { goal: 'endurance', level: 'intermediaire', equipment: ['dumbbells'], weeklyTarget: 3, periodLength: 5 });
  await t.call('POST', '/periods/init', { dates: [d(-75), d(-46), d(-17)] });
});

test('aujourd\'hui : semaine, lieux proposés selon le matériel', async () => {
  const res = await t.call('GET', '/today');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.week, { done: 0, target: 3 });
  assert.deepEqual(res.body.places, ['sans_materiel', 'avec_materiel', 'exterieur']);
  assert.equal(res.body.cycle.phase, 'luteale');
  assert.equal(res.body.pending, null);
});

test('check-in : validation', async () => {
  assert.equal((await t.call('POST', '/checkins', { ...CHECKIN, energy: 6 })).status, 400);
  assert.equal((await t.call('POST', '/checkins', { ...CHECKIN, minutes: 25 })).status, 400);
  assert.equal((await t.call('POST', '/checkins', { ...CHECKIN, place: 'salle' })).status, 400); // pas de salle dans le profil
  assert.equal((await t.call('POST', '/checkins', { ...CHECKIN, desire: 'yoga' })).status, 400);
});

test('check-in : séance générée avec la phase calculée, puis remplacée par un nouveau check-in', async () => {
  const first = await t.call('POST', '/checkins', CHECKIN);
  assert.equal(first.status, 201);
  assert.equal(first.body.type, 'renfo');
  assert.equal(first.body.status, 'planned');
  assert.deepEqual(first.body.checkin, { ...CHECKIN, phase: 'luteale', cycleDay: 18 });
  assert.ok(first.body.items.length > 5);
  assert.ok(first.body.estimatedSec > 20 * 60);
  assert.equal(first.body.items[0].exercise.name.length > 0, true);
  assert.equal((await t.call('GET', '/today')).body.pending.id, first.body.id);

  const second = await t.call('POST', '/checkins', { ...CHECKIN, desire: 'doux', energy: 2 });
  assert.equal(second.body.type, 'doux');
  assert.equal((await t.call('GET', `/sessions/${first.body.id}`)).status, 404);
});

test('une autre proposition : mêmes type et intensité, autres exercices', async () => {
  const s = (await t.call('POST', '/checkins', CHECKIN)).body;
  const again = await t.call('POST', `/sessions/${s.id}/regenerate`);
  assert.equal(again.body.type, s.type);
  assert.equal(again.body.intensity, s.intensity);
  assert.notDeepEqual(again.body.items.map((i: { exerciseId: string }) => i.exerciseId), s.items.map((i: { exerciseId: string }) => i.exerciseId));
});

test('énergie 1 : conseil et bascule en séance douce', async () => {
  const s = (await t.call('POST', '/checkins', { ...CHECKIN, energy: 1 })).body;
  assert.equal(s.type, 'renfo');
  assert.match(s.advice, /séance douce/);
  assert.equal(s.offerDoux, true);
  const doux = (await t.call('POST', `/sessions/${s.id}/regenerate`, { type: 'doux' })).body;
  assert.equal(doux.type, 'doux');
  assert.equal(doux.offerDoux, false);
  assert.equal(doux.advice, null);
});

test('commencer : la séance passe en cours et ne peut plus être régénérée', async () => {
  const s = (await t.call('POST', '/checkins', CHECKIN)).body;
  const started = await t.call('POST', `/sessions/${s.id}/start`);
  assert.equal(started.body.status, 'in_progress');
  assert.ok(started.body.startedAt);
  assert.equal((await t.call('POST', `/sessions/${s.id}/regenerate`)).status, 409);
  assert.equal((await t.call('GET', '/today')).body.pending.status, 'in_progress');
  // un nouveau check-in ne remplace pas une séance commencée
  const other = (await t.call('POST', '/checkins', CHECKIN)).body;
  assert.equal((await t.call('GET', `/sessions/${s.id}`)).status, 200);
  assert.notEqual(other.id, s.id);
});
