// Dates « calendrier » au format YYYY-MM-DD, dans le fuseau local du PC.

const DAY_MS = 86_400_000;

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return toIsoDate(new Date());
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toIsoDate(parse(s)) === s;
}

function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // midi : évite les décalages liés à l'heure d'été
}

/** Nombre de jours de a vers b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / DAY_MS);
}

export function addDays(s: string, n: number): string {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/** Lundi de la semaine contenant la date. */
export function weekStart(s: string): string {
  const day = parse(s).getDay(); // 0 = dimanche
  return addDays(s, -((day + 6) % 7));
}
