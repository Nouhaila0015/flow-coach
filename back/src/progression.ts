// Progression d'une séance à la suivante, et ajustements en cours de séance (fonctions pures).
import type { Progress } from './engine.js';
import type { Exercise } from './exercises.js';
import type { Goal } from './profile.js';
import { ADJUST, MUSCLE, PROGRESSION } from './rules.js';

export interface DoneItem {
  status: 'pending' | 'done' | 'skipped';
  feedback: 'too_hard' | 'too_easy' | null;
  targetReps: number | null;
  targetDuration: number | null;
  doneReps: number | null;
  doneDuration: number | null;
  doneLoad: number | null;
}

export interface ProgressChange {
  before: Progress;
  after: Progress;
  rule: string;
}

/** Cible de départ d'un exercice : dernière progression enregistrée, sinon valeurs par défaut du niveau. */
export function baseProgress(e: Exercise, levelIdx: number, current?: Progress): Progress {
  return {
    reps: e.mode === 'reps' ? (current?.reps ?? e.defaults[levelIdx]) : null,
    duration: e.mode === 'time' ? (current?.duration ?? e.defaults[levelIdx]) : null,
    load: e.defaultLoads ? (current?.load ?? e.defaultLoads[levelIdx]) : null,
  };
}

/** Multiplie une cible en garantissant au moins un cran de changement (1 répétition, 5 s). */
function scale(value: number, factor: number, step: number): number {
  const raw = factor > 1 ? Math.max(value * factor, value + step) : Math.min(value * factor, value - step);
  return Math.max(step, Math.round(raw / step) * step);
}

/**
 * Nouvelle cible d'un exercice après une séance terminée.
 * Règles : sauté → inchangé ; RPE ≥ 9 ou « trop dur » → −10 % ; RPE ≤ 5 et cibles atteintes → +10 % (ou +1 kg) ;
 * RPE 6–8 → inchangé, ou +5 % si « trop facile ». Prise de muscle : +1 kg dès 12 répétitions, puis retour à 8.
 * Séance allégée en cours de route (eased) : les cibles ont été baissées, les atteindre ne fait pas monter la suivante.
 */
export function nextProgress(e: Exercise, items: DoneItem[], rpe: number, goal: Goal, base: Progress, eased = false): ProgressChange {
  const done = items.filter((i) => i.status === 'done');
  const same = (rule: string): ProgressChange => ({ before: base, after: base, rule });
  if (done.length === 0) return same(items.some((i) => i.status === 'skipped') ? 'sauté' : 'non fait');

  const loads = done.map((i) => i.doneLoad).filter((l): l is number => l !== null && l > 0);
  const load = base.load === null ? null : loads.length ? Math.max(...loads) : base.load;
  const current: Progress = { ...base, load };
  const tooHard = items.some((i) => i.feedback === 'too_hard');
  const tooEasy = items.some((i) => i.feedback === 'too_easy');
  const reached = !eased && done.every((i) =>
    e.mode === 'reps' ? (i.doneReps ?? i.targetReps ?? 0) >= (i.targetReps ?? 0) : (i.doneDuration ?? i.targetDuration ?? 0) >= (i.targetDuration ?? 0),
  );
  const change = (factor: number, rule: string): ProgressChange => ({
    before: base,
    after: {
      ...current,
      reps: current.reps === null ? null : scale(current.reps, factor, 1),
      duration: current.duration === null ? null : scale(current.duration, factor, 5),
    },
    rule,
  });

  if (rpe >= PROGRESSION.hardRpeMin || tooHard) return change(1 - PROGRESSION.down, tooHard ? 'trop dur' : `RPE ${rpe}`);

  const usesLoad = current.load !== null && current.load > 0;
  if (goal === 'muscle' && usesLoad && e.mode === 'reps') {
    const best = Math.max(...done.map((i) => i.doneReps ?? i.targetReps ?? 0));
    if (best >= MUSCLE.maxReps) {
      return { before: base, after: { ...current, load: current.load! + PROGRESSION.loadStep, reps: MUSCLE.minReps }, rule: `${MUSCLE.maxReps} rép. atteintes` };
    }
    const capped = (c: ProgressChange) => ({ ...c, after: { ...c.after, reps: Math.min(MUSCLE.maxReps, c.after.reps!) } });
    if (rpe <= PROGRESSION.easyRpeMax && reached) return capped(change(1 + PROGRESSION.up, `RPE ${rpe}`));
    if (tooEasy) return capped(change(1 + PROGRESSION.smallUp, 'trop facile'));
    return { before: base, after: current, rule: 'cible gardée' };
  }

  if (rpe <= PROGRESSION.easyRpeMax && reached) {
    if (usesLoad) return { before: base, after: { ...current, load: current.load! + PROGRESSION.loadStep }, rule: `RPE ${rpe}` };
    return change(1 + PROGRESSION.up, `RPE ${rpe}`);
  }
  if (tooEasy) return change(1 + PROGRESSION.smallUp, 'trop facile');
  return { before: base, after: current, rule: eased && rpe <= PROGRESSION.easyRpeMax ? 'séance allégée' : 'cible gardée' };
}

/** Cibles d'un exercice restant après « trop dur » (direction −1) ou « trop facile » (+1). */
export function adjustTargets(
  item: { targetReps: number | null; targetDuration: number | null; restSec: number },
  direction: -1 | 1,
) {
  const factor = direction < 0 ? ADJUST.hardFactor : ADJUST.easyFactor;
  return {
    targetReps: item.targetReps === null ? null : Math.max(1, Math.round(item.targetReps * factor)),
    targetDuration: item.targetDuration === null ? null : Math.max(ADJUST.minDuration, Math.round((item.targetDuration * factor) / 5) * 5),
    restSec: item.restSec === 0 && direction > 0 ? 0 : Math.max(ADJUST.minRest, item.restSec + (direction < 0 ? ADJUST.hardRest : ADJUST.easyRest)),
  };
}
