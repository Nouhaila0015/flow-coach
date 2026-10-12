import type { ReactNode } from 'react'
import { TYPE_COLORS, TYPE_LABELS, type SessionType } from '../types'

export function TypeTag({ type, children }: { type: SessionType; children?: ReactNode }) {
  return (
    <span className="tag" style={{ background: TYPE_COLORS[type] }}>
      {children ?? TYPE_LABELS[type]}
    </span>
  )
}
