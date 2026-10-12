import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Db } from './db.js';
import { exercisesRouter, seedExercises } from './exercises.js';
import { guidedRouter } from './guided.js';
import { historyRouter } from './history.js';
import { HttpError } from './http.js';
import { periodsRouter } from './periods.js';
import { profileRouter } from './profile.js';
import { statsRouter } from './stats.js';
import { sessionsRouter } from './sessions.js';

export function createApp(db: Db, frontDir?: string) {
  seedExercises(db);
  const app = express();
  app.use(express.json());

  const api = express.Router();
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.use(profileRouter(db));
  api.use(periodsRouter(db));
  api.use(exercisesRouter(db));
  api.use(sessionsRouter(db));
  api.use(guidedRouter(db));
  api.use(historyRouter(db));
  api.use(statsRouter(db));
  app.use('/api', api);
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Route inconnue' });
  });

  // Front buildé : fichiers statiques, et index.html pour toutes les autres URL.
  if (frontDir && existsSync(join(frontDir, 'index.html'))) {
    app.use(express.static(frontDir));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(join(frontDir, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, ...err.extra });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ error: 'JSON invalide' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Erreur interne' });
  });

  return app;
}
