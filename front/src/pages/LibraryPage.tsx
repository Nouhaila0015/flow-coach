import { useEffect, useState } from 'react'
import { api } from '../api'
import { Figure } from '../components/Figure'
import { TypeTag } from '../components/TypeTag'
import { formatDate, formatDuration } from '../format'
import { motionFor } from '../figures/poses'
import {
  EXERCISE_EQUIPMENT_LABELS, TYPE_LABELS, ZONE_LABELS,
  type Exercise, type ExerciseDetail, type ExerciseEquipment, type SessionType,
} from '../types'

const LEVELS = ['', 'niveau 1', 'niveau 2', 'niveau 3']

export function LibraryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [type, setType] = useState<SessionType | 'all'>('all')
  const [equipment, setEquipment] = useState<ExerciseEquipment | 'all'>('all')
  const [selected, setSelected] = useState<ExerciseDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Exercise[]>('/exercises')
      .then((list) => {
        setExercises(list)
        if (list[0]) open(list[0].id)
      })
      .catch((e) => setError(e.message))
  }, [])

  function open(id: string) {
    api<ExerciseDetail>(`/exercises/${id}`).then(setSelected).catch((e) => setError(e.message))
  }

  const visible = exercises.filter((e) => (type === 'all' || e.type === type) && (equipment === 'all' || e.equipment === equipment))
  const name = (id: string | null) => exercises.find((e) => e.id === id)?.name ?? '—'

  return (
    <>
      <div className="page-head">
        <h1>Bibliothèque <span className="small muted">{exercises.length} exercices</span></h1>
        <div className="chips">
          {(['all', 'renfo', 'cardio', 'doux', 'course'] as const).map((t) => (
            <button key={t} className={`pill${type === t ? ' selected' : ''}`} onClick={() => setType(t)}>
              {t === 'all' ? 'Tous' : TYPE_LABELS[t]}
            </button>
          ))}
          <select className="field" value={equipment} onChange={(e) => setEquipment(e.target.value as ExerciseEquipment | 'all')}>
            <option value="all">Tout matériel</option>
            {(Object.keys(EXERCISE_EQUIPMENT_LABELS) as ExerciseEquipment[]).map((k) => (
              <option key={k} value={k}>{EXERCISE_EQUIPMENT_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {visible.map((e) => (
            <button
              key={e.id}
              className="card"
              onClick={() => open(e.id)}
              style={{
                padding: 12, cursor: 'pointer', border: 'none', textAlign: 'left',
                outline: selected?.id === e.id ? '2.5px solid var(--accent)' : 'none',
              }}
            >
              <div style={{ background: '#f7f3f9', borderRadius: 10, marginBottom: 8 }}>
                <Figure exerciseId={e.id} type={e.type} size="100%" />
              </div>
              <div style={{ fontWeight: 800 }}>{e.name}</div>
              <div className="row center" style={{ gap: 6, marginTop: 4 }}>
                <TypeTag type={e.type} />
                <span className="tiny muted">{EXERCISE_EQUIPMENT_LABELS[e.equipment]}</span>
              </div>
            </button>
          ))}
          {visible.length === 0 && <div className="empty">Aucun exercice pour ces filtres.</div>}
        </div>

        {selected && (
          <div className="card col grow" style={{ position: 'sticky', top: 20 }}>
            <div style={{ background: '#f7f3f9', borderRadius: 14, position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <Figure exerciseId={selected.id} type={selected.type} animated size={240} />
              <span className="tag" style={{ position: 'absolute', top: 10, right: 10, background: '#fff' }}>▶ animée</span>
            </div>
            <div className="row center small" style={{ gap: 8 }}>
              <span className="muted">Poses clés :</span>
              {motionFor(selected.id).poses.map((_, i) => (
                <div key={i} style={{ background: '#f7f3f9', borderRadius: 8 }}>
                  <Figure exerciseId={selected.id} type={selected.type} pose={i} size={46} />
                </div>
              ))}
            </div>
            <h2>{selected.name}</h2>
            <div className="small row center wrap" style={{ gap: 6 }}>
              <TypeTag type={selected.type} />
              {ZONE_LABELS[selected.zone]} · {EXERCISE_EQUIPMENT_LABELS[selected.equipment]} · {LEVELS[selected.level]} ·
              impact {selected.impact} · {selected.mode === 'reps' ? 'répétitions' : 'durée'}
              {selected.perSide && ' (par côté)'}
              {selected.matAdvised && ' · tapis conseillé'}
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
              {selected.cues.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <div className="small">
              <b>Variante plus facile :</b> {name(selected.easier)} · <b>plus difficile :</b> {name(selected.harder)}
            </div>
            <div className="small muted">
              Cibles de départ : {selected.defaults.map((d) => (selected.mode === 'reps' ? `${d} rép.` : formatDuration(d))).join(' / ')}
              {selected.defaultLoads && ` · ${selected.defaultLoads.map((l) => `${l} kg`).join(' / ')}`} (niveaux 1 / 2 / 3)
            </div>
            <div className="toast" style={{ background: '#f4f0fa', borderColor: 'var(--luteale)', color: 'var(--accent-dark)' }}>
              🏅 Meilleure perf : {selected.best ? bestLabel(selected.best) : 'pas encore réalisée'}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function bestLabel(b: NonNullable<ExerciseDetail['best']>): string {
  const what = b.reps != null ? `${b.reps} rép.` : b.duration != null ? formatDuration(b.duration) : ''
  return `${what}${b.load ? ` × ${b.load} kg` : ''} (${formatDate(b.date)})`
}
