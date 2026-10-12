import { useEffect, useState } from 'react'
import { api } from '../api'
import { ConfirmDialog } from '../components/Dialog'
import { PhaseBadge } from '../components/PhaseBadge'
import { TypeTag } from '../components/TypeTag'
import { formatDate, formatDuration, formatShortDate } from '../format'
import { navigate } from '../router'
import { doneLabel, groupByBlock, targetLabel } from '../sessionText'
import {
  BLOCK_LABELS, DESIRE_LABELS, INTENSITY_LABELS, PHASE_LABELS, PLACE_LABELS, TYPE_LABELS,
  type Phase, type Session, type SessionSummary, type SessionType,
} from '../types'

const TYPES: SessionType[] = ['renfo', 'cardio', 'doux', 'course']
const PHASES: Phase[] = ['menstruelle', 'folliculaire', 'ovulatoire', 'luteale']
const FEEDBACK_LABELS = { too_hard: '😣 trop dur', too_easy: '😎 trop facile' }

/** Historique : liste filtrable des séances, détail de la séance sélectionnée. */
export function HistoryPage({ selectedId }: { selectedId?: number }) {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [type, setType] = useState<SessionType | 'all'>('all')
  const [phase, setPhase] = useState<Phase | 'all'>('all')
  const [detail, setDetail] = useState<Session | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = new URLSearchParams()
    if (type !== 'all') query.set('type', type)
    if (phase !== 'all') query.set('phase', phase)
    api<SessionSummary[]>(`/sessions?${query}`).then(setSessions).catch((e) => setError(e.message))
  }, [type, phase])

  useEffect(() => {
    setDetail(null)
    if (selectedId === undefined) return
    let stale = false
    api<Session>(`/sessions/${selectedId}`).then((s) => { if (!stale) setDetail(s) }).catch((e) => setError(e.message))
    return () => { stale = true }
  }, [selectedId])

  async function remove() {
    if (!detail) return
    setDeleting(false)
    try {
      await api(`/sessions/${detail.id}`, 'DELETE')
      setSessions((list) => list?.filter((s) => s.id !== detail.id) ?? null)
      navigate('/historique')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!sessions) return error ? <div className="error">{error}</div> : null
  const filtered = type !== 'all' || phase !== 'all'

  return (
    <>
      <div className="page-head">
        <h1>Historique <span className="small muted">{sessions.length} séance{sessions.length > 1 ? 's' : ''}</span></h1>
        <div className="chips">
          {(['all', ...TYPES] as const).map((t) => (
            <button key={t} className={`pill${type === t ? ' selected' : ''}`} onClick={() => setType(t)}>
              {t === 'all' ? 'Tous les types' : TYPE_LABELS[t]}
            </button>
          ))}
          <select className="field" value={phase} onChange={(e) => setPhase(e.target.value as Phase | 'all')}>
            <option value="all">Toutes les phases</option>
            {PHASES.map((p) => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
          </select>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: 2, minWidth: 0, overflowX: 'auto' }}>
          {sessions.length === 0 ? (
            <div className="empty">
              {filtered ? 'Aucune séance pour ces filtres.' : 'Aucune séance pour l\'instant. Ta première séance apparaîtra ici.'}
            </div>
          ) : (
            <table className="table small">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Durée</th><th>Intensité</th><th>Phase</th><th>Énergie</th><th>RPE</th><th>Statut</th></tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className={`clickable${s.id === selectedId ? ' selected' : ''}`}
                    onClick={() => navigate(`/historique/${s.id}`)}
                  >
                    <td>{formatShortDate(s.date)}</td>
                    <td><TypeTag type={s.type} /></td>
                    <td>{s.durationSec !== null ? formatDuration(s.durationSec) : '—'}</td>
                    <td>{INTENSITY_LABELS[s.intensity]}</td>
                    <td><PhaseBadge phase={s.phase} day={s.cycleDay} /></td>
                    <td>{s.energy} / 5</td>
                    <td>{s.rpe ?? '—'}</td>
                    <td className={s.status === 'interrupted' ? 'muted' : ''}>{s.status === 'done' ? 'terminée' : 'interrompue'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card col grow" style={{ position: 'sticky', top: 20 }}>
          {!detail ? (
            <div className="empty">Clique sur une séance pour voir son détail.</div>
          ) : (
            <>
              <div>
                <h2>{formatDate(detail.date)}</h2>
                <div className="row center wrap" style={{ gap: 8, marginTop: 8 }}>
                  <TypeTag type={detail.type} />
                  <span className="tag">Intensité {INTENSITY_LABELS[detail.intensity]}</span>
                  <PhaseBadge phase={detail.checkin.phase} day={detail.checkin.cycleDay} />
                  <span className="small muted">{detail.status === 'done' ? 'terminée' : 'interrompue'}</span>
                </div>
              </div>
              <div className="small">
                <b>Check-in :</b> énergie {detail.checkin.energy} / 5 · {detail.checkin.minutes} min ·{' '}
                {PLACE_LABELS[detail.checkin.place].toLowerCase()} · envie : {DESIRE_LABELS[detail.checkin.desire]}
              </div>
              <div className="small">
                <b>Réalisé :</b> {detail.durationSec !== null ? formatDuration(detail.durationSec) : '—'}
                {detail.rpe ? ` · RPE ${detail.rpe}` : ''}
              </div>
              <div className="small">
                <b>Ajustements :</b> {adjustmentText(detail)}
              </div>
              {groupByBlock(detail.items).map((g, n) => (
                <div key={n}>
                  <span className="label small" style={{ marginBottom: 2 }}>{BLOCK_LABELS[g.block]}</span>
                  <table className="table small">
                    <thead><tr><th>Exercice</th><th>Cible</th><th>Réalisé</th></tr></thead>
                    <tbody>
                      {g.items.map((i) => (
                        <tr key={i.id}>
                          <td style={{ whiteSpace: 'normal' }}>
                            {i.exercise.name}
                            {i.feedback && <span className="tiny muted"> · {FEEDBACK_LABELS[i.feedback]}</span>}
                          </td>
                          <td>{targetLabel({ ...i, note: null })}</td>
                          <td className={i.status === 'done' ? '' : 'muted'}>{doneLabel(i)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {detail.comment && <div className="why">« {detail.comment} »</div>}
              <div>
                <button className="link-btn danger" onClick={() => setDeleting(true)}>Supprimer cette séance</button>
              </div>
            </>
          )}
        </div>
      </div>

      {deleting && detail && (
        <ConfirmDialog
          title="Supprimer cette séance ?"
          message={`La séance du ${formatDate(detail.date)} sera retirée de l'historique et des statistiques.`}
          confirmLabel="Supprimer"
          danger
          onConfirm={remove}
          onCancel={() => setDeleting(false)}
        />
      )}
    </>
  )
}

/** « allégée de 1 cran (1 × trop dur) », « aucun » */
function adjustmentText(s: Session): string {
  const hard = s.items.filter((i) => i.feedback === 'too_hard').length
  const easy = s.items.filter((i) => i.feedback === 'too_easy').length
  if (hard + easy === 0) return 'aucun'
  const steps = Math.abs(s.adjustLevel)
  const level = s.adjustLevel === 0 ? 'séance revenue au niveau prévu' : `séance ${s.adjustLevel < 0 ? 'allégée' : 'renforcée'} de ${steps} cran${steps > 1 ? 's' : ''}`
  const parts = [hard ? `${hard} × trop dur` : '', easy ? `${easy} × trop facile` : ''].filter(Boolean)
  return `${level} (${parts.join(', ')})`
}
