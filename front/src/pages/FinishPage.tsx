import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatDuration } from '../format'
import { navigate } from '../router'
import { activeClockKey } from '../timer'
import type { Session } from '../types'

type Target = { reps: number | null; duration: number | null; load: number | null }
type Change = { exerciseId: string; name: string; before: Target; after: Target; rule: string }

function targetText(t: Target): string {
  const main = t.reps !== null ? `${t.reps} rép.` : t.duration !== null ? formatDuration(t.duration) : ''
  return t.load ? `${main} · ${t.load} kg` : main
}

/** Fin de séance : récapitulatif, difficulté ressentie (RPE) et aperçu de la progression. */
export function FinishPage({ id }: { id: number }) {
  const [session, setSession] = useState<Session | null>(null)
  const [rpe, setRpe] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [progression, setProgression] = useState<Change[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Session>(`/sessions/${id}`).then(setSession).catch((e) => setError(e.message))
  }, [id])

  // Temps actif mesuré pendant la séance guidée (pauses exclues), sinon temps depuis le début.
  function activeSeconds(s: Session): number {
    const stored = sessionStorage.getItem(activeClockKey(id))
    if (stored) return Math.round(Number(stored) / 1000)
    return s.startedAt ? Math.round((Date.now() - Date.parse(s.startedAt)) / 1000) : 0
  }

  async function save() {
    if (!session || rpe === null) return
    setBusy(true)
    setError('')
    try {
      const res = await api<{ session: Session; progression: Change[] }>(`/sessions/${id}/finish`, 'POST', {
        status: 'done', rpe, comment, durationSec: activeSeconds(session),
      })
      sessionStorage.removeItem(activeClockKey(id))
      setSession(res.session)
      setProgression(res.progression)
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  if (!session) return error ? <div className="error">{error}</div> : null

  const done = session.items.filter((i) => i.status === 'done').length
  const skipped = session.items.filter((i) => i.status === 'skipped').length
  const adjustments = session.items.filter((i) => i.feedback).length
  const duration = session.durationSec ?? activeSeconds(session)
  const finished = session.status === 'done' || session.status === 'interrupted'

  return (
    <>
      <h1>{session.status === 'interrupted' ? 'Séance interrompue' : 'Bravo, séance terminée 🌸'}</h1>
      <div className="row">
        <div className="card kpi"><b>{formatDuration(duration)}</b>durée réelle</div>
        <div className="card kpi"><b>{done} / {session.items.length}</b>exercices faits</div>
        <div className="card kpi"><b>{skipped}</b>sauté{skipped > 1 ? 's' : ''}</div>
        <div className="card kpi">
          <b>{session.adjustLevel > 0 ? `+${session.adjustLevel}` : session.adjustLevel < 0 ? `−${-session.adjustLevel}` : '0'}</b>
          ajustement{adjustments > 1 ? 's' : ''} ({adjustments} retour{adjustments > 1 ? 's' : ''})
        </div>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        {!finished ? (
          <div className="card col" style={{ flex: 1.4 }}>
            <span className="label">Comment c'était ? (RPE, obligatoire)</span>
            <div className="chips">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button key={n} className={`pill${rpe === n ? ' selected' : ''}`} style={{ width: 44, justifyContent: 'center' }} onClick={() => setRpe(n)}>
                  {n}
                </button>
              ))}
            </div>
            <div className="small muted">1 = très facile · 10 = effort maximal</div>
            <label>
              <span className="label">Commentaire (facultatif)</span>
              <textarea className="field" value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} placeholder="Comment tu t'es sentie ?" />
            </label>
            <div className="row center">
              <button className="btn" disabled={rpe === null || busy} onClick={save}>Enregistrer</button>
              {rpe === null && <span className="note">Choisis une note de 1 à 10.</span>}
              {error && <span className="error">{error}</span>}
            </div>
          </div>
        ) : (
          <div className="card col" style={{ flex: 1.4 }}>
            {session.rpe && <div>Difficulté ressentie : <b>RPE {session.rpe}</b></div>}
            {session.comment && <div className="muted">« {session.comment} »</div>}
            {session.status === 'interrupted' && <div className="muted">Une séance interrompue compte dans l'historique mais ne fait pas progresser les cibles.</div>}
            <div className="row">
              <button className="btn" onClick={() => navigate('/')}>Retour à l'accueil</button>
              <button className="btn soft" onClick={() => navigate(`/historique/${id}`)}>Voir dans l'historique</button>
            </div>
          </div>
        )}

        <div className="card grow">
          <h3>Prochaine fois</h3>
          {progression === null ? (
            <div className="small muted">La progression de chaque exercice est calculée après l'enregistrement.</div>
          ) : progression.length === 0 ? (
            <div className="small muted">Pas de progression à appliquer.</div>
          ) : (
            <table className="table">
              <thead><tr><th>Exercice</th><th>Cible</th><th /></tr></thead>
              <tbody>
                {progression.map((p) => {
                  const same = targetText(p.before) === targetText(p.after)
                  return (
                    <tr key={p.exerciseId}>
                      <td>{p.name}</td>
                      <td>{same ? <>{targetText(p.after)} <span className="muted">=</span></> : <>{targetText(p.before)} → <b>{targetText(p.after)}</b></>}</td>
                      <td className="small muted">{p.rule}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
