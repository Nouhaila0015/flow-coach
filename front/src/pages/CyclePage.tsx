import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import { ConfirmDialog } from '../components/Dialog'
import { CycleTimeline } from '../components/CycleTimeline'
import { PeriodButton } from '../components/PeriodButton'
import { PhaseDot } from '../components/PhaseBadge'
import { formatDate, todayIso } from '../format'
import { PHASE_LABELS, type Period, type PeriodsResponse } from '../types'

export function CyclePage() {
  const [data, setData] = useState<PeriodsResponse | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ id: number; date: string; confirmMsg?: string } | null>(null)
  const [deleting, setDeleting] = useState<Period | null>(null)

  useEffect(() => {
    api<PeriodsResponse>('/periods').then(setData).catch((e) => setError(e.message))
  }, [])

  async function saveEdit(confirm: boolean) {
    if (!editing) return
    try {
      setData(await api<PeriodsResponse>(`/periods/${editing.id}`, 'PUT', { startDate: editing.date, confirm }))
      setEditing(null)
      setError('')
    } catch (e) {
      if (e instanceof ApiError && e.data.needsConfirm) setEditing({ ...editing, confirmMsg: e.message })
      else setError((e as Error).message)
    }
  }

  async function remove(p: Period) {
    setDeleting(null)
    try {
      setData(await api<PeriodsResponse>(`/periods/${p.id}`, 'DELETE'))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!data) return error ? <div className="error">{error}</div> : null
  const { cycle, periods } = data

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Mon cycle</h1>
          <div className="muted">La phase est calculée uniquement à partir des règles que tu notes. Aucune date n'est prédite.</div>
        </div>
        <PeriodButton onSaved={setData} />
      </div>
      {error && <div className="error">{error}</div>}

      {cycle ? (
        <>
          <div className="row">
            <div className="card kpi">
              <b className="row center" style={{ justifyContent: 'center', gap: 8 }}><PhaseDot phase={cycle.phase} /> J{cycle.day}</b>
              phase {PHASE_LABELS[cycle.phase].toLowerCase()}
            </div>
            <div className="card kpi">
              <b>{cycle.averageLength} j</b>cycle moyen ({cycle.cycleCount} cycle{cycle.cycleCount > 1 ? 's' : ''} noté{cycle.cycleCount > 1 ? 's' : ''})
            </div>
            <div className="card kpi">
              <b>{cycle.shortest === cycle.longest ? `${cycle.shortest} j` : `${cycle.shortest} – ${cycle.longest} j`}</b>plus court – plus long
            </div>
          </div>
          <div className="card">
            <h3>
              Cycle en cours <span className="small muted" style={{ fontWeight: 600 }}>
                — commencé le {formatDate(cycle.lastStart)}, ovulation estimée vers J{cycle.ovulationDay} ({cycle.averageLength} − 14)
              </span>
            </h3>
            <CycleTimeline cycle={cycle} />
          </div>
        </>
      ) : (
        <div className="card">Il faut au moins 2 débuts de règles notés pour calculer ta phase.</div>
      )}

      <div className="card">
        <h3>Débuts de règles notés</h3>
        <table className="table">
          <thead><tr><th>Début</th><th>Cycle suivant</th><th /></tr></thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id}>
                <td>
                  {editing?.id === p.id ? (
                    <input
                      type="date"
                      className="field"
                      value={editing.date}
                      max={todayIso()}
                      onChange={(e) => setEditing({ id: p.id, date: e.target.value })}
                    />
                  ) : formatDate(p.startDate)}
                </td>
                <td className={p.cycleLength === null ? 'muted' : ''}>
                  {p.cycleLength === null ? (cycle ? `en cours (J${cycle.day})` : 'en cours') : `${p.cycleLength} j`}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {editing?.id === p.id ? (
                    <span className="row center" style={{ gap: 12, justifyContent: 'flex-end' }}>
                      {editing.confirmMsg && <span className="note" style={{ color: 'var(--danger)' }}>{editing.confirmMsg}</span>}
                      <button className="btn small" onClick={() => saveEdit(!!editing.confirmMsg)}>
                        {editing.confirmMsg ? 'Confirmer' : 'Enregistrer'}
                      </button>
                      <button className="link-btn" onClick={() => setEditing(null)}>Annuler</button>
                    </span>
                  ) : (
                    <span className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
                      <button className="link-btn" onClick={() => setEditing({ id: p.id, date: p.startDate })}>modifier</button>
                      <button className="link-btn danger" onClick={() => setDeleting(p)}>supprimer</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="note" style={{ marginTop: 10 }}>
          Modifier ou supprimer une date recalcule la phase du jour ; les séances passées gardent la phase de leur check-in.
        </div>
      </div>

      {deleting && (
        <ConfirmDialog
          title="Supprimer ces règles ?"
          message={`Le début de règles du ${formatDate(deleting.startDate)} sera supprimé.`}
          confirmLabel="Supprimer"
          danger
          onConfirm={() => remove(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  )
}
