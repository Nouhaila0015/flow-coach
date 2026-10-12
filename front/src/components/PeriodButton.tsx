import { useState } from 'react'
import { api, ApiError } from '../api'
import { todayIso } from '../format'
import type { PeriodsResponse } from '../types'
import { Dialog } from './Dialog'

/** Bouton « Mes règles ont commencé » : date du jour par défaut, modifiable vers une date passée. */
export function PeriodButton({ onSaved }: { onSaved: (res: PeriodsResponse) => void }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState('')
  const [confirmMsg, setConfirmMsg] = useState('')

  function close() {
    setOpen(false)
    setError('')
    setConfirmMsg('')
  }

  async function save(confirm: boolean) {
    setError('')
    try {
      const res = await api<PeriodsResponse>('/periods', 'POST', { startDate: date, confirm })
      close()
      onSaved(res)
    } catch (e) {
      if (e instanceof ApiError && e.data.needsConfirm) setConfirmMsg(e.message)
      else setError((e as Error).message)
    }
  }

  return (
    <>
      <button className="btn period" onClick={() => { setDate(todayIso()); setOpen(true) }}>
        🩸 Mes règles ont commencé
      </button>
      {open && (
        <Dialog title="🩸 Début des règles" onClose={close}>
          <label>
            <span className="label">Date de début</span>
            <input
              type="date"
              className="field"
              value={date}
              max={todayIso()}
              onChange={(e) => { setDate(e.target.value); setConfirmMsg('') }}
            />
          </label>
          {confirmMsg && <div className="note" style={{ color: 'var(--danger)' }}>{confirmMsg}</div>}
          {error && <div className="error">{error}</div>}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn soft" onClick={close}>Annuler</button>
            {confirmMsg
              ? <button className="btn" onClick={() => save(true)}>Confirmer quand même</button>
              : <button className="btn" disabled={!date} onClick={() => save(false)}>Enregistrer</button>}
          </div>
        </Dialog>
      )}
    </>
  )
}
