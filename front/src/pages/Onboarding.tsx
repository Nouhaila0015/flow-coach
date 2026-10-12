import { useState } from 'react'
import { api, ApiError } from '../api'
import { ProfileForm } from '../components/ProfileForm'
import { todayIso } from '../format'
import type { Profile } from '../types'

/** Assistant de premier lancement : 1. profil, 2. trois derniers débuts de règles. */
export function Onboarding({ profile, onDone }: { profile: Profile | null; onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [current, setCurrent] = useState(profile)
  const [dates, setDates] = useState(['', '', ''])
  const [error, setError] = useState('')
  const [confirmMsg, setConfirmMsg] = useState('')

  async function finish(confirm: boolean) {
    setError('')
    try {
      await api('/periods/init', 'POST', { dates, confirm })
      onDone()
    } catch (e) {
      if (e instanceof ApiError && e.data.needsConfirm) setConfirmMsg(e.message)
      else setError((e as Error).message)
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="logo"><i />Flow Coach</div>
      <div className="small muted" style={{ fontWeight: 800 }}>Démarrage · étape {step}/2</div>
      {step === 1 ? (
        <>
          <div>
            <h1>Bienvenue 🌿 Faisons connaissance</h1>
            <div className="muted">Ces infos guident le coach. Tu peux les modifier quand tu veux.</div>
          </div>
          <ProfileForm
            initial={current}
            submitLabel="Continuer → étape 2 : mon cycle"
            onSaved={(p) => { setCurrent(p); setStep(2) }}
          />
        </>
      ) : (
        <>
          <div>
            <h1>Mon cycle</h1>
            <div className="muted">
              Saisis la date de début de tes 3 dernières règles. Ensuite, tu noteras toi-même chaque nouvelle période :
              rien n'est jamais prédit.
            </div>
          </div>
          <div className="card col" style={{ maxWidth: 460, background: '#fbeff1' }}>
            {dates.map((d, i) => (
              <label key={i} className="row center" style={{ gap: 12 }}>
                <span style={{ width: 90, fontWeight: 700 }}>Règles {i + 1}</span>
                <input
                  type="date"
                  className="field"
                  value={d}
                  max={todayIso()}
                  onChange={(e) => {
                    const value = e.target.value
                    setDates((prev) => prev.map((x, j) => (j === i ? value : x)))
                    setConfirmMsg('')
                  }}
                />
              </label>
            ))}
            <div className="note">Pas de date future ni de doublon. Écart de moins de 15 jours → confirmation demandée.</div>
            {confirmMsg && <div className="note" style={{ color: 'var(--danger)' }}>{confirmMsg}</div>}
            {error && <div className="error">{error}</div>}
            <div className="row">
              <button className="btn soft" onClick={() => setStep(1)}>← Retour</button>
              {confirmMsg
                ? <button className="btn" onClick={() => finish(true)}>Confirmer et commencer</button>
                : <button className="btn" disabled={dates.some((d) => !d)} onClick={() => finish(false)}>Terminer et commencer</button>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
