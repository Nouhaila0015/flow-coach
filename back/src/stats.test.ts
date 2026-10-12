import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { addDays, today, weekStart } from './dates.js';
import { weekStreak } from './stats.js';
import { startTestServer } from './testing.js';

const t = await startTestServer();
after(() => t.close());
const d = (n: number) => addDays(today(), n);
const thisWeek = weekStart(today());

/** Crée une séance terminée (ou interrompue), puis la place à la date voulue. */
async function pastSession(date: string, desire: string, minutes: number, rpe: number | null) {
  const s = (await t.call('POST', '/checkins', { energy: 4, minutes: 10, place: 'sans_materiel', desire })).body;
  await t.call('POST', `/sessions/${s.id}/start`);
  for (const i of s.items.filter((i: { block: string }) => i.block === 'main')) {
    await t.call('PUT', `/sessions/${s.id}/items/${i.id}`, { doneReps: i.targetReps, doneDuration: i.targetDuration });
  }
  await t.call('POST', `/sessions/${s.id}/finish`, rpe === null ? { status: 'interrupted', durationSec: minutes * 60 } : { status: 'done', rpe, durationSec: minutes * 60 });
  t.db.prepare('UPDATE sessions SET date = ? WHERE id = ?').run(date, s.id);
  return s.id as number;
}

before(async () => {
  await t.call('PUT', '/profile', { goal: 'force', level: 'intermediaire', equipment: [], weeklyTarget: 2, periodLength: 5 });
  await t.call('POST', '/periods/init', { dates: [d(-75), d(-46), d(-17)] });
  await pastSession(thisWeek, 'renfo', 20, 6);
  await pastSession(addDays(thisWeek, -7), 'renfo', 30, 8);
  await pastSession(addDays(thisWeek, -6), 'cardio', 10, 4);
  await pastSession(addDays(thisWeek, -5), 'doux', 15, null); // interrompue
  await pastSession(addDays(thisWeek, -14), 'renfo', 25, 7);
  await pastSession(addDays(thisWeek, -13), 'renfo', 25, 7);
  await pastSession(addDays(thisWeek, -70), 'course', 40, 5);
});

test('série de semaines : la semaine en cours incomplète ne casse pas la série', () => {
  const weeks = new Map([[thisWeek, 1], [addDays(thisWeek, -7), 2], [addDays(thisWeek, -14), 3], [addDays(thisWeek, -28), 2]]);
  assert.equal(weekStreak(weeks, 2, thisWeek), 2);
  assert.equal(weekStreak(new Map([[thisWeek, 2]]), 2, thisWeek), 1);
  assert.equal(weekStreak(new Map(), 2, thisWeek), 0);
});

test('stats 4 semaines : indicateurs, semaines et volume par type', async () => {
  const res = await t.call('GET', '/stats?period=4w');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.kpis, { weekDone: 1, weekTarget: 2, streak: 2, sessions: 5, totalMinutes: 125, averageRpe: 6.4 });
  assert.equal(res.body.weeks.length, 4);
  assert.deepEqual(res.body.weeks.map((w: { sessions: number }) => w.sessions), [0, 2, 2, 1]);
  assert.deepEqual(res.body.weeks[2], { start: addDays(thisWeek, -7), sessions: 2, minutes: { renfo: 30, cardio: 10, doux: 15, course: 0 } });
});

test('stats : moyennes par phase et progression par exercice', async () => {
  const res = await t.call('GET', '/stats?period=4w');
  const total = res.body.phases.reduce((n: number, p: { sessions: number }) => n + p.sessions, 0);
  assert.equal(total, 6);
  const luteale = res.body.phases.find((p: { phase: string }) => p.phase === 'luteale');
  assert.equal(luteale.energy, 4);
  assert.equal(luteale.rpe, 6.4);
  assert.equal(res.body.phases.find((p: { phase: string }) => p.phase === 'menstruelle').energy, null);
  assert.ok(res.body.exercises.length > 0);
  for (const e of res.body.exercises as { mode: string; points: { date: string; reps: number | null; duration: number | null }[] }[]) {
    assert.ok(e.points.length > 0);
    assert.deepEqual(e.points.map((p) => p.date), e.points.map((p) => p.date).sort());
    assert.ok((e.mode === 'reps' ? e.points[0].reps : e.points[0].duration)! > 0);
  }
});

test('stats : périodes 12 semaines et tout, période invalide', async () => {
  const w12 = (await t.call('GET', '/stats?period=12w')).body;
  assert.equal(w12.weeks.length, 12);
  assert.equal(w12.kpis.sessions, 6);
  const all = (await t.call('GET', '/stats?period=all')).body;
  assert.equal(all.weeks.length, 11);
  assert.equal(Object.values(all.weeks[0].minutes as Record<string, number>).reduce((a, b) => a + b, 0), 40);
  assert.equal(all.kpis.totalMinutes, 165);
  assert.equal((await t.call('GET', '/stats?period=1y')).status, 400);
  assert.equal((await t.call('GET', '/stats')).body.period, '4w');
});
