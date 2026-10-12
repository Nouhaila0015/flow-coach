import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { openDb } from './db.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 4200);
const dbFile = process.env.FLOW_COACH_DB ?? join(root, 'data', 'flow-coach.db');
const frontDir = join(root, '..', 'front', 'dist');

createApp(openDb(dbFile), frontDir).listen(port, '127.0.0.1', () => {
  console.log(`Flow Coach disponible sur http://localhost:${port}`);
});
