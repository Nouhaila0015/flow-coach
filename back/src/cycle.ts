import { daysBetween } from './dates.js';

export const PHASES = ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale'] as const;
export type Phase = (typeof PHASES)[number];

/** Nombre maximal de cycles récents pris en compte dans la moyenne. */
const MAX_CYCLES_IN_AVERAGE = 6;

export interface PhaseRange {
  phase: Phase;
  from: number; // jour du cycle (J1 = début des règles)
  to: number | null; // null : jusqu'aux prochaines règles notées
}

export interface CycleInfo {
  lastStart: string;
  day: number; // jour du cycle aujourd'hui
  phase: Phase;
  averageLength: number;
  shortest: number;
  longest: number;
  cycleCount: number; // nombre de cycles complets notés
  ovulationDay: number;
  ranges: PhaseRange[];
}

/** Longueurs (en jours) des cycles complets, du plus ancien au plus récent. */
export function cycleLengths(starts: string[]): number[] {
  const sorted = [...starts].sort();
  return sorted.slice(1).map((d, i) => daysBetween(sorted[i], d));
}

/** Découpage du cycle en phases, à partir de la durée moyenne et de la durée des règles. */
export function phaseRanges(averageLength: number, periodLength: number): PhaseRange[] {
  const o = averageLength - 14;
  const ranges: PhaseRange[] = [{ phase: 'menstruelle', from: 1, to: periodLength }];
  // Les règles sont prioritaires : les phases suivantes commencent au plus tôt après elles.
  const follFrom = periodLength + 1;
  if (o - 2 >= follFrom) ranges.push({ phase: 'folliculaire', from: follFrom, to: o - 2 });
  const ovuFrom = Math.max(o - 1, follFrom);
  if (o + 1 >= ovuFrom) ranges.push({ phase: 'ovulatoire', from: ovuFrom, to: o + 1 });
  ranges.push({ phase: 'luteale', from: Math.max(o + 2, follFrom), to: null });
  return ranges;
}

export function phaseForDay(day: number, ranges: PhaseRange[]): Phase {
  for (const r of ranges) if (day >= r.from && (r.to === null || day <= r.to)) return r.phase;
  return 'luteale';
}

/**
 * Phase du jour, calculée uniquement à partir des débuts de règles notés.
 * Rien n'est prédit : au-delà de la durée moyenne, on reste en phase lutéale.
 * Renvoie null s'il manque des données (moins de 2 débuts notés, ou dernier début dans le futur).
 */
export function computeCycle(starts: string[], periodLength: number, todayDate: string): CycleInfo | null {
  const past = starts.filter((d) => d <= todayDate).sort();
  if (past.length < 2) return null;
  const lengths = cycleLengths(past);
  const recent = lengths.slice(-MAX_CYCLES_IN_AVERAGE);
  const averageLength = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  const lastStart = past[past.length - 1];
  const day = daysBetween(lastStart, todayDate) + 1;
  const ranges = phaseRanges(averageLength, periodLength);
  return {
    lastStart,
    day,
    phase: phaseForDay(day, ranges),
    averageLength,
    shortest: Math.min(...lengths),
    longest: Math.max(...lengths),
    cycleCount: lengths.length,
    ovulationDay: averageLength - 14,
    ranges,
  };
}
