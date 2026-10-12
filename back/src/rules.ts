// Règles et seuils du coach, centralisés ici pour pouvoir les ajuster facilement.
import type { Phase } from './cycle.js';
import type { SessionType } from './exercises.js';

export type Intensity = 'basse' | 'moderee' | 'haute';
export type Place = 'sans_materiel' | 'avec_materiel' | 'salle' | 'exterieur';
export type Desire = 'auto' | SessionType;

export const PLACES: Place[] = ['sans_materiel', 'avec_materiel', 'salle', 'exterieur'];
export const DESIRES: Desire[] = ['auto', 'renfo', 'cardio', 'doux', 'course'];
export const DURATIONS = [10, 20, 30, 45, 60];

/** Type de séance quand le coach décide : bande d'énergie × phase (2 options = arbitrage par l'objectif). */
export const TYPE_TABLE: Record<'low' | 'mid' | 'high', Record<Phase, SessionType[]>> = {
  low: { menstruelle: ['doux'], folliculaire: ['doux'], ovulatoire: ['doux'], luteale: ['doux'] }, // énergie 1–2
  mid: { menstruelle: ['doux'], folliculaire: ['renfo'], ovulatoire: ['renfo'], luteale: ['renfo'] }, // énergie 3
  high: { menstruelle: ['renfo'], folliculaire: ['renfo', 'cardio'], ovulatoire: ['cardio', 'renfo'], luteale: ['renfo'] }, // 4–5
};

/** Énergie à partir de laquelle l'extérieur transforme le cardio en course (et la prise de muscle, le cardio en renfo). */
export const ENERGY_FOR_COURSE = 3;
export const ENERGY_MUSCLE_NO_CARDIO = 3;
/** Énergie à laquelle on conseille une séance douce si une autre envie est choisie. */
export const ENERGY_LOW_ADVICE = 1;
/** Phase menstruelle avec énergie ≤ ce seuil : pas d'exercices à fort impact. */
export const LOW_IMPACT_MAX_ENERGY = 3;

export const PHASE_MODIFIER: Record<Phase, number> = { menstruelle: -1, folliculaire: 0, ovulatoire: 0.5, luteale: -0.5 };

export function intensityFromScore(score: number): Intensity {
  if (score <= 2) return 'basse';
  if (score <= 3.5) return 'moderee';
  return 'haute';
}

/** Temps d'effort / de repos (s) d'un circuit, et facteur appliqué aux cibles (répétitions, durées). */
export const WORK_REST: Record<Intensity, { work: number; rest: number; factor: number }> = {
  basse: { work: 30, rest: 30, factor: 0.8 },
  moderee: { work: 40, rest: 20, factor: 1 },
  haute: { work: 45, rest: 15, factor: 1.15 },
};

/** Objectif prise de muscle : séries de 8 à 12 répétitions, repos long. */
export const MUSCLE = { minReps: 8, maxReps: 12, rest: { basse: 90, moderee: 75, haute: 60 } as Record<Intensity, number> };

/** Nombre d'exercices différents dans le corps de séance, selon le temps disponible. */
export const EXERCISE_COUNT: Record<number, number> = { 10: 3, 20: 4, 30: 5, 45: 6, 60: 6 };
export const MAX_ROUNDS = 6;
export const WARMUP = { ratio: 0.15, minMinutes: 2 };
export const COOLDOWN = { ratio: 0.1, minMinutes: 1 };
/** Durée estimée d'une répétition (pour estimer la durée d'un exercice en répétitions). */
export const SECONDS_PER_REP = 3;
/** Pause entre deux postures douces / deux exercices d'échauffement. */
export const TRANSITION_REST = 10;

/** Course : blocs marche/course (basse), course continue (modérée), fractionné (haute). */
export const RUN = { blockRun: 120, blockWalk: 60 };

/** Variété : exercices des N dernières séances évités si possible ; fenêtre « bien-être » en jours. */
export const RECENT_SESSIONS = 2;
export const WELLBEING_WINDOW_DAYS = 7;

/** Ajustements en cours de séance. */
export const ADJUST = { maxSteps: 2, hardFactor: 0.8, hardRest: 15, easyFactor: 1.15, easyRest: -10, minRest: 10, minDuration: 10 };

/** Progression d'une séance à la suivante. */
export const PROGRESSION = { up: 0.1, smallUp: 0.05, down: 0.1, loadStep: 1, easyRpeMax: 5, hardRpeMin: 9 };
