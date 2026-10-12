import type { AddressInfo } from 'node:net';
import { createApp } from './app.js';
import { openDb } from './db.js';

/** Démarre l'API sur un port libre avec une base en mémoire ; renvoie un client JSON. */
export async function startTestServer() {
  const db = openDb(':memory:');
  const server = createApp(db).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  async function call(method: string, url: string, body?: unknown) {
    const res = await fetch(base + url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }
  return { db, call, close: () => server.close() };
}
