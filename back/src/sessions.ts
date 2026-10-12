import { Router } from 'express';
import type { Phase } from './cycle.js';
import { addDays, daysBetween, today, weekStart } from './dates.js';
import { transaction, type Db } from './db.js';
import {
  allowedPlaces, estimateSeconds, generateSession, type CheckinInput, type History, type ItemDraft, type Progress,
} from './engine.js';
import { listExercises, type Exercise, type SessionType } from './exercises.js';
import { badRequest, HttpError, notFound } from './http.js';
import { currentCycle } from './periods.js';
import { getProfile, type Profile } from './profile.js';
import { DESIRES, DURATIONS, ENERGY_LOW_ADVICE, RECENT_SESSIONS, WELLBEING_WINDOW_DAYS, type Desire, type Intensity, type Place } from './rules.js';

export type SessionStatus = 'planned' | 'in_progress' | 'done' | 'interrupted';

interface SessionRow {
  id: number;
  checkin_id: number;
  date: string;
  type: SessionType;
  intensity: Intensity;
  status: SessionStatus;
  variant: number;
  explanation: string;
  advice: string | null;
  adjust_level: number;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  rpe: number | null;
  comment: string | null;
}

interface CheckinRow {
  id: number;
  date: string;
  energy: number;
  minutes: number;
  place: Place;
  desire: Desire;
  phase: Phase;
  cycle_day: number;
}

export interface ItemRow {
  id: number;
  session_id: number;
  position: number;
  block: ItemDraft['block'];
  round: number;
  exercise_id: string;
  note: string | null;
  target_reps: number | null;
  target_duration: number | null;
  target_load: number | null;
  rest_sec: number;
  done_reps: number | null;
  done_duration: number | null;
  done_load: number | null;
  status: 'pending' | 'done' | 'skipped';
  feedback: 'too_hard' | 'too_easy' | null;
}

const FINISHED = `status IN ('done', 'interrupted')`;

export function requireProfile(db: Db): Profile {
  const p = getProfile(db);
  if (!p?.onboarded) throw badRequest("Termine d'abord le démarrage (profil et cycle)");
  return p;
}

export function getSessionRow(db: Db, id: number): SessionRow {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
  if (!row) throw notFound('Séance introuvable');
  return row;
}

export function getItems(db: Db, sessionId: number): ItemRow[] {
  return db.prepare('SELECT * FROM session_items WHERE session_id = ? ORDER BY position').all(sessionId) as unknown as ItemRow[];
}

function getCheckin(db: Db, id: number): CheckinRow {
  return db.prepare('SELECT * FROM checkins WHERE id = ?').get(id) as unknown as CheckinRow;
}

export function exerciseMap(db: Db): Map<string, Exercise> {
  return new Map(listExercises(db).map((e) => [e.id, e]));
}

function progressMap(db: Db): Map<string, Progress> {
  const rows = db.prepare('SELECT exercise_id, reps, duration, load FROM exercise_progress').all() as unknown as ({ exercise_id: string } & Progress)[];
  return new Map(rows.map((r) => [r.exercise_id, { reps: r.reps, duration: r.duration, load: r.load }]));
}

/** Historique utile au moteur : variété, types pratiqués récemment. */
function history(db: Db, date: string): History {
  const recent = db
    .prepare(`SELECT id FROM sessions WHERE ${FINISHED} ORDER BY date DESC, id DESC LIMIT ?`)
    .all(RECENT_SESSIONS) as { id: number }[];
  const recentExerciseIds = recent.flatMap((s) =>
    (db.prepare(`SELECT DISTINCT exercise_id FROM session_items WHERE session_id = ? AND block = 'main'`).all(s.id) as { exercise_id: string }[])
      .map((r) => r.exercise_id),
  );
  const typeCounts: History['typeCounts'] = {};
  for (const r of db
    .prepare(`SELECT type, COUNT(*) AS n FROM sessions WHERE ${FINISHED} AND date > ? GROUP BY type`)
    .all(addDays(date, -WELLBEING_WINDOW_DAYS)) as { type: SessionType; n: number }[]) {
    typeCounts[r.type] = r.n;
  }
  const daysSinceType: History['daysSinceType'] = {};
  for (const r of db.prepare(`SELECT type, MAX(date) AS last FROM sessions WHERE ${FINISHED} GROUP BY type`).all() as { type: SessionType; last: string }[]) {
    daysSinceType[r.type] = daysBetween(r.last, date);
  }
  return { recentExerciseIds, typeCounts, daysSinceType };
}

