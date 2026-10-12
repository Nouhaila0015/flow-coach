import { useEffect, useState } from 'react'
import { api } from './api'
import { Layout } from './components/Layout'
import { CyclePage } from './pages/CyclePage'
import { Onboarding } from './pages/Onboarding'
import { ProfilePage } from './pages/ProfilePage'
import { useRoute } from './router'
import type { Profile } from './types'

export default function App() {
  const route = useRoute()
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [error, setError] = useState('')

  const loadProfile = () =>
    api<Profile | null>('/profile').then(setProfile).catch(() => setError('Impossible de joindre le serveur Flow Coach.'))

  useEffect(() => {
    loadProfile()
  }, [])

  if (error) return <div className="empty error">{error}</div>
  if (profile === undefined) return null
  if (!profile?.onboarded) return <Onboarding profile={profile} onDone={loadProfile} />

  return <Layout route={route}>{page(route, profile, setProfile)}</Layout>
}

function page(route: string, profile: Profile, setProfile: (p: Profile) => void) {
  if (route === '/cycle') return <CyclePage />
  if (route === '/profil') return <ProfilePage profile={profile} onSaved={setProfile} />
  return (
    <>
      <h1>Flow Coach</h1>
      <div className="card muted">Page en construction.</div>
    </>
  )
}
