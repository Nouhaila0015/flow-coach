export type Goal = 'force' | 'endurance' | 'perte_poids' | 'muscle' | 'bien_etre'
export type Level = 'debutante' | 'intermediaire' | 'avancee'
export type Equipment = 'dumbbells' | 'band' | 'mat' | 'gym'
export type Phase = 'menstruelle' | 'folliculaire' | 'ovulatoire' | 'luteale'

export interface Profile {
  goal: Goal
  level: Level
  equipment: Equipment[]
  weeklyTarget: number
  periodLength: number
  onboarded: boolean
}

export interface PhaseRange {
  phase: Phase
  from: number
  to: number | null
}

export interface CycleInfo {
  lastStart: string
  day: number
  phase: Phase
  averageLength: number
  shortest: number
  longest: number
  cycleCount: number
  ovulationDay: number
  ranges: PhaseRange[]
}

export interface Period {
  id: number
  startDate: string
  cycleLength: number | null
}

export interface PeriodsResponse {
  periods: Period[]
  cycle: CycleInfo | null
  today: string
}

export const GOAL_LABELS: Record<Goal, string> = {
  force: 'Force',
  endurance: 'Endurance',
  perte_poids: 'Perte de poids',
  muscle: 'Prise de poids / muscle',
  bien_etre: 'Bien-être',
}

export const LEVEL_LABELS: Record<Level, string> = {
  debutante: 'Débutante',
  intermediaire: 'Intermédiaire',
  avancee: 'Avancée',
}

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  dumbbells: 'Haltères',
  band: 'Élastiques',
  mat: 'Tapis',
  gym: 'Accès à une salle',
}

export const PHASE_LABELS: Record<Phase, string> = {
  menstruelle: 'Menstruelle',
  folliculaire: 'Folliculaire',
  ovulatoire: 'Ovulatoire',
  luteale: 'Lutéale',
}

export const PHASE_COLORS: Record<Phase, string> = {
  menstruelle: 'var(--menstruelle)',
  folliculaire: 'var(--folliculaire)',
  ovulatoire: 'var(--ovulatoire)',
  luteale: 'var(--luteale)',
}
