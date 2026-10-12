import { useEffect, useState } from 'react'
import { api } from '../api'
import { Figure } from '../components/Figure'
import { PhaseBadge } from '../components/PhaseBadge'
import { TypeTag } from '../components/TypeTag'
import { formatDuration } from '../format'
import { navigate } from '../router'
import { blockSeconds, distinctExercises, groupByBlock, targetLabel } from '../sessionText'
import { BLOCK_LABELS, INTENSITY_LABELS, ZONE_LABELS, type Session, type SessionItem } from '../types'

/** Aperçu de la séance générée, avant de la commencer. */
export function PreviewPage({ id }: { id: number }) {
  const [session, setSession] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Session>(`/sessions/${id}`).then(setSession).catch((e) => setError(e.message))
  }, [id])

  async function regenerate(body?: { type: 'doux' }) {
    setBusy(true)
    try {
      setSession(await api<Session>(`/sessions/${id}/regenerate`, 'POST', body ?? {}))
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  if (!session) return error ? <div className="error">{error}</div> : null
  if (session.status !== 'planned') {
    return (
      <div className="card col">
        <div>Cette séance a déjà été commencée.</div>
        <div><button className="btn" onClick={() => navigate(session.status === 'in_progress' ? `/seance/${id}` : `/historique/${id}`)}>Voir</button></div>
      </div>
    )
  }

  const groups = groupByBlock(session.items)
  const side = groups.filter((g) => g.block !== 'main')
  const main = groups.find((g) => g.block === 'main')

  return (
    <>
      <div className="page-head">
        <div className="col" style={{ gap: 8 }}>
          <h1>Ta séance du jour</h1>
          <div className="row center wrap" style={{ gap: 8 }}>
            <TypeTag type={session.type} />
            <span className="tag">Intensité {INTENSITY_LABELS[session.intensity]}</span>
            <span className="tag">≈ {Math.round(session.estimatedSec / 60)} min</span>
            <PhaseBadge phase={session.checkin.phase} day={session.checkin.cycleDay} />
          </div>
        </div>
      </div>

      <div className="why">
        <b>Pourquoi cette séance ?</b>
        <div>{session.explanation}</div>
      </div>
      {session.advice && (
        <div className="toast row center between" style={{ background: '#fbeff1', borderColor: 'var(--menstruelle)', color: '#7a4651' }}>
          <span>💡 {session.advice}</span>
          {session.offerDoux && (
            <button className="btn small period" disabled={busy} onClick={() => regenerate({ type: 'doux' })}>Passer en séance douce</button>
          )}
        </div>
      )}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card grow col" style={{ gap: 6 }}>
          {side.map((g) => (
            <div key={g.block}>
              <h3>{BLOCK_LABELS[g.block]} · {formatDuration(blockSeconds(g.items))}</h3>
              {g.items.map((i) => <ItemRow key={i.id} item={i} />)}
            </div>
          ))}
        </div>
        {main && (
          <div className="card col" style={{ flex: 1.5, gap: 6 }}>
            <h3>
              {BLOCK_LABELS.main} · ≈ {Math.round(blockSeconds(main.items) / 60)} min
              {session.rounds > 1 && ` · ${session.rounds} ${session.type === 'renfo' && main.items[0]?.exerciseId === main.items[1]?.exerciseId ? 'séries' : 'tours'}`}
            </h3>
            {distinctExercises(main.items).map((i) => <ItemRow key={i.id} item={i} showZone={session.type === 'renfo'} />)}
            <div className="small muted">Repos entre les exercices : {formatDuration(main.items[0]?.restSec ?? 0)}</div>
          </div>
        )}
      </div>

      <div className="row">
        <button className="btn" disabled={busy} onClick={async () => {
          await api(`/sessions/${id}/start`, 'POST')
          navigate(`/seance/${id}`)
        }}>▶ Commencer</button>
        <button className="btn ghost" disabled={busy} onClick={() => regenerate()}>↻ Une autre proposition</button>
        <button className="btn soft" onClick={() => navigate('/')}>Modifier mon check-in</button>
      </div>
      {error && <div className="error">{error}</div>}
    </>
  )
}

function ItemRow({ item, showZone }: { item: SessionItem; showZone?: boolean }) {
  return (
    <div className="row center" style={{ gap: 12, padding: '6px 0', borderBottom: '1px solid #f3eff5' }}>
      <div style={{ background: '#f7f3f9', borderRadius: 10, flex: 'none' }}>
        <Figure exerciseId={item.exerciseId} type={item.exercise.type} size={46} />
      </div>
      <div className="grow">
        <div style={{ fontWeight: 800 }}>{item.exercise.name}</div>
        <div className="small muted">{targetLabel(item)}</div>
      </div>
      {showZone && <span className="small muted">{ZONE_LABELS[item.exercise.zone]}</span>}
    </div>
  )
}
