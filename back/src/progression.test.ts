import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDb } from './db.js';
import { listExercises, seedExercises } from './exercises.js';
import { adjustTargets, baseProgress, nextProgress, type DoneItem } from './progression.js';

const db = openDb(':memory:');
seedExercises(db);
const ex = new Map(listExercises(db).map((e) => [e.id, e]));
const squat = ex.get('squat')!;
const goblet = ex.get('squat-goblet')!;
const plank = ex.get('gainage-planche')!;

const item = (o: Partial<DoneItem> = {}): DoneItem => ({
  status: 'done', feedback: null, targetReps: 12, targetDuration: null, doneReps: 12, doneDuration: null, doneLoad: null, ...o,
});

test('base : progression enregistrée, sinon valeurs du niveau', () => {
  assert.deepEqual(baseProgress(goblet, 1), { reps: 12, duration: null, load: 8 });
  assert.deepEqual(baseProgress(plank, 0), { reps: null, duration: 25, load: null });
  assert.deepEqual(baseProgress(squat, 1, { reps: 14, duration: null, load: null }), { reps: 14, duration: null, load: null });
});

test('RPE ≤ 5 et cibles atteintes : +10 %', () => {
  const r = nextProgress(squat, [item(), item()], 4, 'force', { reps: 12, duration: null, load: null });
  assert.equal(r.after.reps, 13);
  const p = nextProgress(plank, [item({ targetReps: null, doneReps: null, targetDuration: 40, doneDuration: 40 })], 5, 'force', { reps: null, duration: 40, load: null });
  assert.equal(p.after.duration, 45);
});

test('RPE ≤ 5 mais cible manquée : inchangé', () => {
  const r = nextProgress(squat, [item({ doneReps: 9 })], 4, 'force', { reps: 12, duration: null, load: null });
  assert.equal(r.after.reps, 12);
});

test('séance allégée : atteindre les cibles baissées ne fait pas monter la suivante', () => {
  const base = { reps: 12, duration: null, load: null };
  const r = nextProgress(squat, [item({ targetReps: 10, doneReps: 10 })], 4, 'force', base, true);
  assert.deepEqual(r.after, base);
  assert.equal(r.rule, 'séance allégée');
});

test('avec charge : +1 kg plutôt que des répétitions', () => {
  const r = nextProgress(goblet, [item({ doneLoad: 8 })], 5, 'force', { reps: 12, duration: null, load: 8 });
  assert.deepEqual(r.after, { reps: 12, duration: null, load: 9 });
});

test('RPE 6–8 : gardé, ou +5 % si « trop facile »', () => {
  const base = { reps: 12, duration: null, load: null };
  assert.equal(nextProgress(squat, [item()], 7, 'force', base).after.reps, 12);
  assert.equal(nextProgress(squat, [item({ feedback: 'too_easy' })], 7, 'force', base).after.reps, 13);
});

test('RPE ≥ 9 ou « trop dur » : −10 %', () => {
  const base = { reps: 12, duration: null, load: null };
  assert.equal(nextProgress(squat, [item()], 9, 'force', base).after.reps, 11);
  const r = nextProgress(squat, [item({ feedback: 'too_hard' })], 6, 'force', base);
  assert.equal(r.after.reps, 11);
  assert.equal(r.rule, 'trop dur');
});

test('exercice sauté : cible inchangée', () => {
  const base = { reps: 12, duration: null, load: null };
  assert.deepEqual(nextProgress(squat, [item({ status: 'skipped', doneReps: null })], 3, 'force', base).after, base);
});

test('prise de muscle : +1 kg dès 12 répétitions, puis retour à 8', () => {
  const r = nextProgress(goblet, [item({ doneReps: 12, doneLoad: 8 })], 7, 'muscle', { reps: 12, duration: null, load: 8 });
  assert.deepEqual(r.after, { reps: 8, duration: null, load: 9 });
  const up = nextProgress(goblet, [item({ targetReps: 10, doneReps: 10, doneLoad: 8 })], 5, 'muscle', { reps: 10, duration: null, load: 8 });
  assert.deepEqual(up.after, { reps: 11, duration: null, load: 8 });
});

test('ajustement en cours de séance', () => {
  assert.deepEqual(adjustTargets({ targetReps: 10, targetDuration: null, restSec: 20 }, -1), { targetReps: 8, targetDuration: null, restSec: 35 });
  assert.deepEqual(adjustTargets({ targetReps: null, targetDuration: 40, restSec: 15 }, 1), { targetReps: null, targetDuration: 45, restSec: 10 });
  assert.deepEqual(adjustTargets({ targetReps: 10, targetDuration: null, restSec: 0 }, 1).restSec, 0);
});
