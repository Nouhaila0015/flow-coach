import { useEffect, useState } from 'react'

// Routage minimal par hash (#/cycle, #/seance/12…) : pas de configuration serveur nécessaire.

function current(): string {
  return window.location.hash.replace(/^#/, '') || '/'
}

export function useRoute(): string {
  const [route, setRoute] = useState(current)
  useEffect(() => {
    const onChange = () => setRoute(current())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(path: string) {
  window.location.hash = path
}

/** Renvoie les paramètres si la route correspond au motif (ex. "/seance/:id"). */
export function match(pattern: string, route: string): Record<string, string> | null {
  const p = pattern.split('/')
  const r = route.split('/')
  if (p.length !== r.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(r[i])
    else if (p[i] !== r[i]) return null
  }
  return params
}
