import { useEffect, useState } from 'react'
import { api } from '../api'
import { PeriodButton } from '../components/PeriodButton'
import { PhaseBadge } from '../components/PhaseBadge'
import { TypeTag } from '../components/TypeTag'
import { formatDuration, formatLongDate, formatShortDate } from '../format'
import { navigate } from '../router'
import {
  INTENSITY_LABELS, PLACE_LABELS, TYPE_LABELS,
  type Desire, type Place, type Session, type SessionType, type TodayResponse,
} from '../types'

const ENERGY = [
  { value: 1, emoji: '😴', label: 'très basse' },
  { value: 2, emoji: '🥱', label: 'basse' },
  { value: 3, emoji: '🙂', label: 'correcte' },
  { value: 4, emoji: '😊', label: 'bonne' },
  { value: 5, emoji: '⚡', label: 'au top' },
]
const MINUTES = [10, 20, 30, 45, 60]
const DESIRES: Desire[] = ['auto', 'renfo', 'cardio', 'doux', 'course']

export function TodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [pending, setPending] = useState<Session | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [minutes, setMinutes] = useState(30)
  const [place, setPlace] = useState<Place>('sans_materiel')
  const [desire, setDesire] = useState<Desire>('auto')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const today = await api<TodayResponse>('/today')
      setData(today)
      if (today.pending) {
        const s = await api<Session>(`/sessions/${today.pending.id}`)
        setPending(s)
        // « Modifier mon check-in » : le formulaire reprend le check-in de la séance du jour.
        setEnergy(s.checkin.energy)
        setMinutes(s.checkin.minutes)
        setPlace(today.places.includes(s.checkin.place) ? s.checkin.place : today.places[0])
        setDesire(s.checkin.desire)
      } else {
        setPending(null)
        if (today.lastCheckin) {
          setMinutes(today.lastCheckin.minutes)
          if (today.places.includes(today.lastCheckin.place)) setPlace(today.lastCheckin.place)
        }
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function chooseDesire(d: Desire) {
    setDesire(d)
    if (d === 'course') setPlace('exterieur') // la course se fait dehors
  }

  async function generate() {
    if (energy === null) return
    setBusy(true)
    setError('')
    try {
      const s = await api<Session>('/checkins', 'POST', { energy, minutes, place, desire })
      navigate(`/apercu/${s.id}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  if (!data) return error ? <div className="error">{error}</div> : null
  const energyLabel = ENERGY.find((e) => e.value === energy)?.label

  return (
    <>
      <div>
        <h1>Bonjour ☀️ Comment tu te sens aujourd'hui ?</h1>
        <div className="muted">{formatLongDate(data.today)}</div>
      </div>

      {pending && (
        <div className="toast row center between" style={{ background: '#f4f0fa', borderColor: 'var(--luteale)', color: 'var(--accent-dark)' }}>
          <span>
            {pending.status === 'in_progress'
              ? 'Ta séance du jour est en cours.'
              : 'Ta séance du jour est prête. Tu peux aussi modifier ton check-in ci-dessous : la séance non commencée sera remplacée.'}
          </span>
          <button className="btn small" onClick={() => navigate(pending.status === 'in_progress' ? `/seance/${pending.id}` : `/apercu/${pending.id}`)}>
            {pending.status === 'in_progress' ? 'Reprendre' : 'Voir la séance'} →
          </button>
        </div>
      )}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card col" style={{ flex: 2.2 }}>
          <div>
            <span className="label">Énergie</span>
            <div className="chips">
              {ENERGY.map((e) => (
                <button
                  key={e.value}
                  title={`${e.value}/5 — ${e.label}`}
                  aria-label={`Énergie ${e.value} sur 5`}
                  className={`pill${energy === e.value ? ' selected' : ''}`}
                  style={{ fontSize: 24, width: 56, height: 56, justifyContent: 'center', padding: 0 }}
                  onClick={() => setEnergy(e.value)}
                >
                  {e.emoji}
                </button>
              ))}
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>{energy ? `${energy} / 5 — ${energyLabel}` : 'Choisis ton niveau du jour'}</div>
          </div>
          <div>
            <span className="label">Temps disponible</span>
            <div className="chips">
              {MINUTES.map((m) => (
                <button key={m} className={`pill${minutes === m ? ' selected' : ''}`} onClick={() => setMinutes(m)}>{m} min</button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Lieu & matériel</span>
            <div className="chips">
              {data.places.map((p) => (
                <button key={p} className={`pill${place === p ? ' selected' : ''}`} onClick={() => setPlace(p)}>{PLACE_LABELS[p]}</button>
              ))}
            </div>
            {data.places.length < 4 && <div className="note" style={{ marginTop: 6 }}>Les lieux proposés dépendent du matériel coché dans ton profil.</div>}
          </div>
          <div>
            <span className="label">
              Phase du cycle <span className="small muted" style={{ fontWeight: 600 }}>(calculée à partir de tes règles notées)</span>
            </span>
            {data.cycle
              ? <span className="row center" style={{ gap: 10 }}><PhaseBadge phase={data.cycle.phase} day={data.cycle.day} /><span className="note">lecture seule</span></span>
              : <span className="error">Note au moins 2 débuts de règles dans la page Cycle.</span>}
          </div>
          <div>
            <span className="label">Envie du jour</span>
            <div className="chips">
              {DESIRES.map((d) => (
                <button key={d} className={`pill${desire === d ? ' selected' : ''}`} onClick={() => chooseDesire(d)}>
                  {d === 'auto' ? '✨ Laisse le coach décider' : TYPE_LABELS[d as SessionType]}
                </button>
              ))}
            </div>
          </div>
          <div className="row center">
            <button className="btn" disabled={energy === null || !data.cycle || busy} onClick={generate}>
              {busy ? 'Génération…' : 'Générer ma séance →'}
            </button>
            {energy === null && <span className="note">Indique ton énergie pour continuer.</span>}
            {error && <span className="error">{error}</span>}
          </div>
        </div>

        <div className="col grow">
          <div className="card" style={{ background: '#fbeff1' }}>
            <h3>Mon cycle</h3>
            {data.cycle && (
              <div className="small muted" style={{ marginBottom: 10 }}>
                Dernières règles : {formatShortDate(data.cycle.lastStart)} (J{data.cycle.day})
              </div>
            )}
            <PeriodButton onSaved={() => load()} />
            <div className="note" style={{ marginTop: 6 }}>Date du jour par défaut, modifiable.</div>
          </div>
          <div className="card">
            <h3>Ma semaine</h3>
            <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--accent-dark)' }}>{data.week.done} / {data.week.target}</div>
            <div className="bar"><i style={{ width: `${Math.min(100, (data.week.done / data.week.target) * 100)}%` }} /></div>
            <div className="small muted" style={{ marginTop: 8 }}>
              {data.week.done >= data.week.target
                ? 'Objectif de la semaine atteint 🎉'
                : `Encore ${data.week.target - data.week.done} séance${data.week.target - data.week.done > 1 ? 's' : ''} pour atteindre ton objectif.`}
            </div>
          </div>
          <div className="card">
            <h3>Dernière séance</h3>
            {data.lastSession ? (
              <>
                <div className="row center" style={{ gap: 8 }}>
                  <TypeTag type={data.lastSession.type} /> {formatShortDate(data.lastSession.date)}
                </div>
                <div className="small muted" style={{ marginTop: 8 }}>
                  {data.lastSession.durationSec ? `${formatDuration(data.lastSession.durationSec)} · ` : ''}
                  intensité {INTENSITY_LABELS[data.lastSession.intensity]}
                  {data.lastSession.rpe ? ` · RPE ${data.lastSession.rpe}` : ''}
                </div>
              </>
            ) : <div className="small muted">Aucune séance pour l'instant.</div>}
          </div>
        </div>
      </div>
    </>
  )
}
