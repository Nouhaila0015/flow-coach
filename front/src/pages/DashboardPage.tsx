import { useEffect, useState } from 'react'
import { api } from '../api'
import { PhaseChart, ProgressChart, RegularityChart, VolumeChart } from '../components/Charts'
import { navigate } from '../router'
import type { Stats, StatsPeriod } from '../types'

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: '4w', label: '4 semaines' },
  { value: '12w', label: '12 semaines' },
  { value: 'all', label: 'Tout' },
]
type Metric = 'main' | 'load'

/** Tableau de bord : indicateurs et graphiques sur la période choisie. */
export function DashboardPage() {
  const [period, setPeriod] = useState<StatsPeriod>('4w')
  const [stats, setStats] = useState<Stats | null>(null)
  const [exerciseId, setExerciseId] = useState('')
  const [metric, setMetric] = useState<Metric>('main')
  const [error, setError] = useState('')

  useEffect(() => {
    api<Stats>(`/stats?period=${period}`).then(setStats).catch((e) => setError(e.message))
  }, [period])

  if (!stats) return error ? <div className="error">{error}</div> : null
  const { kpis } = stats
  const exercise = stats.exercises.find((e) => e.id === exerciseId) ?? stats.exercises[0]
  const hasLoad = exercise?.points.some((p) => p.load) ?? false
  const shown: Metric = hasLoad ? metric : 'main'
  const unit = shown === 'load' ? 'kg' : exercise?.mode === 'reps' ? 'rép.' : 's'
  const points = (exercise?.points ?? []).flatMap((p) => {
    const value = shown === 'load' ? p.load : exercise.mode === 'reps' ? p.reps : p.duration
    return value === null ? [] : [{ date: p.date, value }]
  })
  const empty = kpis.sessions === 0 && kpis.totalMinutes === 0

  return (
    <>
      <div className="page-head">
        <h1>Tableau de bord</h1>
        <div className="chips">
          {PERIODS.map((p) => (
            <button key={p.value} className={`pill${period === p.value ? ' selected' : ''}`} onClick={() => setPeriod(p.value)}>{p.label}</button>
          ))}
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="row">
        <div className="card kpi"><b>{kpis.weekDone} / {kpis.weekTarget}</b>séances cette semaine</div>
        <div className="card kpi"><b>{kpis.streak}</b>semaine{kpis.streak > 1 ? 's' : ''} d'affilée à l'objectif</div>
        <div className="card kpi"><b>{kpis.totalMinutes} min</b>au total sur la période</div>
        <div className="card kpi"><b>{kpis.averageRpe !== null ? String(kpis.averageRpe).replace('.', ',') : '—'}</b>RPE moyen</div>
      </div>

      {empty ? (
        <div className="card empty">
          Pas encore de séance sur cette période.
          <div style={{ marginTop: 14 }}><button className="btn" onClick={() => navigate('/')}>Faire mon check-in</button></div>
        </div>
      ) : (
        <>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <div className="card grow">
              <h3>Régularité <span className="small muted" style={{ fontWeight: 600 }}>— séances terminées par semaine</span></h3>
              <RegularityChart weeks={stats.weeks} target={kpis.weekTarget} />
            </div>
            <div className="card grow">
              <h3>Volume <span className="small muted" style={{ fontWeight: 600 }}>— minutes par semaine</span></h3>
              <VolumeChart weeks={stats.weeks} />
            </div>
          </div>
          <div className="row" style={{ alignItems: 'stretch' }}>
            <div className="card grow">
              <h3>Énergie et RPE moyens par phase</h3>
              <PhaseChart phases={stats.phases} />
            </div>
            <div className="card grow">
              <div className="row center between" style={{ marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>Progression</h3>
                {exercise && (
                  <div className="row center" style={{ gap: 8 }}>
                    {hasLoad && (
                      <select className="field" value={shown} onChange={(e) => setMetric(e.target.value as Metric)} aria-label="Mesure">
                        <option value="main">{exercise.mode === 'reps' ? 'Répétitions' : 'Durée'}</option>
                        <option value="load">Charge</option>
                      </select>
                    )}
                    <select className="field" value={exercise.id} onChange={(e) => setExerciseId(e.target.value)} aria-label="Exercice">
                      {stats.exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {exercise && points.length > 0 ? (
                <>
                  <ProgressChart points={points} unit={unit} label={`Progression : ${exercise.name}`} />
                  <div className="small muted" style={{ marginTop: 6 }}>
                    Meilleure performance de chaque séance ({points.length} séance{points.length > 1 ? 's' : ''}).
                  </div>
                </>
              ) : (
                <div className="empty">Aucun exercice réalisé sur cette période.</div>
              )}
            </div>
          </div>
          <div className="note">L'objectif et la régularité comptent les séances terminées ; les minutes incluent aussi les séances interrompues.</div>
        </>
      )}
    </>
  )
}
