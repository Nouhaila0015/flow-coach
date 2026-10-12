import { ProfileForm } from '../components/ProfileForm'
import type { Profile } from '../types'

export function ProfilePage({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  return (
    <>
      <div>
        <h1>Mon profil</h1>
        <div className="muted">Ces infos guident le coach.</div>
      </div>
      <ProfileForm initial={profile} submitLabel="Enregistrer" onSaved={onSaved} />
    </>
  )
}
