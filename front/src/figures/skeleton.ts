// Squelette articulé des figurines.
//
// Une pose donne l'angle ABSOLU de chaque segment, en degrés :
// 0 = vers le bas, 90 = vers la gauche, -90 = vers la droite, 180 = vers le haut
// (la figurine regarde vers la droite ; L = membres du côté éloigné, R = côté proche).
// Le rendu SVG imbrique les segments (tronc → bras → avant-bras, hanche → cuisse → jambe),
// donc chaque groupe tourne de l'angle RELATIF à son parent.

export interface Pose {
  torso: number
  armL: number
  foreL: number
  armR: number
  foreR: number
  legL: number
  shinL: number
  legR: number
  shinR: number
  /** Décalage horizontal de la hanche (pas chassés…). */
  x?: number
  /** Saut : hauteur au-dessus du sol. */
  lift?: number
}

export const LEN = { torso: 24, head: 10, headR: 9, upperArm: 14, forearm: 13, thigh: 18, shin: 18 }
export const WIDTH = { torso: 13, thigh: 10, shin: 9, upperArm: 8.5, forearm: 8 }
export const GROUND = 93
const VIEW = 100

type Point = { x: number; y: number }

function dir(angle: number, len: number): Point {
  const a = (angle * Math.PI) / 180
  return { x: -Math.sin(a) * len, y: Math.cos(a) * len }
}
const add = (p: Point, q: Point): Point => ({ x: p.x + q.x, y: p.y + q.y })

/** Points de la pose (hanche à l'origine), avec la demi-épaisseur du segment. */
function points(p: Pose): { pt: Point; r: number }[] {
  const hip = { x: 0, y: 0 }
  const shoulder = add(hip, dir(p.torso, LEN.torso))
  const head = add(hip, dir(p.torso, LEN.torso + LEN.head))
  const elbowL = add(shoulder, dir(p.armL, LEN.upperArm))
  const elbowR = add(shoulder, dir(p.armR, LEN.upperArm))
  const kneeL = add(hip, dir(p.legL, LEN.thigh))
  const kneeR = add(hip, dir(p.legR, LEN.thigh))
  return [
    { pt: hip, r: WIDTH.torso / 2 },
    { pt: shoulder, r: WIDTH.torso / 2 },
    { pt: head, r: LEN.headR },
    { pt: elbowL, r: WIDTH.upperArm / 2 },
    { pt: elbowR, r: WIDTH.upperArm / 2 },
    { pt: add(elbowL, dir(p.foreL, LEN.forearm)), r: WIDTH.forearm / 2 },
    { pt: add(elbowR, dir(p.foreR, LEN.forearm)), r: WIDTH.forearm / 2 },
    { pt: kneeL, r: WIDTH.thigh / 2 },
    { pt: kneeR, r: WIDTH.thigh / 2 },
    { pt: add(kneeL, dir(p.shinL, LEN.shin)), r: WIDTH.shin / 2 },
    { pt: add(kneeR, dir(p.shinR, LEN.shin)), r: WIDTH.shin / 2 },
  ]
}

/** Ramène un angle dans ]-180, 180]. */
export function normalize(a: number): number {
  let r = a % 360
  if (r <= -180) r += 360
  if (r > 180) r -= 360
  return r
}

/** Choisit l'angle équivalent (à 360° près) le plus proche du précédent : pas de tour complet parasite. */
export function closest(a: number, previous: number): number {
  return a + 360 * Math.round((previous - a) / 360)
}

export interface Frame {
  hipX: number
  hipY: number
  torso: number
  armL: number
  foreL: number
  armR: number
  foreR: number
  legL: number
  shinL: number
  legR: number
  shinR: number
}

/**
 * Calcule, pour chaque pose, la position de la hanche (pose posée au sol, figure centrée)
 * et les angles relatifs de chaque groupe SVG.
 */
export function frames(poses: Pose[]): Frame[] {
  const pts = poses.map(points)
  // Centrage horizontal commun à toutes les poses (évite que la figure glisse).
  const xs = pts.flatMap((ps) => ps.flatMap(({ pt, r }) => [pt.x - r, pt.x + r]))
  const offsetX = VIEW / 2 - (Math.min(...xs) + Math.max(...xs)) / 2

  const result: Frame[] = []
  poses.forEach((p, i) => {
    const lowest = Math.max(...pts[i].map(({ pt, r }) => pt.y + r))
    const rel = {
      torso: normalize(p.torso),
      armL: normalize(p.armL - p.torso),
      foreL: normalize(p.foreL - p.armL),
      armR: normalize(p.armR - p.torso),
      foreR: normalize(p.foreR - p.armR),
      legL: normalize(p.legL),
      shinL: normalize(p.shinL - p.legL),
      legR: normalize(p.legR),
      shinR: normalize(p.shinR - p.legR),
    }
    const prev = result[i - 1]
    if (prev) for (const k of Object.keys(rel) as (keyof typeof rel)[]) rel[k] = closest(rel[k], prev[k])
    result.push({ hipX: offsetX + (p.x ?? 0), hipY: GROUND - lowest - (p.lift ?? 0), ...rel })
  })
  return result
}

export type Segment = 'root' | 'torso' | 'armL' | 'foreL' | 'armR' | 'foreR' | 'legL' | 'shinL' | 'legR' | 'shinR'

/** Transformation CSS d'un groupe pour une frame donnée (translation vers l'articulation + rotation). */
export function transformOf(seg: Segment, f: Frame): string {
  const r = (deg: number) => `rotate(${+deg.toFixed(2)}deg)`
  switch (seg) {
    case 'root': return `translate(${+f.hipX.toFixed(2)}px, ${+f.hipY.toFixed(2)}px)`
    case 'torso': return r(f.torso)
    case 'armL': return `translate(0px, ${LEN.torso}px) ${r(f.armL)}`
    case 'armR': return `translate(0px, ${LEN.torso}px) ${r(f.armR)}`
    case 'foreL': return `translate(0px, ${LEN.upperArm}px) ${r(f.foreL)}`
    case 'foreR': return `translate(0px, ${LEN.upperArm}px) ${r(f.foreR)}`
    case 'legL': return r(f.legL)
    case 'legR': return r(f.legR)
    case 'shinL': return `translate(0px, ${LEN.thigh}px) ${r(f.shinL)}`
    case 'shinR': return `translate(0px, ${LEN.thigh}px) ${r(f.shinR)}`
  }
}

export const SEGMENTS: Segment[] = ['root', 'torso', 'armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR']

/**
 * Feuille de style des animations : une @keyframes par segment.
 * `sequence` liste les poses dans l'ordre de passage ; la boucle revient à la première.
 */
export function keyframesCss(prefix: string, poses: Pose[], sequence: number[]): string {
  const steps = [...sequence, sequence[0]].map((i) => poses[i])
  const fs = frames(steps)
  return SEGMENTS.map((seg) => {
    const stops = fs
      .map((f, i) => `${+((i / (fs.length - 1)) * 100).toFixed(2)}%{transform:${transformOf(seg, f)}}`)
      .join('')
    return `@keyframes ${prefix}-${seg}{${stops}}`
  }).join('\n')
}
