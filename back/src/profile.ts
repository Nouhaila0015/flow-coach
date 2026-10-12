import { Router } from 'express';
import type { Db } from './db.js';
import { badRequest } from './http.js';

export const GOALS = ['force', 'endurance', 'perte_poids', 'muscle', 'bien_etre'] as const;
export const LEVELS = ['debutante', 'intermediaire', 'avancee'] as const;
export const EQUIPMENT = ['dumbbells', 'band', 'mat', 'gym'] as const;

export type Goal = (typeof GOALS)[number];
export type Level = (typeof LEVELS)[number];
export type Equipment = (typeof EQUIPMENT)[number];

export interface Profile {
  goal: Goal;
  level: Level;
  equipment: Equipment[];
  weeklyTarget: number;
  periodLength: number;
  onboarded: boolean;
}

/** Niveau numérique (1 à 3) utilisé pour filtrer les exercices. */
export function levelNumber(level: Level): number {
  return LEVELS.indexOf(level) + 1;
}

interface ProfileRow {
  goal: Goal;
  level: Level;
  equipment: string;
  weekly_target: number;
  period_length: number;
  onboarded: number;
}

export function getProfile(db: Db): Profile | null {
  const row = db.prepare('SELECT * FROM profile WHERE id = 1').get() as ProfileRow | undefined;
  if (!row) return null;
  return {
    goal: row.goal,
    level: row.level,
    equipment: JSON.parse(row.equipment),
    weeklyTarget: row.weekly_target,
    periodLength: row.period_length,
    onboarded: row.onboarded === 1,
  };
}

const isInt = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

function validate(body: Record<string, unknown>): Omit<Profile, 'onboarded'> {
  const { goal, level, equipment, weeklyTarget, periodLength } = body;
  if (!GOALS.includes(goal as Goal)) throw badRequest('Objectif invalide');
  if (!LEVELS.includes(level as Level)) throw badRequest('Niveau invalide');
  if (!Array.isArray(equipment) || !equipment.every((e) => EQUIPMENT.includes(e))) {
    throw badRequest('Matériel invalide');
  }
  if (!isInt(weeklyTarget, 1, 7)) throw badRequest('Séances par semaine : entre 1 et 7');
  if (!isInt(periodLength, 2, 10)) throw badRequest('Durée des règles : entre 2 et 10 jours');
  return {
    goal: goal as Goal,
    level: level as Level,
    equipment: [...new Set(equipment as Equipment[])],
    weeklyTarget,
    periodLength,
  };
}

export function profileRouter(db: Db) {
  const r = Router();

  r.get('/profile', (_req, res) => {
    res.json(getProfile(db));
  });

  r.put('/profile', (req, res) => {
    const p = validate(req.body ?? {});
    db.prepare(
      `INSERT INTO profile (id, goal, level, equipment, weekly_target, period_length)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET goal = excluded.goal, level = excluded.level,
         equipment = excluded.equipment, weekly_target = excluded.weekly_target,
         period_length = excluded.period_length`,
    ).run(p.goal, p.level, JSON.stringify(p.equipment), p.weeklyTarget, p.periodLength);
    res.json(getProfile(db));
  });

  return r;
}
