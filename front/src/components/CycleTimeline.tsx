import { PHASE_COLORS, PHASE_LABELS, type CycleInfo } from '../types'

/**
 * Frise du cycle en cours, de J1 à aujourd'hui, colorée par phase.
 * Au-delà d'aujourd'hui, une simple zone en pointillés : aucune date n'est projetée.
 */
export function CycleTimeline({ cycle }: { cycle: CycleInfo }) {
  const W = 900
  const span = Math.max(cycle.day, cycle.averageLength)
  const x = (day: number) => ((day - 1) / span) * W
  const segments = cycle.ranges
    .filter((r) => r.from <= cycle.day)
    .map((r) => ({ ...r, end: Math.min(r.to ?? cycle.day, cycle.day) }))
  const todayX = x(cycle.day + 1)

  return (
    <div>
      <svg viewBox={`0 -4 ${W} 52`} style={{ width: '100%', height: 64 }} role="img" aria-label="Frise du cycle en cours">
        {segments.map((s) => (
          <rect
            key={s.phase}
            x={x(s.from) + 2}
            y={6}
            width={Math.max(x(s.end + 1) - x(s.from) - 4, 4)}
            height={22}
            rx={8}
            fill={PHASE_COLORS[s.phase]}
          >
            <title>{`${PHASE_LABELS[s.phase]} : J${s.from}–J${s.end}`}</title>
          </rect>
        ))}
        {todayX < W - 10 && (
          <>
            <rect x={todayX + 4} y={6} width={W - todayX - 6} height={22} rx={8} fill="none" stroke="#e2dce8" strokeDasharray="4 4" />
            {W - todayX > 260 && (
              <text x={todayX + 18} y={21} fontSize={12} fill="#a39dae">jusqu'aux prochaines règles notées</text>
            )}
          </>
        )}
        <line x1={todayX} x2={todayX} y1={0} y2={34} stroke="var(--accent-dark)" strokeWidth={3} strokeLinecap="round" />
        <text x={2} y={46} fontSize={12} fill="#8a8496">J1</text>
        <text x={Math.min(Math.max(todayX - 40, 30), W - 80)} y={46} fontSize={12} fontWeight={800} fill="#6b5fa0">
          J{cycle.day} · aujourd'hui
        </text>
      </svg>
      <div className="row wrap small" style={{ gap: 18 }}>
        {cycle.ranges.map((r) => (
          <span key={r.phase} className="row center" style={{ gap: 6 }}>
            <span className="dot" style={{ background: PHASE_COLORS[r.phase] }} />
            {PHASE_LABELS[r.phase]} {r.to === null ? `J${r.from} → …` : `J${r.from}–J${r.to}`}
          </span>
        ))}
      </div>
    </div>
  )
}
