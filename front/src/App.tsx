import { useEffect, useState } from 'react'
import { api } from './api'
import { Layout } from './components/Layout'
import { CyclePage } from './pages/CyclePage'
import { LibraryPage } from './pages/LibraryPage'
import { Onboarding } from './pages/Onboarding'
import { ProfilePage } from './pages/ProfilePage'
import { FinishPage } from './pages/FinishPage'
import { GuidedPage } from './pages/GuidedPage'
import { PreviewPage } from './pages/PreviewPage'
import { TodayPage } from './pages/TodayPage'
import { match, useRoute } from './router'
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
  if (route === '/bibliotheque') return <LibraryPage />
  if (route === '/profil') return <ProfilePage profile={profile} onSaved={setProfile} />
  const preview = match('/apercu/:id', route)
  if (preview) return <PreviewPage key={preview.id} id={Number(preview.id)} />
  const guided = match('/seance/:id', route)
  if (guided) return <GuidedPage key={guided.id} id={Number(guided.id)} />
  const end = match('/fin/:id', route)
  if (end) return <FinishPage key={end.id} id={Number(end.id)} />
  return <TodayPage />
}
