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

export type SessionType = 'renfo' | 'cardio' | 'doux' | 'course'
export type ExerciseEquipment = 'none' | 'dumbbells' | 'band' | 'outdoor'

export interface Exercise {
  id: string
  name: string
  type: SessionType
  equipment: ExerciseEquipment
  level: 1 | 2 | 3
  impact: 'faible' | 'fort'
  zone: 'bas' | 'haut' | 'gainage' | 'corps'
  mode: 'reps' | 'time'
  perSide: boolean
  defaults: [number, number, number]
  defaultLoads: [number, number, number] | null
  cues: [string, string, string]
  easier: string | null
  harder: string | null
  matAdvised: boolean
}

export interface ExerciseDetail extends Exercise {
  best: { date: string; reps: number | null; duration: number | null; load: number | null } | null
}

export const TYPE_LABELS: Record<SessionType, string> = {
  renfo: 'Renfo',
  cardio: 'Cardio / HIIT',
  doux: 'Doux',
  course: 'Course',
}

export const TYPE_COLORS: Record<SessionType, string> = {
  renfo: 'var(--renfo)',
  cardio: 'var(--cardio)',
  doux: 'var(--doux)',
  course: 'var(--course)',
}

export const EXERCISE_EQUIPMENT_LABELS: Record<ExerciseEquipment, string> = {
  none: 'sans matériel',
  dumbbells: 'haltères',
  band: 'élastique',
  outdoor: 'extérieur',
}

export const ZONE_LABELS: Record<Exercise['zone'], string> = {
  bas: 'bas du corps',
  haut: 'haut du corps',
  gainage: 'gainage',
  corps: 'corps entier',
}
