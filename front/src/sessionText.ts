import { formatDuration } from './format'
import type { SessionItem } from './types'

/** « 12 rép. · 8 kg », « 40 s », « 10 rép. par côté » */
export function targetLabel(i: Pick<SessionItem, 'targetReps' | 'targetDuration' | 'targetLoad' | 'note'>): string {
  const parts = [i.targetReps !== null ? `${i.targetReps} rép.` : formatDuration(i.targetDuration ?? 0)]
  if (i.targetLoad) parts.push(`${i.targetLoad} kg`)
  let s = parts.join(' · ')
  if (i.note) s += ` · ${i.note}`
  return s
}

/** Réalisé d'un exercice, pour l'historique. */
export function doneLabel(i: SessionItem): string {
  if (i.status === 'skipped') return 'sauté'
  if (i.status === 'pending') return '—'
  const what = i.doneReps !== null ? `${i.doneReps} rép.` : i.doneDuration !== null ? formatDuration(i.doneDuration) : 'fait'
  return i.doneLoad ? `${what} · ${i.doneLoad} kg` : what
}

/** Regroupe les éléments consécutifs d'un même bloc. */
export function groupByBlock(items: SessionItem[]): { block: SessionItem['block']; items: SessionItem[] }[] {
  const groups: { block: SessionItem['block']; items: SessionItem[] }[] = []
  for (const i of items) {
    const last = groups[groups.length - 1]
    if (last?.block === i.block) last.items.push(i)
    else groups.push({ block: i.block, items: [i] })
  }
  return groups
}

export function blockSeconds(items: SessionItem[]): number {
  return items.reduce(
    (s, i) => s + (i.targetDuration ?? (i.targetReps ?? 0) * 3 * (i.exercise.perSide ? 2 : 1)) + i.restSec,
    0,
  )
}

/** Exercices distincts d'un bloc (le corps de séance répète les exercices à chaque tour). */
export function distinctExercises(items: SessionItem[]): SessionItem[] {
  const seen = new Set<string>()
  return items.filter((i) => (seen.has(i.exerciseId) ? false : (seen.add(i.exerciseId), true)))
}
