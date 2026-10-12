import { Router } from 'express';
import { PHASES, type Phase } from './cycle.js';
import { addDays, daysBetween, today, weekStart } from './dates.js';
import type { Db } from './db.js';
import { listExercises, type SessionType } from './exercises.js';
import { badRequest } from './http.js';
import { requireProfile, type SessionStatus } from './sessions.js';

const PERIOD_WEEKS: Record<string, number | null> = { '4w': 4, '12w': 12, all: null };
/** Période « tout » : nombre minimal de semaines affichées. */
const MIN_WEEKS = 4;
const TYPES: SessionType[] = ['renfo', 'cardio', 'doux', 'course'];

interface Row {
  id: number;
  date: string;
  type: SessionType;
  status: SessionStatus;
  durationSec: number | null;
  rpe: number | null;
  phase: Phase;
  energy: number;
}

const average = (values: number[]): number | null =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

/**
 * Série de semaines consécutives où l'objectif est atteint, en remontant depuis la semaine en cours.
 * Une semaine en cours pas encore complète ne casse pas la série.
 */
export function weekStreak(doneByWeek: Map<string, number>, target: number, currentWeek: string): number {
  let week = currentWeek;
  if ((doneByWeek.get(week) ?? 0) < target) week = addDays(week, -7);
  let streak = 0;
  while ((doneByWeek.get(week) ?? 0) >= target) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

export function statsRouter(db: Db) {
  const r = Router();

  // Tableau de bord. L'objectif et la régularité comptent les séances terminées ;
  // les minutes et les moyennes par phase incluent aussi les séances interrompues.
  r.get('/stats', (req, res) => {
    const period = String(req.query.period ?? '4w');
    if (!(period in PERIOD_WEEKS)) throw badRequest('Période invalide');
    const profile = requireProfile(db);
    const thisWeek = weekStart(today());
    const all = db
      .prepare(
        `SELECT s.id, s.date, s.type, s.status, s.duration_sec AS durationSec, s.rpe, c.phase, c.energy
         FROM sessions s JOIN checkins c ON c.id = s.checkin_id
         WHERE s.status IN ('done', 'interrupted')
         ORDER BY s.date, s.id`,
      )
      .all() as unknown as Row[];

    const weekCount = PERIOD_WEEKS[period]
      ?? Math.max(MIN_WEEKS, all.length ? daysBetween(weekStart(all[0].date), thisWeek) / 7 + 1 : 0);
    const since = addDays(thisWeek, -7 * (weekCount - 1));
    const rows = all.filter((s) => s.date >= since);
    const done = rows.filter((s) => s.status === 'done');

    const doneByWeek = new Map<string, number>();
    for (const s of all) {
      if (s.status === 'done') doneByWeek.set(weekStart(s.date), (doneByWeek.get(weekStart(s.date)) ?? 0) + 1);
    }

    const weeks = Array.from({ length: weekCount }, (_, i) => {
      const start = addDays(since, 7 * i);
      const inWeek = rows.filter((s) => weekStart(s.date) === start);
      const minutes = Object.fromEntries(
        TYPES.map((t) => [t, Math.round(inWeek.filter((s) => s.type === t).reduce((sum, s) => sum + (s.durationSec ?? 0), 0) / 60)]),
      ) as Record<SessionType, number>;
      return { start, sessions: doneByWeek.get(start) ?? 0, minutes };
    });

    const phases = PHASES.map((phase) => {
      const inPhase = rows.filter((s) => s.phase === phase);
      return {
        phase,
        sessions: inPhase.length,
        energy: average(inPhase.map((s) => s.energy)),
        rpe: average(inPhase.flatMap((s) => (s.rpe === null ? [] : [s.rpe]))),
      };
    });

    // Progression : meilleure performance de chaque séance, par exercice du corps de séance.
    const points = db
      .prepare(
        `SELECT i.exercise_id AS id, s.id AS sessionId, s.date,
                MAX(i.done_reps) AS reps, MAX(i.done_duration) AS duration, MAX(i.done_load) AS load
         FROM session_items i JOIN sessions s ON s.id = i.session_id
         WHERE i.status = 'done' AND i.block = 'main' AND s.status IN ('done', 'interrupted') AND s.date >= ?
         GROUP BY i.exercise_id, s.id
         ORDER BY s.date, s.id`,
      )
      .all(since) as { id: string; sessionId: number; date: string; reps: number | null; duration: number | null; load: number | null }[];
    const exercises = listExercises(db)
      .map((e) => ({
        id: e.id,
        name: e.name,
        mode: e.mode,
        points: points.filter((p) => p.id === e.id).map(({ id: _id, ...p }) => p),
      }))
      .filter((e) => e.points.length > 0);

    res.json({
      period,
      kpis: {
        weekDone: doneByWeek.get(thisWeek) ?? 0,
        weekTarget: profile.weeklyTarget,
        streak: weekStreak(doneByWeek, profile.weeklyTarget, thisWeek),
        sessions: done.length,
        totalMinutes: Math.round(rows.reduce((sum, s) => sum + (s.durationSec ?? 0), 0) / 60),
        averageRpe: average(done.flatMap((s) => (s.rpe === null ? [] : [s.rpe]))),
      },
      weeks,
      phases,
      exercises,
    });
  });

  return r;
}
