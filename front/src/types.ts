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

export type Intensity = 'basse' | 'moderee' | 'haute'
export type Place = 'sans_materiel' | 'avec_materiel' | 'salle' | 'exterieur'
export type Desire = 'auto' | SessionType
export type SessionStatus = 'planned' | 'in_progress' | 'done' | 'interrupted'
export type Block = 'warmup' | 'main' | 'cooldown'

export interface SessionItem {
  id: number
  position: number
  block: Block
  round: number
  exerciseId: string
  note: string | null
  targetReps: number | null
  targetDuration: number | null
  targetLoad: number | null
  restSec: number
  doneReps: number | null
  doneDuration: number | null
  doneLoad: number | null
  status: 'pending' | 'done' | 'skipped'
  feedback: 'too_hard' | 'too_easy' | null
  exercise: { name: string; type: SessionType; mode: 'reps' | 'time'; perSide: boolean; cues: string[]; zone: Exercise['zone'] }
}

export interface Checkin {
  energy: number
  minutes: number
  place: Place
  desire: Desire
  phase: Phase
  cycleDay: number
}

export interface Session {
  id: number
  date: string
  type: SessionType
  intensity: Intensity
  status: SessionStatus
  explanation: string
  advice: string | null
  offerDoux: boolean
  adjustLevel: number
  startedAt: string | null
  endedAt: string | null
  durationSec: number | null
  rpe: number | null
  comment: string | null
  estimatedSec: number
  rounds: number
  checkin: Checkin
  items: SessionItem[]
}

export interface TodayResponse {
  today: string
  cycle: CycleInfo | null
  week: { done: number; target: number }
  lastSession: { id: number; date: string; type: SessionType; intensity: Intensity; rpe: number | null; durationSec: number | null } | null
  pending: { id: number; status: SessionStatus } | null
  places: Place[]
  lastCheckin: { minutes: number; place: Place } | null
}

export const INTENSITY_LABELS: Record<Intensity, string> = { basse: 'basse', moderee: 'modérée', haute: 'haute' }

export const PLACE_LABELS: Record<Place, string> = {
  sans_materiel: 'Maison sans matériel',
  avec_materiel: 'Maison avec matériel',
  salle: 'Salle',
  exterieur: 'Extérieur',
}

export const BLOCK_LABELS: Record<Block, string> = { warmup: 'Échauffement', main: 'Corps de séance', cooldown: 'Retour au calme' }

/** Ligne de l'historique. */
export interface SessionSummary {
  id: number
  date: string
  type: SessionType
  intensity: Intensity
  status: 'done' | 'interrupted'
  durationSec: number | null
  rpe: number | null
  phase: Phase
  cycleDay: number
  energy: number
}

export const DESIRE_LABELS: Record<Desire, string> = {
  auto: 'le coach décide', renfo: 'renfo', cardio: 'cardio / HIIT', doux: 'doux', course: 'course',
}

export type StatsPeriod = '4w' | '12w' | 'all'

export interface ProgressPoint {
  sessionId: number
  date: string
  reps: number | null
  duration: number | null
  load: number | null
}

export interface Stats {
  period: StatsPeriod
  kpis: { weekDone: number; weekTarget: number; streak: number; sessions: number; totalMinutes: number; averageRpe: number | null }
  weeks: { start: string; sessions: number; minutes: Record<SessionType, number> }[]
  phases: { phase: Phase; sessions: number; energy: number | null; rpe: number | null }[]
  exercises: { id: string; name: string; mode: 'reps' | 'time'; points: ProgressPoint[] }[]
}
