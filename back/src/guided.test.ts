import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addDays, today } from './dates.js';
import { startTestServer } from './testing.js';

const t = await startTestServer();
after(() => t.close());
const d = (n: number) => addDays(today(), n);

interface Item { id: number; block: string; status: string; exerciseId: string; targetReps: number | null; targetDuration: number | null; targetLoad: number | null; restSec: number; position: number }

async function startSession(body: Record<string, unknown>) {
  const s = (await t.call('POST', '/checkins', body)).body;
  return (await t.call('POST', `/sessions/${s.id}/start`)).body as { id: number; items: Item[] };
}

before(async () => {
  await t.call('PUT', '/profile', { goal: 'force', level: 'intermediaire', equipment: ['dumbbells'], weeklyTarget: 3, periodLength: 5 });
  await t.call('POST', '/periods/init', { dates: [d(-75), d(-46), d(-17)] });
});

test('réalisé : enregistrement et validation', async () => {
  const s = await startSession({ energy: 3, minutes: 20, place: 'avec_materiel', desire: 'renfo' });
  const item = s.items[0];
  assert.equal((await t.call('PUT', `/sessions/${s.id}/items/${item.id}`, { doneReps: -1 })).status, 400);
  const res = await t.call('PUT', `/sessions/${s.id}/items/${item.id}`, { doneDuration: item.targetDuration });
  assert.equal(res.body.items[0].status, 'done');
  assert.equal((await t.call('PUT', `/sessions/${s.id}/items/99999`, {})).status, 404);
  await t.call('POST', `/sessions/${s.id}/finish`, { status: 'interrupted' });
});

test('trop dur : la suite est allégée, limitée à 2 crans', async () => {
  const s = await startSession({ energy: 4, minutes: 30, place: 'sans_materiel', desire: 'renfo' });
  const first = s.items.find((i) => i.block === 'main')!;
  const next = s.items.find((i) => i.block === 'main' && i.position > first.position && i.targetReps !== null)!;
  const res = await t.call('POST', `/sessions/${s.id}/adjust`, { itemId: first.id, feedback: 'too_hard' });
  assert.equal(res.status, 200);
  assert.match(res.body.message, /j'allège la suite/);
  assert.equal(res.body.session.adjustLevel, -1);
  const after1 = res.body.session.items.find((i: Item) => i.id === next.id);
  assert.equal(after1.targetReps, Math.max(1, Math.round(next.targetReps! * 0.8)));
  assert.equal(after1.restSec, next.restSec + 15);
  assert.ok(res.body.changes.length > 0);
  // le retour au calme n'est pas modifié
  const cool = s.items.filter((i) => i.block === 'cooldown');
  for (const c of cool) assert.equal(res.body.session.items.find((i: Item) => i.id === c.id).targetDuration, c.targetDuration);
  await t.call('POST', `/sessions/${s.id}/adjust`, { itemId: first.id, feedback: 'too_hard' });
  const third = await t.call('POST', `/sessions/${s.id}/adjust`, { itemId: first.id, feedback: 'too_hard' });
  assert.equal(third.body.session.adjustLevel, -2);
  assert.match(third.body.message, /maximum/);
  await t.call('POST', `/sessions/${s.id}/finish`, { status: 'interrupted' });
});

test('trop dur : variante plus facile si elle existe (fente avant → squat)', async () => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const s = await startSession({ energy: 4, minutes: 30, place: 'sans_materiel', desire: 'renfo' });
    const fente = s.items.find((i) => i.exerciseId === 'fente-avant');
    const first = s.items.find((i) => i.block === 'main')!;
    if (fente && fente.position > first.position) {
      const res = await t.call('POST', `/sessions/${s.id}/adjust`, { itemId: first.id, feedback: 'too_hard' });
      assert.equal(res.body.session.items.find((i: Item) => i.id === fente.id).exerciseId, 'squat');
      await t.call('POST', `/sessions/${s.id}/finish`, { status: 'interrupted' });
      return;
    }
    await t.call('POST', `/sessions/${s.id}/finish`, { status: 'interrupted' });
  }
  assert.fail('fente avant jamais proposée après le premier exercice');
});

test('passer : exercice marqué sauté', async () => {
  const s = await startSession({ energy: 3, minutes: 10, place: 'sans_materiel', desire: 'cardio' });
  const res = await t.call('POST', `/sessions/${s.id}/adjust`, { itemId: s.items[0].id, feedback: 'skip' });
  assert.equal(res.body.session.items[0].status, 'skipped');
  await t.call('POST', `/sessions/${s.id}/finish`, { status: 'interrupted' });
});

test('fin de séance : RPE obligatoire, progression appliquée et utilisée à la séance suivante', async () => {
  const s = await startSession({ energy: 3, minutes: 10, place: 'avec_materiel', desire: 'renfo' });
  assert.equal((await t.call('POST', `/sessions/${s.id}/finish`, { status: 'done' })).status, 400);
  const main = s.items.filter((i) => i.block === 'main');
  for (const i of main) {
    await t.call('PUT', `/sessions/${s.id}/items/${i.id}`, { doneReps: i.targetReps, doneDuration: i.targetDuration, doneLoad: i.targetLoad });
  }
  const res = await t.call('POST', `/sessions/${s.id}/finish`, { status: 'done', rpe: 4, comment: '  Facile  ', durationSec: 600 });
  assert.equal(res.status, 200);
  assert.equal(res.body.session.status, 'done');
  assert.equal(res.body.session.rpe, 4);
  assert.equal(res.body.session.comment, 'Facile');
  assert.equal(res.body.session.durationSec, 600);
  const changed = res.body.progression.filter((p: { before: unknown; after: unknown }) => JSON.stringify(p.before) !== JSON.stringify(p.after));
  assert.ok(changed.length > 0);
  assert.equal((await t.call('POST', `/sessions/${s.id}/finish`, { status: 'done', rpe: 4 })).status, 409);
  assert.equal((await t.call('POST', `/sessions/${s.id}/finish`, { status: 'interrupted' })).status, 200); // sans effet
  assert.equal((await t.call('GET', `/sessions/${s.id}`)).body.status, 'done');
  assert.equal((await t.call('GET', '/today')).body.week.done, 1);
});

test('séance interrompue : comptée, sans progression', async () => {
  const s = await startSession({ energy: 3, minutes: 10, place: 'avec_materiel', desire: 'renfo' });
  const res = await t.call('POST', `/sessions/${s.id}/finish`, { status: 'interrupted' });
  assert.equal(res.body.session.status, 'interrupted');
  assert.deepEqual(res.body.progression, []);
  assert.equal((await t.call('POST', `/sessions/${s.id}/adjust`, { itemId: s.items[0].id, feedback: 'skip' })).status, 409);
});
