// Formatage des dates « calendrier » (YYYY-MM-DD) en français.

function parse(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

/** « 25 sept. 2026 » */
export function formatDate(iso: string): string {
  return parse(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** « lun. 12 oct. » */
export function formatShortDate(iso: string): string {
  return parse(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** « Lundi 12 octobre » */
export function formatLongDate(iso: string): string {
  const s = parse(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** « 1 min 30 », « 45 s », « 12 min » */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`
}

/** « 07:42 » */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
