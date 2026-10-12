import { Router } from 'express';
import { transaction, type Db } from './db.js';
import { availableEquipment } from './engine.js';
import type { Exercise } from './exercises.js';
import { badRequest, HttpError, notFound } from './http.js';
import { levelNumber } from './profile.js';
import { adjustTargets, baseProgress, nextProgress, type ProgressChange } from './progression.js';
import { ADJUST, LOW_IMPACT_MAX_ENERGY, type Place } from './rules.js';
import { exerciseMap, getItems, getSessionRow, requireProfile, sessionDetail, type ItemRow } from './sessions.js';

const MAX_SESSION_SEC = 6 * 3600;

function getItem(db: Db, sessionId: number, itemId: number): ItemRow {
  const item = db.prepare('SELECT * FROM session_items WHERE id = ? AND session_id = ?').get(itemId, sessionId) as ItemRow | undefined;
  if (!item) throw notFound('Exercice introuvable dans cette séance');
  return item;
}

function requireInProgress(db: Db, id: number) {
  const s = getSessionRow(db, id);
  if (s.status !== 'in_progress') throw new HttpError(409, "La séance n'est pas en cours");
  return s;
}

const optionalNumber = (v: unknown, max: number, integer = true): number | null => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || v < 0 || v > max || (integer && !Number.isInteger(v))) throw badRequest('Valeur réalisée invalide');
  return v;
};

