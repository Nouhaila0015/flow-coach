import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Db = DatabaseSync;

// Chaque entrée est une migration ; user_version indique la dernière appliquée.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    goal TEXT NOT NULL,
    level TEXT NOT NULL,
    equipment TEXT NOT NULL,
    weekly_target INTEGER NOT NULL,
    period_length INTEGER NOT NULL,
    onboarded INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE periods (
    id INTEGER PRIMARY KEY,
    start_date TEXT NOT NULL UNIQUE
  );
  CREATE TABLE checkins (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    energy INTEGER NOT NULL,
    minutes INTEGER NOT NULL,
    place TEXT NOT NULL,
    desire TEXT NOT NULL,
    phase TEXT NOT NULL,
    cycle_day INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    checkin_id INTEGER NOT NULL REFERENCES checkins(id),
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    intensity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned',
    variant INTEGER NOT NULL DEFAULT 0,
    explanation TEXT NOT NULL,
    advice TEXT,
    adjust_level INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    ended_at TEXT,
    duration_sec INTEGER,
    rpe INTEGER,
    comment TEXT
  );
  CREATE TABLE session_items (
    id INTEGER PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    block TEXT NOT NULL,
    round INTEGER NOT NULL,
    exercise_id TEXT NOT NULL,
    note TEXT,
    target_reps INTEGER,
    target_duration INTEGER,
    target_load REAL,
    rest_sec INTEGER NOT NULL,
    done_reps INTEGER,
    done_duration INTEGER,
    done_load REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    feedback TEXT
  );
  CREATE TABLE exercise_progress (
    exercise_id TEXT PRIMARY KEY,
    reps INTEGER,
    duration INTEGER,
    load REAL,
    updated_at TEXT NOT NULL
  );
  `,
  `
  CREATE TABLE exercises (
    id TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    equipment TEXT NOT NULL,
    level INTEGER NOT NULL,
    impact TEXT NOT NULL,
    zone TEXT NOT NULL,
    mode TEXT NOT NULL,
    per_side INTEGER NOT NULL,
    defaults TEXT NOT NULL,
    default_loads TEXT,
    cues TEXT NOT NULL,
    easier TEXT,
    harder TEXT,
    mat_advised INTEGER NOT NULL
  );
  `,
];

export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let i = version; i < MIGRATIONS.length; i++) {
    db.exec('BEGIN');
    db.exec(MIGRATIONS[i]);
    db.exec(`PRAGMA user_version = ${i + 1}`);
    db.exec('COMMIT');
  }
  return db;
}

/** Exécute fn dans une transaction (annulée si fn lève une erreur). */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
