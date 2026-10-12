import { Router } from 'express';
import { computeCycle, type CycleInfo } from './cycle.js';
import { daysBetween, frDate, isIsoDate, today } from './dates.js';
import { transaction, type Db } from './db.js';
import { badRequest, HttpError, notFound } from './http.js';
import { getProfile } from './profile.js';

/** En dessous de cet écart entre deux débuts de règles, on demande une confirmation. */
const MIN_GAP_DAYS = 15;
const INIT_COUNT = 3;

interface PeriodRow {
  id: number;
  start_date: string;
}

export function listPeriods(db: Db): PeriodRow[] {
  return db.prepare('SELECT id, start_date FROM periods ORDER BY start_date DESC').all() as unknown as PeriodRow[];
}

/** Phase et infos du cycle aujourd'hui (null si le profil ou les règles manquent). */
export function currentCycle(db: Db, date = today()): CycleInfo | null {
  const profile = getProfile(db);
  if (!profile) return null;
  return computeCycle(
    listPeriods(db).map((p) => p.start_date),
    profile.periodLength,
    date,
  );
}

function checkDate(db: Db, date: unknown, confirm: boolean, ignoreId?: number): string {
  if (!isIsoDate(date)) throw badRequest('Date invalide');
  if (date > today()) throw badRequest('La date ne peut pas être dans le futur');
  const others = listPeriods(db).filter((p) => p.id !== ignoreId);
  if (others.some((p) => p.start_date === date)) throw badRequest('Cette date est déjà notée');
  const close = others.find((p) => Math.abs(daysBetween(p.start_date, date)) < MIN_GAP_DAYS);
  if (close && !confirm) {
    throw new HttpError(409, `Moins de ${MIN_GAP_DAYS} jours d'écart avec les règles du ${frDate(close.start_date)}. Confirmer ?`, {
      needsConfirm: true,
    });
  }
  return date;
}

function periodsResponse(db: Db) {
  const rows = listPeriods(db);
  // Longueur du cycle qui suit chaque début (null pour le cycle en cours).
  const periods = rows.map((p, i) => ({
    id: p.id,
    startDate: p.start_date,
    cycleLength: i === 0 ? null : daysBetween(p.start_date, rows[i - 1].start_date),
  }));
  return { periods, cycle: currentCycle(db), today: today() };
}

export function periodsRouter(db: Db) {
  const r = Router();

  r.get('/periods', (_req, res) => {
    res.json(periodsResponse(db));
  });

  r.get('/cycle/today', (_req, res) => {
    res.json({ cycle: currentCycle(db), today: today() });
  });

  // Étape 2 du démarrage : les 3 derniers débuts de règles, puis fin de l'assistant.
  r.post('/periods/init', (req, res) => {
    if (!getProfile(db)) throw badRequest("Complète d'abord ton profil");
    const dates: unknown = req.body?.dates;
    if (!Array.isArray(dates) || dates.length !== INIT_COUNT) {
      throw badRequest(`Saisis le début de tes ${INIT_COUNT} dernières règles`);
    }
    if (!dates.every(isIsoDate)) throw badRequest('Date invalide');
    if (new Set(dates).size !== dates.length) throw badRequest('Deux dates sont identiques');
    if (dates.some((d) => d > today())) throw badRequest('La date ne peut pas être dans le futur');
    const sorted = [...dates].sort();
    const tooClose = sorted.slice(1).some((d, i) => daysBetween(sorted[i], d) < MIN_GAP_DAYS);
    if (tooClose && !req.body?.confirm) {
      throw new HttpError(409, `Deux débuts de règles ont moins de ${MIN_GAP_DAYS} jours d'écart. Confirmer ?`, {
        needsConfirm: true,
      });
    }
    transaction(db, () => {
      db.exec('DELETE FROM periods');
      const insert = db.prepare('INSERT INTO periods (start_date) VALUES (?)');
      for (const d of sorted) insert.run(d);
      db.exec('UPDATE profile SET onboarded = 1 WHERE id = 1');
    });
    res.json(periodsResponse(db));
  });

  r.post('/periods', (req, res) => {
    const date = checkDate(db, req.body?.startDate, req.body?.confirm === true);
    db.prepare('INSERT INTO periods (start_date) VALUES (?)').run(date);
    res.status(201).json(periodsResponse(db));
  });

  r.put('/periods/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM periods WHERE id = ?').get(id)) throw notFound();
    const date = checkDate(db, req.body?.startDate, req.body?.confirm === true, id);
    db.prepare('UPDATE periods SET start_date = ? WHERE id = ?').run(date, id);
    res.json(periodsResponse(db));
  });

  r.delete('/periods/:id', (req, res) => {
    const result = db.prepare('DELETE FROM periods WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) throw notFound();
    res.json(periodsResponse(db));
  });

  return r;
}
