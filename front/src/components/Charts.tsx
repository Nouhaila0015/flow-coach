import type { ReactNode } from 'react'
import { formatDate } from '../format'
import { PHASE_COLORS, PHASE_LABELS, TYPE_COLORS, TYPE_LABELS, type SessionType, type Stats } from '../types'

// Graphiques SVG faits maison : un seul axe par graphique, grille discrète, textes à l'encre (jamais à la couleur de la série).

const W = 520
const H = 230
const PAD = { left: 30, right: 14, top: 18, bottom: 26 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom
const BASE = PAD.top + PLOT_H
const TYPES: SessionType[] = ['renfo', 'cardio', 'doux', 'course']

/** Borne haute « ronde » de l'axe, et pas des graduations. */
function scale(max: number, minTop: number): { top: number; step: number } {
  const target = Math.max(max, minTop)
  const step = [1, 2, 5, 10, 20, 30, 60, 120, 240].find((s) => target / s <= 5) ?? Math.ceil(target / 5)
  return { top: Math.ceil(target / step) * step, step }
}

const y = (value: number, top: number) => BASE - (value / top) * PLOT_H

/** « 12/10 » : lundi de la semaine. */
const weekLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function Frame({ top, step, label, children }: { top: number; step: number; label: string; children: ReactNode }) {
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t, top)} y2={y(t, top)} stroke={t === 0 ? '#d9d2e0' : '#f0ebf2'} strokeWidth={1} />
          <text x={PAD.left - 6} y={y(t, top) + 3.5} textAnchor="end" fontSize={10} fill="var(--muted)">{t}</text>
        </g>
      ))}
      {children}
    </svg>
  )
}

/** Barre arrondie en haut, ancrée sur la ligne de base. */
function Bar({ x, width, from, to, fill, title, rounded = true, stroke }: {
  x: number; width: number; from: number; to: number; fill: string; title: string; rounded?: boolean; stroke?: string
}) {
  const h = from - to
  if (h <= 0) return null
  const r = rounded ? Math.min(4, width / 2, h) : 0
  return (
    <path
      d={`M${x},${from} V${to + r} Q${x},${to} ${x + r},${to} H${x + width - r} Q${x + width},${to} ${x + width},${to + r} V${from} Z`}
      fill={fill} stroke={stroke} strokeWidth={stroke ? 1.5 : 0}
    >
      <title>{title}</title>
    </path>
  )
}

