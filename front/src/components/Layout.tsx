import type { ReactNode } from 'react'

const LINKS = [
  { path: '/', label: "Aujourd'hui" },
  { path: '/cycle', label: 'Cycle' },
  { path: '/historique', label: 'Historique' },
  { path: '/tableau-de-bord', label: 'Tableau de bord' },
  { path: '/bibliotheque', label: 'Bibliothèque' },
  { path: '/profil', label: 'Profil' },
]

/** Section active : les pages de séance (aperçu, guidée, fin) relèvent d'« Aujourd'hui ». */
function section(route: string): string {
  const first = '/' + (route.split('/')[1] ?? '')
  return LINKS.some((l) => l.path === first) ? first : '/'
}

export function Layout({ route, children }: { route: string; children: ReactNode }) {
  const active = section(route)
  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="logo"><i />Flow Coach</div>
        {LINKS.map((l) => (
          <a key={l.path} href={`#${l.path}`} className={`nav-link${active === l.path ? ' active' : ''}`}>
            {l.label}
          </a>
        ))}
        <div className="sidebar-foot">Flow Coach ne remplace pas un avis médical.</div>
      </nav>
      <main className="main">{children}</main>
    </div>
  )
}