function insertItems(db: Db, sessionId: number, items: ItemDraft[]) {
  const insert = db.prepare(
    `INSERT INTO session_items (session_id, position, block, round, exercise_id, note, target_reps, target_duration, target_load, rest_sec)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  items.forEach((i, pos) =>
    insert.run(sessionId, pos, i.block, i.round, i.exerciseId, i.note, i.targetReps, i.targetDuration, i.targetLoad, i.restSec),
  );
}

function toCheckinInput(c: CheckinRow): CheckinInput {
  return { energy: c.energy, minutes: c.minutes, place: c.place, desire: c.desire, phase: c.phase, cycleDay: c.cycle_day };
}

/** Détail complet d'une séance, pour l'aperçu, la séance guidée, la fin et l'historique. */
export function sessionDetail(db: Db, id: number) {
  const s = getSessionRow(db, id);
  const c = getCheckin(db, s.checkin_id);
  const exercises = exerciseMap(db);
  const items = getItems(db, id).map((i) => {
    const e = exercises.get(i.exercise_id)!;
    return {
      id: i.id,
      position: i.position,
      block: i.block,
      round: i.round,
      exerciseId: i.exercise_id,
      note: i.note,
      targetReps: i.target_reps,
      targetDuration: i.target_duration,
      targetLoad: i.target_load,
      restSec: i.rest_sec,
      doneReps: i.done_reps,
      doneDuration: i.done_duration,
      doneLoad: i.done_load,
      status: i.status,
      feedback: i.feedback,
      exercise: { name: e.name, type: e.type, mode: e.mode, perSide: e.perSide, cues: e.cues, zone: e.zone },
    };
  });
  const estimatedSec = items.reduce(
    (sum, i) => sum + estimateSeconds({ targetReps: i.targetReps, targetDuration: i.targetDuration, restSec: i.restSec }, i.exercise.perSide),
    0,
  );
  return {
    id: s.id,
    date: s.date,
    type: s.type,
    intensity: s.intensity,
    status: s.status,
    explanation: s.explanation,
    advice: s.advice,
    // Énergie 1 et séance non douce : on propose de basculer en séance douce.
    offerDoux: s.status === 'planned' && s.type !== 'doux' && c.energy <= ENERGY_LOW_ADVICE,
    adjustLevel: s.adjust_level,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    durationSec: s.duration_sec,
    rpe: s.rpe,
    comment: s.comment,
    estimatedSec,
    rounds: Math.max(0, ...items.filter((i) => i.block === 'main').map((i) => i.round)),
    checkin: {
      energy: c.energy, minutes: c.minutes, place: c.place, desire: c.desire, phase: c.phase, cycleDay: c.cycle_day,
    },
    items,
  };
}

/** Séances commencées un jour précédent et jamais terminées : interrompues. */
function closeStaleSessions(db: Db, date: string) {
  db.prepare(`UPDATE sessions SET status = 'interrupted', ended_at = COALESCE(ended_at, started_at) WHERE status = 'in_progress' AND date < ?`).run(date);
}

function validateCheckin(body: Record<string, unknown>, profile: Profile) {
  const { energy, minutes, place, desire } = body;
  if (!Number.isInteger(energy) || (energy as number) < 1 || (energy as number) > 5) throw badRequest('Énergie : entre 1 et 5');
  if (!DURATIONS.includes(minutes as number)) throw badRequest('Temps disponible invalide');
  if (!allowedPlaces(profile).includes(place as Place)) throw badRequest('Lieu non disponible avec ton matériel');
  if (!DESIRES.includes(desire as Desire)) throw badRequest('Envie du jour invalide');
  return { energy: energy as number, minutes: minutes as number, place: place as Place, desire: desire as Desire };
}

/** (Re)génère les exercices d'une séance planifiée. */
function regenerate(db: Db, session: SessionRow, variant: number, forcedType?: SessionType) {
  const profile = requireProfile(db);
  const checkin = toCheckinInput(getCheckin(db, session.checkin_id));
  const generated = generateSession({
    checkin, profile, exercises: listExercises(db), progress: progressMap(db), history: history(db, session.date), variant,
    forced: { type: forcedType ?? session.type, intensity: session.intensity },
  });
  transaction(db, () => {
    db.prepare('DELETE FROM session_items WHERE session_id = ?').run(session.id);
    insertItems(db, session.id, generated.items);
    db.prepare('UPDATE sessions SET variant = ?, type = ?, explanation = ?, advice = ? WHERE id = ?')
      .run(variant, generated.type, generated.explanation, generated.advice, session.id);
  });
}

export function sessionsRouter(db: Db) {
  const r = Router();

  r.get('/today', (_req, res) => {
    const date = today();
    closeStaleSessions(db, date);
    const profile = requireProfile(db);
    const week = db
      .prepare(`SELECT COUNT(*) AS n FROM sessions WHERE status = 'done' AND date >= ? AND date <= ?`)
      .get(weekStart(date), date) as { n: number };
    const last = db
      .prepare(`SELECT id, date, type, intensity, rpe, duration_sec FROM sessions WHERE ${FINISHED} ORDER BY date DESC, id DESC LIMIT 1`)
      .get() as Pick<SessionRow, 'id' | 'date' | 'type' | 'intensity' | 'rpe' | 'duration_sec'> | undefined;
    const pending = db
      .prepare(`SELECT id, status FROM sessions WHERE date = ? AND status IN ('planned', 'in_progress') ORDER BY id DESC LIMIT 1`)
      .get(date) as { id: number; status: SessionStatus } | undefined;
    const lastCheckin = db.prepare('SELECT * FROM checkins ORDER BY id DESC LIMIT 1').get() as CheckinRow | undefined;
    res.json({
      today: date,
      cycle: currentCycle(db, date),
      week: { done: week.n, target: profile.weeklyTarget },
      lastSession: last
        ? { id: last.id, date: last.date, type: last.type, intensity: last.intensity, rpe: last.rpe, durationSec: last.duration_sec }
        : null,
      pending: pending ?? null,
      places: allowedPlaces(profile),
      lastCheckin: lastCheckin ? { minutes: lastCheckin.minutes, place: lastCheckin.place } : null,
    });
  });

  r.post('/checkins', (req, res) => {
    const profile = requireProfile(db);
    const input = validateCheckin(req.body ?? {}, profile);
    const date = today();
    const cycle = currentCycle(db, date);
    if (!cycle) throw badRequest('Note au moins 2 débuts de règles pour calculer ta phase');
    const checkin: CheckinInput = { ...input, phase: cycle.phase, cycleDay: cycle.day };
    const generated = generateSession({
      checkin, profile, exercises: listExercises(db), progress: progressMap(db), history: history(db, date), variant: 0,
    });
    const id = transaction(db, () => {
      // Un seul check-in actif par jour : la séance du jour non commencée est remplacée.
      const old = db.prepare(`SELECT id, checkin_id FROM sessions WHERE date = ? AND status = 'planned'`).all(date) as { id: number; checkin_id: number }[];
      for (const o of old) {
        db.prepare('DELETE FROM sessions WHERE id = ?').run(o.id);
        db.prepare('DELETE FROM checkins WHERE id = ?').run(o.checkin_id);
      }
      const c = db
        .prepare(`INSERT INTO checkins (date, energy, minutes, place, desire, phase, cycle_day, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(date, checkin.energy, checkin.minutes, checkin.place, checkin.desire, checkin.phase, checkin.cycleDay, new Date().toISOString());
      const s = db
        .prepare(`INSERT INTO sessions (checkin_id, date, type, intensity, explanation, advice) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(c.lastInsertRowid, date, generated.type, generated.intensity, generated.explanation, generated.advice);
      insertItems(db, Number(s.lastInsertRowid), generated.items);
      return Number(s.lastInsertRowid);
    });
    res.status(201).json(sessionDetail(db, id));
  });

  r.get('/sessions/:id', (req, res) => {
    res.json(sessionDetail(db, Number(req.params.id)));
  });

  // « Une autre proposition » (variante suivante), ou bascule en séance douce.
  r.post('/sessions/:id/regenerate', (req, res) => {
    const s = getSessionRow(db, Number(req.params.id));
    if (s.status !== 'planned') throw new HttpError(409, 'La séance a déjà commencé');
    const toDoux = req.body?.type === 'doux';
    regenerate(db, s, toDoux ? 0 : s.variant + 1, toDoux ? 'doux' : undefined);
    res.json(sessionDetail(db, s.id));
  });

  r.post('/sessions/:id/start', (req, res) => {
    const s = getSessionRow(db, Number(req.params.id));
    if (s.status === 'planned') {
      db.prepare(`UPDATE sessions SET status = 'in_progress', started_at = ? WHERE id = ?`).run(new Date().toISOString(), s.id);
    } else if (s.status !== 'in_progress') {
      throw new HttpError(409, 'Cette séance est déjà terminée');
    }
    res.json(sessionDetail(db, s.id));
  });

  return r;
}
