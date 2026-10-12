// Moteur de génération des séances : fonctions pures et déterministes
// (mêmes entrées + même historique + même variante → même séance).
import type { Phase } from './cycle.js';
import type { Exercise, ExerciseEquipment, SessionType, Zone } from './exercises.js';
import type { Goal, Profile } from './profile.js';
import { levelNumber } from './profile.js';
import {
  COOLDOWN, ENERGY_FOR_COURSE, ENERGY_LOW_ADVICE, ENERGY_MUSCLE_NO_CARDIO, EXERCISE_COUNT, intensityFromScore,
  LOW_IMPACT_MAX_ENERGY, MAX_ROUNDS, MUSCLE, PHASE_MODIFIER, RUN, SECONDS_PER_REP, TRANSITION_REST, TYPE_TABLE,
  WARMUP, WORK_REST, type Desire, type Intensity, type Place,
} from './rules.js';

export interface CheckinInput {
  energy: number;
  minutes: number;
  place: Place;
  desire: Desire;
  phase: Phase;
  cycleDay: number;
}

export interface History {
  /** Exercices du corps de séance des dernières séances (variété). */
  recentExerciseIds: string[];
  /** Séances par type sur les 7 derniers jours (objectif bien-être). */
  typeCounts: Partial<Record<SessionType, number>>;
  /** Jours écoulés depuis la dernière séance de chaque type. */
  daysSinceType: Partial<Record<SessionType, number>>;
}

export interface Progress {
  reps: number | null;
  duration: number | null;
  load: number | null;
}

export interface ItemDraft {
  block: 'warmup' | 'main' | 'cooldown';
  round: number;
  exerciseId: string;
  note: string | null;
  targetReps: number | null;
  targetDuration: number | null;
  targetLoad: number | null;
  restSec: number;
}

export interface GeneratedSession {
  type: SessionType;
  intensity: Intensity;
  advice: string | null;
  explanation: string;
  items: ItemDraft[];
}

export const TYPE_LABELS: Record<SessionType, string> = { renfo: 'renfo', cardio: 'cardio', doux: 'séance douce', course: 'course' };
const PHASE_LABELS: Record<Phase, string> = { menstruelle: 'menstruelle', folliculaire: 'folliculaire', ovulatoire: 'ovulatoire', luteale: 'lutéale' };
const GOAL_LABELS: Record<Goal, string> = {
  force: 'force', endurance: 'endurance', perte_poids: 'perte de poids', muscle: 'prise de muscle', bien_etre: 'bien-être',
};
export const INTENSITY_LABELS: Record<Intensity, string> = { basse: 'basse', moderee: 'modérée', haute: 'haute' };
const ZONE_LABELS: Record<Zone, string> = { bas: 'bas du corps', haut: 'haut du corps', gainage: 'gainage', corps: 'corps entier' };

/** Matériel utilisable selon le lieu du jour et le matériel possédé. */
export function availableEquipment(place: Place, profile: Pick<Profile, 'equipment'>): ExerciseEquipment[] {
  switch (place) {
    case 'sans_materiel': return ['none'];
    case 'salle': return ['none', 'dumbbells', 'band'];
    case 'exterieur': return ['none', 'outdoor'];
    case 'avec_materiel': {
      const eq: ExerciseEquipment[] = ['none'];
      if (profile.equipment.includes('dumbbells')) eq.push('dumbbells');
      if (profile.equipment.includes('band')) eq.push('band');
      return eq;
    }
  }
}

/** Lieux proposés au check-in, selon le matériel coché dans le profil. */
export function allowedPlaces(profile: Pick<Profile, 'equipment'>): Place[] {
  const places: Place[] = ['sans_materiel'];
  if (profile.equipment.includes('dumbbells') || profile.equipment.includes('band')) places.push('avec_materiel');
  if (profile.equipment.includes('gym')) places.push('salle');
  places.push('exterieur');
  return places;
}

export function computeIntensity(energy: number, phase: Phase): Intensity {
  return intensityFromScore(energy + PHASE_MODIFIER[phase]);
}