function XLabels({ labels, slot }: { labels: string[]; slot: number }) {
  const every = Math.ceil(labels.length / 8)
  return (
    <>
      {labels.map((l, i) => (i % every === 0 || i === labels.length - 1) && (i % every === 0 || labels.length - 1 - i >= every / 2) ? (
        <text key={i} x={PAD.left + slot * (i + 0.5)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">{l}</text>
      ) : null)}
    </>
  )
}

export function Legend({ items }: { items: { label: string; color: string; outline?: string }[] }) {
  return (
    <div className="row wrap small muted" style={{ gap: 14, marginTop: 6 }}>
      {items.map((i) => (
        <span key={i.label} className="row center" style={{ gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, background: i.color, boxShadow: i.outline ? `inset 0 0 0 1.5px ${i.outline}` : undefined }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** Régularité : séances terminées par semaine, avec la ligne d'objectif. */
export function RegularityChart({ weeks, target }: { weeks: Stats['weeks']; target: number }) {
  const { top, step } = scale(Math.max(target, ...weeks.map((w) => w.sessions)), 4)
  const slot = PLOT_W / weeks.length
  const width = Math.min(34, slot - 2)
  return (
    <Frame top={top} step={step} label="Séances terminées par semaine">
      {weeks.map((w, i) => (
        <Bar
          key={w.start} x={PAD.left + slot * i + (slot - width) / 2} width={width} from={BASE} to={y(w.sessions, top)}
          fill="var(--accent)" title={`Semaine du ${formatDate(w.start)} : ${w.sessions} séance${w.sessions > 1 ? 's' : ''}`}
        />
      ))}
      <line x1={PAD.left} x2={W - PAD.right} y1={y(target, top)} y2={y(target, top)} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={W - PAD.right} y={y(target, top) - 5} textAnchor="end" fontSize={10.5} fontWeight={800} fill="var(--ink)">objectif : {target}</text>
      <XLabels labels={weeks.map((w) => weekLabel(w.start))} slot={slot} />
    </Frame>
  )
}

/** Volume : minutes par semaine, empilées par type de séance. */
export function VolumeChart({ weeks }: { weeks: Stats['weeks'] }) {
  const total = (w: Stats['weeks'][number]) => TYPES.reduce((s, t) => s + w.minutes[t], 0)
  const { top, step } = scale(Math.max(...weeks.map(total)), 30)
  const slot = PLOT_W / weeks.length
  const width = Math.min(34, slot - 2)
  return (
    <>
      <Frame top={top} step={step} label="Minutes par semaine, par type de séance">
        {weeks.map((w, i) => {
          let acc = 0
          const used = TYPES.filter((t) => w.minutes[t] > 0)
          return used.map((t, n) => {
            const from = y(acc, top)
            acc += w.minutes[t]
            // 2 px de fond entre deux segments ; seul le segment du haut est arrondi
            return (
              <Bar
                key={w.start + t} x={PAD.left + slot * i + (slot - width) / 2} width={width} from={from - (n > 0 ? 2 : 0)} to={y(acc, top)}
                fill={TYPE_COLORS[t]} rounded={n === used.length - 1}
                title={`Semaine du ${formatDate(w.start)} — ${TYPE_LABELS[t]} : ${w.minutes[t]} min (total ${total(w)} min)`}
              />
            )
          })
        })}
        <XLabels labels={weeks.map((w) => weekLabel(w.start))} slot={slot} />
      </Frame>
      <Legend items={TYPES.map((t) => ({ label: TYPE_LABELS[t], color: TYPE_COLORS[t] }))} />
    </>
  )
}

/** Énergie et RPE moyens par phase : barres groupées sur un même axe de 0 à 10. */
export function PhaseChart({ phases }: { phases: Stats['phases'] }) {
  const slot = PLOT_W / phases.length
  const width = 30
  const value = (v: number) => String(v).replace('.', ',')
  return (
    <>
      <Frame top={10} step={2} label="Énergie et RPE moyens par phase du cycle">
        {phases.map((p, i) => {
          const center = PAD.left + slot * (i + 0.5)
          const name = PHASE_LABELS[p.phase]
          return (
            <g key={p.phase}>
              {p.energy !== null && (
                <>
                  <Bar x={center - width - 1} width={width} from={BASE} to={y(p.energy, 10)} fill={PHASE_COLORS[p.phase]} title={`${name} — énergie moyenne : ${value(p.energy)} / 5`} />
                  <text x={center - width / 2 - 1} y={y(p.energy, 10) - 5} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="var(--ink)">{value(p.energy)}</text>
                </>
              )}
              {p.rpe !== null && (
                <>
                  <Bar x={center + 1} width={width} from={BASE} to={y(p.rpe, 10)} fill="#fff" stroke={PHASE_COLORS[p.phase]} title={`${name} — RPE moyen : ${value(p.rpe)} / 10`} />
                  <text x={center + width / 2 + 1} y={y(p.rpe, 10) - 5} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="var(--ink)">{value(p.rpe)}</text>
                </>
              )}
              {p.sessions === 0 && <text x={center} y={BASE - 8} textAnchor="middle" fontSize={10} fill="var(--muted)">aucune séance</text>}
              <text x={center} y={H - 8} textAnchor="middle" fontSize={10.5} fill="var(--muted)">{name} ({p.sessions})</text>
            </g>
          )
        })}
      </Frame>
      <Legend items={[{ label: 'Énergie au check-in (sur 5)', color: '#cfc8d8' }, { label: 'RPE (sur 10)', color: '#fff', outline: '#b9b0c6' }]} />
    </>
  )
}

/** Progression d'un exercice au fil des séances. */
export function ProgressChart({ points, unit, label }: { points: { date: string; value: number }[]; unit: string; label: string }) {
  const { top, step } = scale(Math.max(...points.map((p) => p.value)), 4)
  const x = (i: number) => (points.length === 1 ? PAD.left + PLOT_W / 2 : PAD.left + 12 + ((PLOT_W - 24) * i) / (points.length - 1))
  const last = points.length - 1
  return (
    <Frame top={top} step={step} label={label}>
      <polyline points={points.map((p, i) => `${x(i)},${y(p.value, top)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value, top)} r={4.5} fill="var(--accent)" stroke="#fff" strokeWidth={2} />
          {/* cible de survol plus large que le point */}
          <circle cx={x(i)} cy={y(p.value, top)} r={12} fill="transparent"><title>{`${formatDate(p.date)} : ${p.value} ${unit}`}</title></circle>
          {(i === 0 || i === last) && (
            <text x={x(i)} y={y(p.value, top) - 10} textAnchor={points.length === 1 ? 'middle' : i === 0 ? 'start' : 'end'} fontSize={11} fontWeight={800} fill="var(--ink)">
              {p.value} {unit}
            </text>
          )}
        </g>
      ))}
      <text x={x(0)} y={H - 8} textAnchor={points.length === 1 ? 'middle' : 'start'} fontSize={10} fill="var(--muted)">{formatDate(points[0].date)}</text>
      {last > 0 && <text x={x(last)} y={H - 8} textAnchor="end" fontSize={10} fill="var(--muted)">{formatDate(points[last].date)}</text>}
    </Frame>
  )
}
