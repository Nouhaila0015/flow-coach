import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDb } from './db.js';
import { allowedPlaces, availableEquipment, chooseType, computeIntensity, generateSession, type CheckinInput, type History } from './engine.js';
import { listExercises, seedExercises } from './exercises.js';
import type { Profile } from './profile.js';

const db = openDb(':memory:');
seedExercises(db);
const exercises = listExercises(db);
const byId = new Map(exercises.map((e) => [e.id, e]));

const PROFILE: Profile = { goal: 'endurance', level: 'intermediaire', equipment: ['dumbbells', 'mat'], weeklyTarget: 3, periodLength: 5, onboarded: true };
const NO_HISTORY: History = { recentExerciseIds: [], typeCounts: {}, daysSinceType: {} };
const CHECKIN: CheckinInput = { energy: 3, minutes: 30, place: 'avec_materiel', desire: 'auto', phase: 'luteale', cycleDay: 18 };

function gen(c: Partial<CheckinInput> = {}, p: Partial<Profile> = {}, extra: { history?: History; variant?: number } = {}) {
  return generateSession({
    checkin: { ...CHECKIN, ...c },
    profile: { ...PROFILE, ...p },
    exercises,
    progress: new Map(),
    history: extra.history ?? NO_HISTORY,
    variant: extra.variant ?? 0,
  });
}

test('table énergie × phase quand le coach décide', () => {
  const t = (energy: number, phase: CheckinInput['phase'], goal: Profile['goal'] = 'force') =>
    chooseType({ energy, phase, desire: 'auto', place: 'avec_materiel' }, goal, NO_HISTORY).type;
  assert.equal(t(2, 'ovulatoire'), 'doux');
  assert.equal(t(3, 'menstruelle'), 'doux');
  assert.equal(t(3, 'luteale'), 'renfo');
  assert.equal(t(5, 'menstruelle'), 'renfo');
  assert.equal(t(4, 'folliculaire', 'force'), 'renfo');
  assert.equal(t(4, 'folliculaire', 'endurance'), 'cardio');
  assert.equal(t(4, 'ovulatoire', 'perte_poids'), 'cardio');
  assert.equal(t(4, 'ovulatoire', 'muscle'), 'renfo');
});

test('bien-être : le type le moins fait sur 7 jours', () => {
  const c = { energy: 4, phase: 'folliculaire' as const, desire: 'auto' as const, place: 'avec_materiel' as const };
  assert.equal(chooseType(c, 'bien_etre', { typeCounts: { renfo: 2, cardio: 1 } }).type, 'cardio');
  assert.equal(chooseType(c, 'bien_etre', { typeCounts: { renfo: 0, cardio: 1 } }).type, 'renfo');
});

test('extérieur : le cardio devient course dès 3 d\'énergie', () => {
  const c = { energy: 4, phase: 'ovulatoire' as const, desire: 'auto' as const, place: 'exterieur' as const };
  assert.equal(chooseType(c, 'endurance', NO_HISTORY).type, 'course');
});

test('envie respectée, avec conseil si énergie 1', () => {
  const r = chooseType({ energy: 1, phase: 'folliculaire', desire: 'cardio', place: 'sans_materiel' }, 'force', NO_HISTORY);
  assert.equal(r.type, 'cardio');
  assert.match(r.advice!, /séance douce/);
  const run = chooseType({ energy: 4, phase: 'folliculaire', desire: 'course', place: 'sans_materiel' }, 'force', NO_HISTORY);
  assert.equal(run.type, 'cardio');
  assert.match(run.advice!, /extérieur/);
});

test('intensité : énergie + modificateur de phase', () => {
  assert.equal(computeIntensity(3, 'luteale'), 'moderee'); // 2,5
  assert.equal(computeIntensity(3, 'menstruelle'), 'basse'); // 2
  assert.equal(computeIntensity(4, 'luteale'), 'moderee'); // 3,5
  assert.equal(computeIntensity(4, 'folliculaire'), 'haute'); // 4
  assert.equal(computeIntensity(3, 'ovulatoire'), 'moderee'); // 3,5
});

test('lieux et matériel', () => {
  assert.deepEqual(allowedPlaces({ equipment: ['mat'] }), ['sans_materiel', 'exterieur']);
  assert.deepEqual(allowedPlaces({ equipment: ['band', 'gym'] }), ['sans_materiel', 'avec_materiel', 'salle', 'exterieur']);
  assert.deepEqual(availableEquipment('avec_materiel', { equipment: ['band'] }), ['none', 'band']);
});