/** Choix du type de séance (envie, table énergie × phase, objectif, lieu) et justification. */
export function chooseType(
  c: Pick<CheckinInput, 'energy' | 'phase' | 'desire' | 'place'>,
  goal: Goal,
  history: Pick<History, 'typeCounts'>,
): { type: SessionType; reason: string; advice: string | null } {
  if (c.desire !== 'auto') {
    let type: SessionType = c.desire;
    const advices: string[] = [];
    if (type === 'course' && c.place !== 'exterieur') {
      type = 'cardio';
      advices.push('La course se fait en extérieur : je te propose du cardio à la place.');
    }
    if (c.energy <= ENERGY_LOW_ADVICE && type !== 'doux') {
      advices.push('Énergie basse : une séance douce serait aussi une bonne option.');
    }
    return { type, reason: `Tu as demandé : ${TYPE_LABELS[c.desire]}.`, advice: advices.join(' ') || null };
  }

  const band = c.energy <= 2 ? 'low' : c.energy === 3 ? 'mid' : 'high';
  const options = TYPE_TABLE[band][c.phase];
  let type = options[0];
  if (options.length > 1) {
    if (goal === 'endurance' || goal === 'perte_poids') type = options.includes('cardio') ? 'cardio' : options[0];
    else if (goal === 'force' || goal === 'muscle') type = options.includes('renfo') ? 'renfo' : options[0];
    else {
      // bien-être : le type le moins pratiqué récemment (à égalité, l'ordre de la table)
      type = [...options].sort((a, b) => (history.typeCounts[a] ?? 0) - (history.typeCounts[b] ?? 0))[0];
    }
  }
  if (goal === 'muscle' && type === 'cardio' && c.energy >= ENERGY_MUSCLE_NO_CARDIO) type = 'renfo';
  if (type === 'cardio' && c.place === 'exterieur' && c.energy >= ENERGY_FOR_COURSE) type = 'course';
  return {
    type,
    reason: `Le coach a choisi : ${TYPE_LABELS[type]} (énergie ${c.energy}/5, phase ${PHASE_LABELS[c.phase]}, objectif ${GOAL_LABELS[goal]}).`,
    advice: null,
  };
}

function roundTo5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

/** Durée estimée d'un élément de séance (secondes, repos compris). */
export function estimateSeconds(item: Pick<ItemDraft, 'targetReps' | 'targetDuration' | 'restSec'>, perSide: boolean): number {
  const work = item.targetDuration ?? (item.targetReps ?? 0) * SECONDS_PER_REP * (perSide ? 2 : 1);
  return work + item.restSec;
}

interface BuildContext {
  type: SessionType;
  intensity: Intensity;
  checkin: CheckinInput;
  profile: Profile;
  exercises: Exercise[];
  progress: Map<string, Progress>;
  history: History;
  variant: number;
}

/** Fait tourner une liste (variante suivante = on commence un cran plus loin). */
function rotate<T>(list: T[], n: number): T[] {
  if (list.length === 0) return list;
  const k = ((n % list.length) + list.length) % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}

/** Exercices éligibles pour le corps de séance, les moins récents d'abord. */
function mainPool(ctx: BuildContext): Exercise[] {
  const eq = availableEquipment(ctx.checkin.place, ctx.profile);
  const level = levelNumber(ctx.profile.level);
  const lowImpact = ctx.checkin.phase === 'menstruelle' && ctx.checkin.energy <= LOW_IMPACT_MAX_ENERGY;
  const recent = new Set(ctx.history.recentExerciseIds);
  return ctx.exercises
    .filter((e) => e.type === ctx.type && eq.includes(e.equipment) && e.level <= level && !(lowImpact && e.impact === 'fort'))
    .map((e, i) => ({ e, i }))
    .sort((a, b) => Number(recent.has(a.e.id)) - Number(recent.has(b.e.id)) || a.i - b.i)
    .map(({ e }) => e);
}

/** Sélection en renfo : alternance bas du corps / haut du corps / gainage. */
function pickBalanced(pool: Exercise[], count: number, variant: number): Exercise[] {
  const zones: Zone[] = ['bas', 'haut', 'gainage'];
  const byZone = new Map(zones.map((z) => [z, rotate(pool.filter((e) => e.zone === z), variant)]));
  const others = rotate(pool.filter((e) => !zones.includes(e.zone)), variant);
  const picked: Exercise[] = [];
  for (let k = 0; picked.length < count && k < count * 3; k++) {
    const list = byZone.get(zones[k % zones.length])!;
    const next = list.shift();
    if (next) picked.push(next);
  }
  // Zones épuisées : on complète avec ce qui reste.
  const rest = [...zones.flatMap((z) => byZone.get(z)!), ...others];
  while (picked.length < count && rest.length) picked.push(rest.shift()!);
  return picked;
}

