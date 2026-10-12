import { Router } from 'express';
import { PHASES, type Phase } from './cycle.js';
import { transaction, type Db } from './db.js';
import type { SessionType } from './exercises.js';
import { badRequest } from './http.js';
import { getSessionRow } from './sessions.js';

const TYPES: SessionType[] = ['renfo', 'cardio', 'doux', 'course'];

export function historyRouter(db: Db) {
  const r = Router();

  // Séances terminées ou interrompues, de la plus récente à la plus ancienne (filtres : type, phase).
  r.get('/sessions', (req, res) => {
    const { type, phase } = req.query;
    if (type !== undefined && !TYPES.includes(type as SessionType)) throw badRequest('Type de séance invalide');
    if (phase !== undefined && !PHASES.includes(phase as Phase)) throw badRequest('Phase invalide');
    const where = [`s.status IN ('done', 'interrupted')`];
    const params: string[] = [];
    if (type) { where.push('s.type = ?'); params.push(type as string); }
    if (phase) { where.push('c.phase = ?'); params.push(phase as string); }
    const rows = db
      .prepare(
        `SELECT s.id, s.date, s.type, s.intensity, s.status, s.duration_sec AS durationSec, s.rpe,
                c.phase, c.cycle_day AS cycleDay, c.energy
         FROM sessions s JOIN checkins c ON c.id = s.checkin_id
         WHERE ${where.join(' AND ')}
         ORDER BY s.date DESC, s.id DESC`,
      )
      .all(...params);
    res.json(rows);
  });

  // Supprime une séance et son check-in (les cibles de progression déjà calculées sont conservées).
  r.delete('/sessions/:id', (req, res) => {
    const s = getSessionRow(db, Number(req.params.id));
    transaction(db, () => {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id);
      db.prepare('DELETE FROM checkins WHERE id = ?').run(s.checkin_id);
    });
    res.status(204).end();
  });

  return r;
}
