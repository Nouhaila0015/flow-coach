import { PHASE_COLORS, PHASE_LABELS, type Phase } from '../types'

export function PhaseDot({ phase }: { phase: Phase }) {
  return <span className="dot" style={{ background: PHASE_COLORS[phase] }} />
}

/** Pastille « J18 · Lutéale » (lecture seule). */
export function PhaseBadge({ phase, day }: { phase: Phase; day?: number }) {
  return (
    <span className="tag" style={{ background: PHASE_COLORS[phase] }}>
      {day !== undefined && `J${day} · `}
      {PHASE_LABELS[phase]}
    </span>
  )
}