/** Cibles d'un exercice du corps de séance (dernière perf ou valeur par défaut, ajustée à l'intensité). */
function targetsFor(e: Exercise, ctx: BuildContext, series: boolean): Pick<ItemDraft, 'targetReps' | 'targetDuration' | 'targetLoad'> {
  const lvl = levelNumber(ctx.profile.level) - 1;
  const p = ctx.progress.get(e.id);
  const factor = WORK_REST[ctx.intensity].factor;
  const load = e.defaultLoads ? (p?.load ?? e.defaultLoads[lvl]) : null;
  if (e.mode === 'time') {
    return { targetReps: null, targetDuration: roundTo5(Math.max(10, (p?.duration ?? e.defaults[lvl]) * factor)), targetLoad: load };
  }
  const base = p?.reps ?? e.defaults[lvl];
  const reps = series
    ? Math.min(MUSCLE.maxReps, Math.max(MUSCLE.minReps, Math.round(base * factor)))
    : Math.max(1, Math.round(base * factor));
  return { targetReps: reps, targetDuration: null, targetLoad: load };
}

function timed(exerciseId: string, block: ItemDraft['block'], seconds: number, note: string | null = null, rest = 0): ItemDraft {
  return { block, round: 1, exerciseId, note, targetReps: null, targetDuration: roundTo5(seconds), targetLoad: null, restSec: rest };
}

function warmupAndCooldown(ctx: BuildContext, warmSec: number, coolSec: number): { warmup: ItemDraft[]; cooldown: ItemDraft[] } {
  const lowImpact = ctx.checkin.phase === 'menstruelle' && ctx.checkin.energy <= LOW_IMPACT_MAX_ENERGY;
  if (ctx.type === 'course') {
    return {
      warmup: [timed('course-facile', 'warmup', warmSec, 'marche rapide puis trottinement')],
      cooldown: [
        timed('course-facile', 'cooldown', coolSec / 2, 'marche tranquille'),
        timed('fente-basse-etirement', 'cooldown', coolSec / 2, 'par côté'),
      ],
    };
  }
  const warmup =
    ctx.type === 'doux'
      ? [timed('pas-chasses', 'warmup', warmSec, 'tout en douceur')]
      : [
          timed(lowImpact || ctx.intensity === 'basse' ? 'pas-chasses' : 'jumping-jacks', 'warmup', warmSec * 0.6, null, TRANSITION_REST),
          timed('chat-vache', 'warmup', warmSec * 0.4 - TRANSITION_REST),
        ];
  const cooldown =
    ctx.type === 'doux'
      ? [timed('posture-enfant', 'cooldown', coolSec)]
      : [
          timed('posture-enfant', 'cooldown', coolSec / 2, null, TRANSITION_REST),
          timed('fente-basse-etirement', 'cooldown', coolSec / 2 - TRANSITION_REST, 'par côté'),
        ];
  return { warmup, cooldown };
}

function courseMain(ctx: BuildContext, mainSec: number): { items: ItemDraft[]; note: string } {
  const byId = new Map(ctx.exercises.map((e) => [e.id, e]));
  const level = levelNumber(ctx.profile.level);
  const fractionne = byId.get('fractionne');
  if (ctx.intensity === 'haute' && fractionne && fractionne.level <= level) {
    const p = ctx.progress.get('fractionne');
    const effort = roundTo5((p?.duration ?? fractionne.defaults[level - 1]) * WORK_REST.haute.factor);
    const rounds = Math.max(2, Math.floor(mainSec / (effort * 2)));
    const items = Array.from({ length: rounds }, (_, i) => ({
      ...timed('fractionne', 'main', effort, 'allure soutenue', effort), round: i + 1,
    }));
    return { items, note: `fractionné : ${rounds} × ${effort} s d'effort, récupération en marchant` };
  }
  if (ctx.intensity === 'moderee') {
    return { items: [timed('course-facile', 'main', mainSec, 'allure facile continue')], note: 'course continue à allure facile' };
  }
  const block = RUN.blockRun + RUN.blockWalk;
  const rounds = Math.max(1, Math.floor(mainSec / block));
  const items = Array.from({ length: rounds }, (_, i) => ({
    ...timed('course-facile', 'main', RUN.blockRun, 'course légère, puis 1 min de marche', RUN.blockWalk), round: i + 1,
  }));
  return { items, note: `${rounds} blocs de 2 min de course et 1 min de marche` };
}

