import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { ConfirmDialog } from '../components/Dialog'
import { Figure } from '../components/Figure'
import { TypeTag } from '../components/TypeTag'
import { formatClock } from '../format'
import { navigate } from '../router'
import { targetLabel } from '../sessionText'
import { activeClockKey, ActiveClock, beep, useCountdown } from '../timer'
import { BLOCK_LABELS, ZONE_LABELS, type Session, type SessionItem } from '../types'

type Change = { name: string; before: string; after: string }
type AdjustResponse = { session: Session; message: string; changes: Change[] }

/** Séance guidée : un exercice à la fois, minuteur, ajustements en temps réel. */
export function GuidedPage({ id }: { id: number }) {
  const [session, setSession] = useState<Session | null>(null)
  const [phase, setPhase] = useState<'work' | 'rest'>('work')
  const [restTotal, setRestTotal] = useState(0)
  const [paused, setPaused] = useState(false)
  const [toast, setToast] = useState<{ message: string; changes: Change[] } | null>(null)
  const [reps, setReps] = useState('')
  const [load, setLoad] = useState('')
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [, setTick] = useState(0)
  const clock = useMemo(() => new ActiveClock(activeClockKey(id)), [id])
  const leaving = useRef(false) // vrai quand on part volontairement vers l'écran de fin

  const items = session?.items ?? []
  const index = items.findIndex((i) => i.status === 'pending')
  const current: SessionItem | undefined = items[index]

  const countdown = useCountdown(() => {
    beep()
    if (phase === 'work' && current) complete(current, { doneDuration: current.targetDuration })
    else goNext()
  })

  // Chargement ; une séance pas encore commencée l'est à l'ouverture.
  useEffect(() => {
    api<Session>(`/sessions/${id}`)
      .then(async (s) => {
        if (s.status === 'planned') s = await api<Session>(`/sessions/${id}/start`, 'POST')
        setSession(s)
      })
      .catch((e) => setError(e.message))
  }, [id])

  // Horloge active + rafraîchissement de l'affichage du temps écoulé.
  useEffect(() => {
    if (session?.status !== 'in_progress') return
    if (!paused) clock.start()
    const t = window.setInterval(() => { setTick((n) => n + 1); clock.save() }, 1000)
    return () => window.clearInterval(t)
  }, [session?.status, paused, clock])

  // Quitter la page (fermeture, rechargement, autre page de l'app) : séance interrompue.
  useEffect(() => {
    if (session?.status !== 'in_progress') return
    const interrupt = () => {
      if (leaving.current) return
      leaving.current = true
      const body = JSON.stringify({ status: 'interrupted', durationSec: clock.seconds() })
      navigator.sendBeacon(`/api/sessions/${id}/finish`, new Blob([body], { type: 'application/json' }))
    }
    window.addEventListener('beforeunload', interrupt)
    return () => {
      window.removeEventListener('beforeunload', interrupt)
      // Démontage parce qu'on a changé de page dans l'app (un écouteur hashchange serait retiré avant d'être appelé).
      const r = window.location.hash.replace(/^#/, '')
      if (r !== `/seance/${id}` && r !== `/fin/${id}`) interrupt()
    }
  }, [session?.status, id, clock])

  // Nouvel exercice : préremplit le réalisé et lance le compte à rebours des exercices en durée.
  useEffect(() => {
    if (!current || phase !== 'work') return
    setReps(current.targetReps !== null ? String(current.targetReps) : '')
    setLoad(current.targetLoad !== null ? String(current.targetLoad) : '')
    if (current.targetDuration !== null) {
      countdown.start(current.targetDuration)
      if (paused) countdown.pause()
    } else {
      countdown.stop()
    }
  }, [current?.id, phase])

  // Plus aucun exercice à faire : écran de fin.
  useEffect(() => {
    if (session?.status === 'in_progress' && index === -1) finish()
  }, [session, index])

  function finish() {
    leaving.current = true
    clock.pause()
    navigate(`/fin/${id}`)
  }

  function goNext() {
    setPhase('work')
    setToast((t) => (t ? { ...t, changes: [] } : t)) // le détail de la suite recalculée n'est montré qu'au repos suivant
  }

  async function complete(item: SessionItem, done: { doneReps?: number | null; doneDuration?: number | null; doneLoad?: number | null }) {
    setBusy(true)
    try {
      const s = await api<Session>(`/sessions/${id}/items/${item.id}`, 'PUT', done)
      setSession(s)
      const hasNext = s.items.some((i) => i.status === 'pending')
      if (item.restSec > 0 && hasNext) {
        setPhase('rest')
        setRestTotal(item.restSec)
        countdown.start(item.restSec)
        if (paused) countdown.pause()
      } else {
        setPhase('work')
      }
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  async function adjust(feedback: 'too_hard' | 'too_easy' | 'skip') {
    if (!current) return
    setBusy(true)
    try {
      const res = await api<AdjustResponse>(`/sessions/${id}/adjust`, 'POST', { itemId: current.id, feedback })
      setSession(res.session)
      if (feedback !== 'skip') setToast({ message: res.message, changes: res.changes })
      else countdown.stop()
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  function togglePause() {
    if (paused) {
      clock.start()
      countdown.resume()
    } else {
      clock.pause()
      countdown.pause()
    }
    setPaused(!paused)
  }

  if (!session) return error ? <div className="error">{error}</div> : null
  if (session.status === 'done' || session.status === 'interrupted') {
    return (
      <div className="card col">
        <div>Cette séance est {session.status === 'done' ? 'terminée' : 'interrompue'}.</div>
        <div><button className="btn" onClick={() => navigate(`/historique/${id}`)}>Voir dans l'historique</button></div>
      </div>
    )
  }
  if (!current) return null

  const position = index + 1
  const progress = items.filter((i) => i.status !== 'pending').length / items.length
  const roundInfo = current.block === 'main' && session.rounds > 1
    ? ` · ${isSeries(items) ? 'Série' : 'Tour'} ${current.round} / ${session.rounds}`
    : ` · ${BLOCK_LABELS[current.block]}`

  return (
    <>
      <div className="row center between">
        <div><b>Exercice {position} / {items.length}</b><span className="muted">{roundInfo}</span></div>
        <div className="muted">⏱ {formatClock(clock.seconds())} {paused ? '(en pause)' : 'écoulées'}</div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn soft" onClick={togglePause}>{paused ? '▶ Reprendre' : '⏸ Pause'}</button>
          <button className="btn ghost" onClick={() => setConfirmEnd(true)}>Terminer maintenant</button>
        </div>
      </div>
      <div className="bar"><i style={{ width: `${progress * 100}%` }} /></div>
      {toast && (
        <div className="toast row center between">
          <span>💜 {toast.message}</span>
          <button className="link-btn" onClick={() => setToast(null)}>✕</button>
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {phase === 'rest' ? (
        <RestView
          remaining={countdown.remaining}
          total={restTotal}
          next={current}
          paused={paused}
          changes={toast?.changes ?? []}
          onSkip={() => { countdown.stop(); goNext() }}
        />
      ) : (
        <div className="row" style={{ alignItems: 'stretch', minHeight: 440 }}>
          <div className="card grow col center" style={{ justifyContent: 'center', background: '#fcfafd' }}>
            <Figure exerciseId={current.exerciseId} type={current.exercise.type} animated paused={paused} size={340} />
          </div>
          <div className="card col" style={{ flex: 1.1 }}>
            <div>
              <TypeTag type={current.exercise.type}>{`${typeName(current)} · ${ZONE_LABELS[current.exercise.zone]}`}</TypeTag>
              <h1 style={{ marginTop: 10 }}>{current.exercise.name}</h1>
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--accent-dark)' }}>
              {current.targetReps !== null ? `${current.targetReps} répétitions` : formatClock(countdown.remaining)}
              {current.targetLoad ? <span style={{ fontSize: 18, color: 'var(--muted)' }}> · {current.targetLoad} kg</span> : null}
            </div>
            {current.note && <div className="small muted">{current.note}</div>}
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
              {current.exercise.cues.map((c) => <li key={c}>{c}</li>)}
            </ul>
            {current.targetReps !== null ? (
              <>
                <div className="row center" style={{ gap: 10 }}>
                  Réalisé :
                  <input className="field" type="number" min={0} style={{ width: 80 }} value={reps} onChange={(e) => setReps(e.target.value)} /> rép.
                  {current.targetLoad !== null && (
                    <>
                      <input className="field" type="number" min={0} step={0.5} style={{ width: 80 }} value={load} onChange={(e) => setLoad(e.target.value)} /> kg
                    </>
                  )}
                </div>
                <div>
                  <button className="btn" disabled={busy || reps === ''} onClick={() => complete(current, {
                    doneReps: Number(reps),
                    doneLoad: current.targetLoad !== null && load !== '' ? Number(load) : null,
                  })}>
                    ✓ Fait → repos
                  </button>
                </div>
              </>
            ) : (
              <div className="small muted">
                {countdown.running ? 'Bip doux à la fin du compte à rebours.' : paused ? 'Minuteur en pause.' : ''}
                {' '}<button className="link-btn" disabled={busy} onClick={() => complete(current, { doneDuration: current.targetDuration! - Math.round(countdown.remaining) })}>
                  Terminer cet exercice →
                </button>
              </div>
            )}
            <div className="row wrap" style={{ marginTop: 'auto', gap: 10 }}>
              <button className="btn soft" disabled={busy} onClick={() => adjust('too_hard')}>😣 Trop dur</button>
              <button className="btn soft" disabled={busy} onClick={() => adjust('too_easy')}>😎 Trop facile</button>
              <button className="btn soft" disabled={busy} onClick={() => adjust('skip')}>⏭ Passer</button>
            </div>
          </div>
        </div>
      )}

      {confirmEnd && (
        <ConfirmDialog
          title="Terminer la séance ?"
          message="Les exercices restants ne seront pas faits. Tu pourras ensuite indiquer ta difficulté ressentie."
          confirmLabel="Terminer"
          onConfirm={() => { setConfirmEnd(false); finish() }}
          onCancel={() => setConfirmEnd(false)}
        />
      )}
    </>
  )
}

function RestView({ remaining, total, next, paused, changes, onSkip }: {
  remaining: number
  total: number
  next: SessionItem
  paused: boolean
  changes: Change[]
  onSkip: () => void
}) {
  const ratio = total > 0 ? Math.min(1, remaining / total) : 0
  const circumference = 2 * Math.PI * 50
  return (
    <div className="row" style={{ alignItems: 'stretch', minHeight: 440 }}>
      <div className="card grow col center" style={{ justifyContent: 'center', background: '#f4f0fa' }}>
        <div className="muted" style={{ fontSize: 18 }}>Repos</div>
        <svg viewBox="0 0 120 120" width={240} height={240}>
          <circle cx={60} cy={60} r={50} fill="none" stroke="#e6e0ee" strokeWidth={10} />
          <circle
            cx={60} cy={60} r={50} fill="none" stroke="var(--accent)" strokeWidth={10} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - ratio)} transform="rotate(-90 60 60)"
          />
          <text x={60} y={70} textAnchor="middle" fontSize={28} fontWeight={800} fill="var(--accent-dark)">{formatClock(remaining)}</text>
        </svg>
        <div className="small muted">{paused ? 'En pause' : 'Bip doux à la fin du compte à rebours'}</div>
      </div>
      <div className="card col grow">
        <span className="muted">À suivre</span>
        <div className="row center" style={{ gap: 16 }}>
          <div style={{ background: '#f7f3f9', borderRadius: 14 }}>
            <Figure exerciseId={next.exerciseId} type={next.exercise.type} animated paused={paused} size={130} />
          </div>
          <div>
            <h2>{next.exercise.name}</h2>
            <div>{targetLabel(next)}</div>
          </div>
        </div>
        {changes.length > 0 && (
          <>
            <span className="label" style={{ marginTop: 8 }}>Suite recalculée</span>
            <table className="table">
              <thead><tr><th>Exercice</th><th>Avant</th><th>Après</th></tr></thead>
              <tbody>
                {changes.map((c) => <tr key={c.name}><td>{c.name}</td><td>{c.before}</td><td><b>{c.after}</b></td></tr>)}
              </tbody>
            </table>
          </>
        )}
        <div style={{ marginTop: 'auto' }}>
          <button className="btn" onClick={onSkip}>Passer le repos →</button>
        </div>
      </div>
    </div>
  )
}

function isSeries(items: SessionItem[]): boolean {
  const main = items.filter((i) => i.block === 'main')
  return main.length > 1 && main[0].exerciseId === main[1].exerciseId && main[0].exercise.type === 'renfo'
}

function typeName(i: SessionItem): string {
  return { renfo: 'Renfo', cardio: 'Cardio', doux: 'Doux', course: 'Course' }[i.exercise.type]
}

