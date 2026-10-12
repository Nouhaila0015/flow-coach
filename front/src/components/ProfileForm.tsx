import { useState } from 'react'
import { api } from '../api'
import {
  EQUIPMENT_LABELS, GOAL_LABELS, LEVEL_LABELS,
  type Equipment, type Goal, type Level, type Profile,
} from '../types'

type Draft = { goal?: Goal; level?: Level; equipment: Equipment[]; weeklyTarget?: number; periodLength: number }

/** Formulaire du profil, partagé entre le démarrage (étape 1) et la page Profil. */
export function ProfileForm({
  initial,
  submitLabel,
  onSaved,
}: {
  initial: Profile | null
  submitLabel: string
  onSaved: (p: Profile) => void
}) {
  const [draft, setDraft] = useState<Draft>(
    initial ?? { equipment: [], periodLength: 5 },
  )
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const set = (patch: Partial<Draft>) => { setDraft((d) => ({ ...d, ...patch })); setSaved(false) }

  const valid = !!draft.goal && !!draft.level && !!draft.weeklyTarget
    && Number.isInteger(draft.periodLength) && draft.periodLength >= 2 && draft.periodLength <= 10

  async function submit() {
    setError('')
    try {
      const p = await api<Profile>('/profile', 'PUT', draft)
      setSaved(true)
      onSaved(p)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function toggle(e: Equipment) {
    setDraft((d) => ({ ...d, equipment: d.equipment.includes(e) ? d.equipment.filter((x) => x !== e) : [...d.equipment, e] }))
    setSaved(false)
  }

  return (
    <div className="col">
      <div className="row">
        <div className="card grow col">
          <div>
            <span className="label">Objectif principal</span>
            <div className="chips">
              {(Object.keys(GOAL_LABELS) as Goal[]).map((g) => (
                <button key={g} className={`pill${draft.goal === g ? ' selected' : ''}`} onClick={() => set({ goal: g })}>
                  {GOAL_LABELS[g]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Niveau de départ</span>
            <div className="chips">
              {(Object.keys(LEVEL_LABELS) as Level[]).map((l) => (
                <button key={l} className={`pill${draft.level === l ? ' selected' : ''}`} onClick={() => set({ level: l })}>
                  {LEVEL_LABELS[l]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Séances visées par semaine</span>
            <div className="chips">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} className={`pill${draft.weeklyTarget === n ? ' selected' : ''}`} onClick={() => set({ weeklyTarget: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="card grow col">
          <div>
            <span className="label">Matériel possédé</span>
            <div className="col" style={{ gap: 8 }}>
              {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((e) => (
                <label key={e} className="row center" style={{ gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={draft.equipment.includes(e)} onChange={() => toggle(e)} />
                  {EQUIPMENT_LABELS[e]}
                </label>
              ))}
            </div>
            <div className="note" style={{ marginTop: 8 }}>Le matériel coché détermine les lieux proposés au check-in.</div>
          </div>
          <div>
            <span className="label">Durée habituelle des règles</span>
            <input
              type="number"
              className="field"
              style={{ width: 70 }}
              min={2}
              max={10}
              value={Number.isNaN(draft.periodLength) ? '' : draft.periodLength}
              onChange={(e) => set({ periodLength: e.target.valueAsNumber })}
            /> jours <span className="small muted">(2 à 10)</span>
          </div>
        </div>
      </div>
      <div className="row center">
        <button className="btn" disabled={!valid} onClick={submit}>{submitLabel}</button>
        {!valid && <span className="note">Tous les champs sont obligatoires.</span>}
        {saved && <span className="small" style={{ color: 'var(--ok)', fontWeight: 700 }}>✓ Enregistré</span>}
        {error && <span className="error">{error}</span>}
      </div>
      <div className="card small muted">
        ⚕️ Flow Coach propose des séances à titre indicatif et ne remplace pas un avis médical. Écoute ton corps.
      </div>
    </div>
  )
}