function explain(ctx: BuildContext, reason: string, extra: string): string {
  const c = ctx.checkin;
  const wr = WORK_REST[ctx.intensity];
  const rhythm =
    ctx.type === 'doux' ? 'postures tenues, rythme lent'
      : ctx.type === 'course' ? extra
        : ctx.profile.goal === 'muscle' && ctx.type === 'renfo' ? `séries de ${MUSCLE.minReps} à ${MUSCLE.maxReps} répétitions, ${MUSCLE.rest[ctx.intensity]} s de repos`
          : `${wr.work} s d'effort / ${wr.rest} s de repos`;
  const parts = [
    `J${c.cycleDay}, phase ${PHASE_LABELS[c.phase]}, énergie ${c.energy}/5 : intensité ${INTENSITY_LABELS[ctx.intensity]} (${rhythm}).`,
    reason,
  ];
  const days = ctx.history.daysSinceType[ctx.type];
  const since = days === undefined ? 'première séance de ce type' : days === 0 ? 'déjà fait aujourd\'hui' : `pas fait depuis ${days} jour${days > 1 ? 's' : ''}`;
  parts.push(ctx.type === 'renfo' && extra ? `Focus ${extra}, ${since}.` : `${since.charAt(0).toUpperCase()}${since.slice(1)}.`);
  return parts.join(' ');
}

/**
 * Génère une séance complète. `forced` impose type et intensité (« Une autre proposition »,
 * bascule en séance douce) ; `variant` fait tourner le choix des exercices.
 */
export function generateSession(
  input: Omit<BuildContext, 'type' | 'intensity'> & { forced?: { type: SessionType; intensity: Intensity } },
): GeneratedSession {
  const choice = chooseType(input.checkin, input.profile.goal, input.history);
  const type = input.forced?.type ?? choice.type;
  const intensity = input.forced?.intensity ?? computeIntensity(input.checkin.energy, input.checkin.phase);
  const ctx: BuildContext = { ...input, type, intensity };
  const reason = input.forced && input.forced.type !== choice.type ? `Tu as choisi : ${TYPE_LABELS[type]}.` : choice.reason;
  const advice = input.forced && type === 'doux' ? null : choice.advice;

  const m = ctx.checkin.minutes;
  const warmSec = Math.max(WARMUP.minMinutes, Math.round(m * WARMUP.ratio)) * 60;
  const coolSec = Math.max(COOLDOWN.minMinutes, Math.round(m * COOLDOWN.ratio)) * 60;
  const mainSec = m * 60 - warmSec - coolSec;
  const { warmup, cooldown } = warmupAndCooldown(ctx, warmSec, coolSec);

  if (type === 'course') {
    const { items, note } = courseMain(ctx, mainSec);
    return { type, intensity, advice, explanation: explain(ctx, reason, note), items: [...warmup, ...items, ...cooldown] };
  }

  const pool = mainPool(ctx);
  const count = Math.min(EXERCISE_COUNT[m] ?? 4, pool.length);
  const chosen = type === 'renfo' ? pickBalanced(pool, count, ctx.variant) : rotate(pool, ctx.variant).slice(0, count);
  const series = type === 'renfo' && ctx.profile.goal === 'muscle';
  const rest = type === 'doux' ? TRANSITION_REST : series ? MUSCLE.rest[intensity] : WORK_REST[intensity].rest;
  const templates = chosen.map((e) => ({
    e,
    item: {
      block: 'main' as const, round: 1, exerciseId: e.id, note: e.perSide ? 'par côté' : null,
      ...targetsFor(e, ctx, series), restSec: rest,
    },
  }));
  // Nombre de tours calculé pour remplir le corps de séance.
  const roundSec = templates.reduce((s, t) => s + estimateSeconds(t.item, t.e.perSide), 0);
  const rounds = roundSec > 0 ? Math.min(MAX_ROUNDS, Math.max(1, Math.round(mainSec / roundSec))) : 0;
  const main: ItemDraft[] = [];
  if (series) {
    // Séries : toutes les séries d'un exercice, puis l'exercice suivant.
    for (const t of templates) for (let r = 1; r <= rounds; r++) main.push({ ...t.item, round: r });
  } else {
    // Circuit : un tour = tous les exercices.
    for (let r = 1; r <= rounds; r++) for (const t of templates) main.push({ ...t.item, round: r });
  }
  const zones = [...new Set(chosen.map((e) => ZONE_LABELS[e.zone]))].join(' + ');
  return { type, intensity, advice, explanation: explain(ctx, reason, zones), items: [...warmup, ...main, ...cooldown] };
}