test('exemple des maquettes : renfo modéré de 30 min, structure et équilibre', () => {
  const s = gen({ desire: 'renfo' });
  assert.equal(s.type, 'renfo');
  assert.equal(s.intensity, 'moderee');
  const warm = s.items.filter((i) => i.block === 'warmup');
  const main = s.items.filter((i) => i.block === 'main');
  const cool = s.items.filter((i) => i.block === 'cooldown');
  assert.equal(warm.reduce((a, i) => a + i.targetDuration! + i.restSec, 0), 300); // 15 % de 30 min
  assert.equal(cool.reduce((a, i) => a + i.targetDuration! + i.restSec, 0), 180); // 10 %
  const ids = [...new Set(main.map((i) => i.exerciseId))];
  assert.equal(ids.length, 5);
  assert.deepEqual(ids.slice(0, 3).map((id) => byId.get(id)!.zone), ['bas', 'haut', 'gainage']);
  assert.ok(main.every((i) => i.restSec === 20));
  assert.ok(Math.max(...main.map((i) => i.round)) >= 2);
  assert.match(s.explanation, /J18, phase lutéale, énergie 3\/5 : intensité modérée \(40 s d'effort \/ 20 s de repos\)/);
  assert.match(s.explanation, /Tu as demandé : renfo/);
});

test('déterministe, et « une autre proposition » change les exercices', () => {
  assert.deepEqual(gen({ desire: 'renfo' }), gen({ desire: 'renfo' }));
  const a = gen({ desire: 'renfo' }).items.map((i) => i.exerciseId);
  const b = gen({ desire: 'renfo' }, {}, { variant: 1 }).items.map((i) => i.exerciseId);
  assert.notDeepEqual(a, b);
});

test('filtres : matériel du lieu, niveau, impact en phase menstruelle', () => {
  const home = gen({ desire: 'renfo', place: 'sans_materiel' });
  assert.ok(home.items.every((i) => byId.get(i.exerciseId)!.equipment === 'none'));
  const beginner = gen({ desire: 'cardio', energy: 5, phase: 'folliculaire' }, { level: 'debutante' });
  assert.ok(beginner.items.every((i) => byId.get(i.exerciseId)!.level === 1));
  const mens = gen({ desire: 'cardio', energy: 3, phase: 'menstruelle' });
  assert.ok(mens.items.every((i) => byId.get(i.exerciseId)!.impact === 'faible'));
});

test('variété : les exercices récents passent après les autres', () => {
  const recent = ['jumping-jacks', 'montees-genoux'];
  const s = gen({ desire: 'cardio', energy: 4, phase: 'folliculaire', minutes: 10 }, {}, { history: { ...NO_HISTORY, recentExerciseIds: recent } });
  const main = new Set(s.items.filter((i) => i.block === 'main').map((i) => i.exerciseId));
  assert.ok(!recent.some((id) => main.has(id)));
});

test('prise de muscle : séries de 8 à 12 répétitions, exercice par exercice', () => {
  const s = gen({ desire: 'renfo', energy: 4, phase: 'folliculaire' }, { goal: 'muscle' });
  const main = s.items.filter((i) => i.block === 'main');
  assert.ok(main.filter((i) => i.targetReps !== null).every((i) => i.targetReps! >= 8 && i.targetReps! <= 12));
  assert.ok(main.every((i) => i.restSec === 60));
  assert.equal(main[0].exerciseId, main[1].exerciseId); // séries enchaînées
  assert.match(s.explanation, /séries de 8 à 12 répétitions/);
});

test('charge : dernière perf enregistrée, sinon valeur par défaut du niveau', () => {
  const find = (progress: Map<string, { reps: number | null; duration: number | null; load: number | null }>) => {
    for (let variant = 0; variant < 6; variant++) {
      const s = generateSession({ checkin: { ...CHECKIN, desire: 'renfo' }, profile: PROFILE, exercises, history: NO_HISTORY, variant, progress });
      const item = s.items.find((i) => i.exerciseId === 'squat-goblet');
      if (item) return item;
    }
    throw new Error('squat goblet jamais proposé');
  };
  assert.equal(find(new Map()).targetLoad, 8); // niveau intermédiaire
  const item = find(new Map([['squat-goblet', { reps: 14, duration: null, load: 10 }]]));
  assert.equal(item.targetLoad, 10);
  assert.equal(item.targetReps, 14);
});

test('course : continue, blocs ou fractionné selon l\'intensité', () => {
  const run = (energy: number, phase: CheckinInput['phase']) =>
    gen({ desire: 'course', place: 'exterieur', energy, phase }).items.filter((i) => i.block === 'main');
  assert.equal(run(3, 'luteale').length, 1); // modérée : course continue
  assert.ok(run(5, 'folliculaire').every((i) => i.exerciseId === 'fractionne'));
  assert.ok(run(2, 'menstruelle').every((i) => i.restSec === 60)); // basse : blocs course / marche
});

test('chaque durée de séance reste proche du temps disponible', () => {
  for (const minutes of [10, 20, 30, 45, 60]) {
    for (const desire of ['renfo', 'cardio', 'doux'] as const) {
      const s = gen({ desire, minutes, energy: 4, phase: 'folliculaire' });
      const total = s.items.reduce((a, i) => {
        const e = byId.get(i.exerciseId)!;
        return a + (i.targetDuration ?? i.targetReps! * 3 * (e.perSide ? 2 : 1)) + i.restSec;
      }, 0);
      assert.ok(Math.abs(total - minutes * 60) <= minutes * 60 * 0.35, `${desire} ${minutes} min → ${total} s`);
    }
  }
});
