import { useId, useSyncExternalStore, type CSSProperties } from 'react'
import { motionFor, type Prop } from '../figures/poses'
import { frames, GROUND, keyframesCss, LEN, transformOf, WIDTH, type Segment } from '../figures/skeleton'

export type FigureType = 'renfo' | 'cardio' | 'doux' | 'course'

// Silhouette neutre arrondie : aplats pastel selon le type d'exercice (membres éloignés plus clairs).
const COLORS: Record<FigureType, { near: string; far: string; head: string; ground: string }> = {
  renfo: { near: '#8f7fc4', far: '#c3b8e3', head: '#9c8bc9', ground: '#e4ddf1' },
  cardio: { near: '#e0956a', far: '#f2c6a9', head: '#e9a27a', ground: '#f8e2d4' },
  doux: { near: '#6e9f86', far: '#b4d1c2', head: '#7faf96', ground: '#dcebe3' },
  course: { near: '#5d93ba', far: '#b1cfe4', head: '#6fa3c7', ground: '#dbe9f3' },
}

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(reducedMotionQuery)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(reducedMotionQuery).matches,
  )
}

interface Props {
  exerciseId: string
  type: FigureType
  /** Animée en boucle (séance guidée, fiche) ou fixe sur la pose clé (listes, miniatures). */
  animated?: boolean
  paused?: boolean
  size?: number | string
  /** Pose fixe à afficher (par défaut la pose clé). */
  pose?: number
}

export function Figure({ exerciseId, type, animated = false, paused = false, size = 64, pose }: Props) {
  const uid = 'fc' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const reduced = useReducedMotion()
  const motion = motionFor(exerciseId)

  // Animations réduites : les poses clés côte à côte, fixes.
  if (animated && reduced) {
    return (
      <div className="row center" style={{ gap: 8, justifyContent: 'center' }}>
        {motion.poses.map((_, i) => (
          <Figure key={i} exerciseId={exerciseId} type={type} pose={i} size={typeof size === 'number' ? size / 2 : '45%'} />
        ))}
      </div>
    )
  }

  const sequence = motion.sequence ?? pingPong(motion.poses.length)
  const staticFrame = frames(motion.poses)[pose ?? motion.key]
  const isAnimated = animated && motion.poses.length > 1

  const style = (seg: Segment) =>
    isAnimated
      ? {
          animation: `${uid}-${seg} ${motion.duration}s ease-in-out infinite`,
          animationPlayState: paused ? 'paused' : 'running',
        }
      : { transform: transformOf(seg, staticFrame) }

  return (
    <svg viewBox="0 -8 100 108" width={size} height={size} role="img" aria-label="Figurine de l'exercice" style={{ display: 'block' }}>
      {isAnimated && <style>{keyframesCss(uid, motion.poses, sequence)}</style>}
      <Ground type={type} props={motion.props} />
      <Body type={type} style={style} props={motion.props} />
    </svg>
  )
}

function pingPong(n: number): number[] {
  const forward = Array.from({ length: n }, (_, i) => i)
  return [...forward, ...forward.slice(1, -1).reverse()]
}

function Ground({ type, props }: { type: FigureType; props?: Prop[] }) {
  const c = COLORS[type]
  return props?.includes('mat')
    ? <rect x={6} y={GROUND - 1} width={88} height={5} rx={2.5} fill={c.ground} />
    : <line x1={14} x2={86} y1={GROUND + 1.5} y2={GROUND + 1.5} stroke={c.ground} strokeWidth={3} strokeLinecap="round" />
}

function Body({
  type,
  style,
  props,
}: {
  type: FigureType
  style: (seg: Segment) => CSSProperties
  props?: Prop[]
}) {
  const c = COLORS[type]
  const limb = (len: number, width: number, color: string) => (
    <line x1={0} y1={0} x2={0} y2={len} stroke={color} strokeWidth={width} strokeLinecap="round" />
  )
  const hand = (color: string) => (
    <>
      {props?.includes('dumbbells') && (
        <g>
          <rect x={-6} y={LEN.forearm - 1.5} width={12} height={3} rx={1.5} fill="#7a7488" />
          <rect x={-7.5} y={LEN.forearm - 3.5} width={3.5} height={7} rx={1.5} fill="#5e5970" />
          <rect x={4} y={LEN.forearm - 3.5} width={3.5} height={7} rx={1.5} fill="#5e5970" />
        </g>
      )}
      {props?.includes('band') && (
        <circle cx={0} cy={LEN.forearm + 1} r={3.2} fill="none" stroke="#e8b4bc" strokeWidth={2} />
      )}
      {!props?.includes('dumbbells') && <circle cx={0} cy={LEN.forearm} r={WIDTH.forearm / 2} fill={color} />}
    </>
  )
  const arm = (side: 'L' | 'R', color: string) => (
    <g style={style(`arm${side}`)}>
      {limb(LEN.upperArm, WIDTH.upperArm, color)}
      <g style={style(`fore${side}`)}>
        {limb(LEN.forearm, WIDTH.forearm, color)}
        {hand(color)}
      </g>
    </g>
  )
  const leg = (side: 'L' | 'R', color: string) => (
    <g style={style(`leg${side}`)}>
      {limb(LEN.thigh, WIDTH.thigh, color)}
      <g style={style(`shin${side}`)}>{limb(LEN.shin, WIDTH.shin, color)}</g>
    </g>
  )

  return (
    <g style={style('root')}>
      {leg('L', c.far)}
      <g style={style('torso')}>
        {arm('L', c.far)}
        {limb(LEN.torso, WIDTH.torso, c.near)}
        <circle cx={0} cy={LEN.torso + LEN.head} r={LEN.headR} fill={c.head} />
        {arm('R', c.near)}
      </g>
      {leg('R', c.near)}
    </g>
  )
}