export function guidedRouter(db: Db) {
  const r = Router();

  // Enregistre le réalisé d'un exercice (répétitions, durée, charge).
  r.put('/sessions/:id/items/:itemId', (req, res) => {
    const s = requireInProgress(db, Number(req.params.id));
    const item = getItem(db, s.id, Number(req.params.itemId));
    const doneReps = optionalNumber(req.body?.doneReps, 1000);
    const doneDuration = optionalNumber(req.body?.doneDuration, 7200);
    const doneLoad = optionalNumber(req.body?.doneLoad, 500, false);
    db.prepare(`UPDATE session_items SET status = 'done', done_reps = ?, done_duration = ?, done_load = ? WHERE id = ?`)
      .run(doneReps, doneDuration, doneLoad, item.id);
    res.json(sessionDetail(db, s.id));
  });

  // « Trop dur », « Trop facile » ou « Passer » : la suite de la séance est recalculée ici.
  r.post('/sessions/:id/adjust', (req, res) => {
    const s = requireInProgress(db, Number(req.params.id));
    const item = getItem(db, s.id, Number(req.body?.itemId));
    const feedback = req.body?.feedback;
    if (!['too_hard', 'too_easy', 'skip'].includes(feedback)) throw badRequest('Retour invalide');

    if (feedback === 'skip') {
      db.prepare(`UPDATE session_items SET status = 'skipped' WHERE id = ?`).run(item.id);
      res.json({ session: sessionDetail(db, s.id), message: 'Exercice passé.', changes: [] });
      return;
    }

    const direction = feedback === 'too_hard' ? -1 : 1;
    const level = s.adjust_level + direction;
    if (Math.abs(level) > ADJUST.maxSteps) {
      db.prepare('UPDATE session_items SET feedback = ? WHERE id = ?').run(feedback, item.id);
      res.json({
        session: sessionDetail(db, s.id),
        message: direction < 0 ? 'La séance est déjà allégée au maximum.' : 'La séance est déjà renforcée au maximum.',
        changes: [],
      });
      return;
    }

    const profile = requireProfile(db);
    const checkin = db.prepare('SELECT * FROM checkins WHERE id = ?').get(s.checkin_id) as { place: Place; energy: number; phase: string };
    const equipment = availableEquipment(checkin.place, profile);
    const lowImpact = checkin.phase === 'menstruelle' && checkin.energy <= LOW_IMPACT_MAX_ENERGY;
    const exercises = exerciseMap(db);
    const lvl = levelNumber(profile.level);
    // Variante plus facile / plus difficile, si elle est faisable avec le matériel et au même format.
    const variantOf = (e: Exercise): Exercise | null => {
      const v = exercises.get((direction < 0 ? e.easier : e.harder) ?? '');
      if (!v || v.mode !== e.mode || !equipment.includes(v.equipment) || v.level > lvl || (lowImpact && v.impact === 'fort')) return null;
      return v;
    };

    const remaining = getItems(db, s.id).filter((i) => i.status === 'pending' && i.position > item.position && i.block !== 'cooldown');
    const changes: { name: string; before: string; after: string }[] = [];
    const describe = (reps: number | null, duration: number | null) =>
      reps !== null ? `${reps} rép.` : `${duration} s`;
    transaction(db, () => {
      db.prepare('UPDATE session_items SET feedback = ? WHERE id = ?').run(feedback, item.id);
      db.prepare('UPDATE sessions SET adjust_level = ? WHERE id = ?').run(level, s.id);
      const update = db.prepare('UPDATE session_items SET exercise_id = ?, target_reps = ?, target_duration = ?, target_load = ?, rest_sec = ? WHERE id = ?');
      const seen = new Set<string>();
      for (const i of remaining) {
        const e = exercises.get(i.exercise_id)!;
        const swap = variantOf(e);
        const t = adjustTargets({ targetReps: i.target_reps, targetDuration: i.target_duration, restSec: i.rest_sec }, direction);
        const target = swap ?? e;
        const load = target.defaultLoads ? (i.target_load ?? target.defaultLoads[lvl - 1]) : null;
        update.run(target.id, t.targetReps, t.targetDuration, load, t.restSec, i.id);
        if (!seen.has(i.exercise_id)) {
          seen.add(i.exercise_id);
          changes.push({
            name: swap ? `${e.name} → ${swap.name}` : e.name,
            before: describe(i.target_reps, i.target_duration),
            after: describe(t.targetReps, t.targetDuration),
          });
        }
      }
      // Repos affiché : celui du corps de séance s'il en reste, plus parlant que les transitions de l'échauffement.
      const rest = (remaining.find((i) => i.block === 'main') ?? remaining[0])?.rest_sec;
      if (rest !== undefined) {
        changes.push({ name: 'Repos', before: `${rest} s`, after: `${adjustTargets({ targetReps: null, targetDuration: null, restSec: rest }, direction).restSec} s` });
      }
    });
    const message = direction < 0
      ? `C'est noté, j'allège la suite : −20 % de répétitions, +15 s de repos. (ajustement −${-level})`
      : `C'est noté, je corse la suite : +15 % de répétitions, −10 s de repos. (ajustement +${level})`;
    res.json({ session: sessionDetail(db, s.id), message: remaining.length ? message : 'C\'est noté.', changes });
  });

  // Fin de séance : terminée (RPE obligatoire, progression appliquée) ou interrompue.
  r.post('/sessions/:id/finish', (req, res) => {
    const s = getSessionRow(db, Number(req.params.id));
    const status = req.body?.status;
    if (status !== 'done' && status !== 'interrupted') throw badRequest('Statut invalide');
    if (s.status === 'done' || s.status === 'interrupted') {
      if (status === 'interrupted') {
        res.json({ session: sessionDetail(db, s.id), progression: [] }); // déjà terminée : rien à faire
        return;
      }
      throw new HttpError(409, 'Cette séance est déjà terminée');
    }
    const rpe = req.body?.rpe;
    if (status === 'done' && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) throw badRequest('Indique ta difficulté ressentie (RPE de 1 à 10)');
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 1000) || null : null;
    const now = new Date();
    const fromClock = s.started_at ? Math.round((now.getTime() - Date.parse(s.started_at)) / 1000) : 0;
    const durationSec = optionalNumber(req.body?.durationSec, MAX_SESSION_SEC) ?? Math.min(fromClock, MAX_SESSION_SEC);

    const progression: (ProgressChange & { exerciseId: string; name: string })[] = [];
    transaction(db, () => {
      db.prepare(`UPDATE sessions SET status = ?, rpe = ?, comment = ?, ended_at = ?, duration_sec = ?, started_at = COALESCE(started_at, ?) WHERE id = ?`)
        .run(status, status === 'done' ? rpe : null, comment, now.toISOString(), durationSec, now.toISOString(), s.id);
      if (status !== 'done') return; // une séance interrompue ne fait pas progresser les cibles

      const profile = requireProfile(db);
      const exercises = exerciseMap(db);
      const main = getItems(db, s.id).filter((i) => i.block === 'main');
      const save = db.prepare(
        `INSERT INTO exercise_progress (exercise_id, reps, duration, load, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(exercise_id) DO UPDATE SET reps = excluded.reps, duration = excluded.duration, load = excluded.load, updated_at = excluded.updated_at`,
      );
      for (const id of [...new Set(main.map((i) => i.exercise_id))]) {
        const e = exercises.get(id)!;
        const current = db.prepare('SELECT reps, duration, load FROM exercise_progress WHERE exercise_id = ?').get(id) as
          { reps: number | null; duration: number | null; load: number | null } | undefined;
        const base = baseProgress(e, levelNumber(profile.level) - 1, current);
        const items = main.filter((i) => i.exercise_id === id).map((i) => ({
          status: i.status, feedback: i.feedback, targetReps: i.target_reps, targetDuration: i.target_duration,
          doneReps: i.done_reps, doneDuration: i.done_duration, doneLoad: i.done_load,
        }));
        const change = nextProgress(e, items, rpe, profile.goal, base, s.adjust_level < 0);
        if (items.some((i) => i.status === 'done')) {
          save.run(id, change.after.reps, change.after.duration, change.after.load, now.toISOString());
        }
        progression.push({ exerciseId: id, name: e.name, ...change });
      }
    });
    res.json({ session: sessionDetail(db, s.id), progression });
  });

  return r;
}
