import type { Pose } from './skeleton'

export type Prop = 'dumbbells' | 'band' | 'mat'

export interface Motion {
  poses: Pose[]
  /** Ordre de passage des poses (par défaut aller-retour : 0 → n-1 → 0). */
  sequence?: number[]
  /** Durée d'un cycle d'animation, en secondes. */
  duration: number
  /** Pose affichée sur les miniatures fixes. */
  key: number
  props?: Prop[]
}

// Debout, de profil, bras le long du corps.
const STAND: Pose = { torso: 180, armL: 4, foreL: 2, armR: -4, foreR: -2, legL: 4, shinL: 2, legR: -4, shinR: -2 }
const stand = (o: Partial<Pose> = {}): Pose => ({ ...STAND, ...o })

// À quatre pattes (chat-vache, rotation thoracique).
const FOURS: Pose = { torso: -90, armL: 2, foreL: 0, armR: -2, foreR: 0, legL: 2, shinL: 90, legR: -2, shinR: 88 }
const fours = (o: Partial<Pose> = {}): Pose => ({ ...FOURS, ...o })

// Planche haute (pompes, mountain climbers).
const PLANK: Pose = { torso: -102, armL: 2, foreL: 0, armR: -2, foreR: 0, legL: 80, shinL: 80, legR: 82, shinR: 82 }
const plank = (o: Partial<Pose> = {}): Pose => ({ ...PLANK, ...o })

const SQUAT_MID = { legL: -40, shinL: 20, legR: -45, shinR: 18 }
const SQUAT_LOW = { legL: -82, shinL: 28, legR: -86, shinR: 25 }

export const MOTIONS: Record<string, Motion> = {
  squat: {
    duration: 2.6, key: 2,
    poses: [
      stand(),
      stand({ torso: 200, armL: -75, foreL: -80, armR: -80, foreR: -85, ...SQUAT_MID }),
      stand({ torso: 215, armL: -88, foreL: -90, armR: -92, foreR: -92, ...SQUAT_LOW }),
    ],
  },
  'fente-avant': {
    duration: 2.6, key: 1,
    poses: [
      stand(),
      stand({ legR: -75, shinR: 5, legL: 25, shinL: 85, armL: 10, foreL: 5, armR: -10, foreR: -5 }),
    ],
  },
  pompes: {
    duration: 2.4, key: 0, props: ['mat'],
    poses: [
      plank(),
      plank({ torso: -94, legL: 86, shinL: 86, legR: 87, shinR: 87, armL: 125, foreL: -25, armR: 120, foreR: -30 }),
    ],
  },
  'pont-fessier': {
    duration: 2.8, key: 1, props: ['mat'],
    poses: [
      { torso: 86, armL: -88, foreL: -88, armR: -86, foreR: -86, legL: -130, shinL: 2, legR: -134, shinR: 0 },
      { torso: 70, armL: -100, foreL: -100, armR: -98, foreR: -98, legL: -108, shinL: 22, legR: -112, shinR: 20 },
    ],
  },
  'gainage-planche': {
    duration: 3.2, key: 0, props: ['mat'],
    poses: [
      { torso: -97, armL: 2, foreL: -90, armR: -2, foreR: -92, legL: 84, shinL: 84, legR: 85, shinR: 85 },
      { torso: -100, armL: 4, foreL: -90, armR: 0, foreR: -92, legL: 82, shinL: 82, legR: 83, shinR: 83 },
    ],
  },
  superman: {
    duration: 2.8, key: 1, props: ['mat'],
    poses: [
      { torso: -90, armL: -90, foreL: -90, armR: -92, foreR: -92, legL: 90, shinL: 90, legR: 88, shinR: 88 },
      { torso: -102, armL: -110, foreL: -114, armR: -112, foreR: -116, legL: 80, shinL: 74, legR: 78, shinR: 72 },
    ],
  },
  'squat-goblet': {
    duration: 2.8, key: 2, props: ['dumbbells'],
    poses: [
      stand({ armL: -18, foreL: -165, armR: -22, foreR: -168 }),
      stand({ torso: 198, armL: -35, foreL: -175, armR: -40, foreR: -178, ...SQUAT_MID }),
      stand({ torso: 212, armL: -50, foreL: 175, armR: -55, foreR: 172, ...SQUAT_LOW }),
    ],
  },
  'rowing-haltere': {
    duration: 2.4, key: 1, props: ['dumbbells'],
    poses: [
      stand({ torso: -125, armL: 2, foreL: 0, armR: -2, foreR: 0, legL: -12, shinL: 10, legR: -16, shinR: 8 }),
      stand({ torso: -125, armL: 2, foreL: 0, armR: 72, foreR: 2, legL: -12, shinL: 10, legR: -16, shinR: 8 }),
    ],
  },
  'developpe-epaules': {
    duration: 2.4, key: 1, props: ['dumbbells'],
    poses: [
      stand({ armL: -25, foreL: 172, armR: -30, foreR: 175 }),
      stand({ armL: 176, foreL: 178, armR: 178, foreR: 180 }),
    ],
  },
  'tirage-elastique': {
    duration: 2.4, key: 1, props: ['band'],
    poses: [
      stand({ armL: -88, foreL: -88, armR: -92, foreR: -92, legL: -4, shinL: 6, legR: -8, shinR: 4 }),
      stand({ armL: 22, foreL: -86, armR: 18, foreR: -90, legL: -4, shinL: 6, legR: -8, shinR: 4 }),
    ],
  },
  'jumping-jacks': {
    duration: 1.1, key: 1,
    poses: [
      stand({ armL: 12, foreL: 8, armR: -12, foreR: -8, legL: 6, shinL: 4, legR: -6, shinR: -4 }),
      stand({ armL: 150, foreL: 165, armR: -150, foreR: -165, legL: 28, shinL: 24, legR: -28, shinR: -24, lift: 3 }),
    ],
  },
  'montees-genoux': {
    duration: 1.1, key: 0, sequence: [0, 1],
    poses: [
      stand({ torso: 182, legR: -95, shinR: 0, legL: 2, shinL: 2, armR: 35, foreR: -40, armL: -40, foreL: -150 }),
      stand({ torso: 182, legL: -95, shinL: 0, legR: 2, shinR: 2, armL: 35, foreL: -40, armR: -40, foreR: -150 }),
    ],
  },
  'mountain-climbers': {
    duration: 1.1, key: 0, sequence: [0, 1], props: ['mat'],
    poses: [
      plank({ torso: -106, legR: -55, shinR: 50, legL: 78, shinL: 78 }),
      plank({ torso: -106, legL: -55, shinL: 50, legR: 78, shinR: 78 }),
    ],
  },
  burpees: {
    duration: 3.4, key: 2, sequence: [0, 1, 2, 1, 3],
    poses: [
      stand(),
      stand({ torso: 235, armL: 2, foreL: 0, armR: -2, foreR: 0, legL: -80, shinL: 30, legR: -84, shinR: 28 }),
      plank(),
      stand({ armL: 172, foreL: 176, armR: 176, foreR: 180, lift: 8 }),
    ],
  },
  'pas-chasses': {
    duration: 1.6, key: 0,
    poses: [
      stand({ armL: 30, foreL: 20, armR: -30, foreR: -20, legL: 18, shinL: 16, legR: -18, shinR: -16 }),
      stand({ armL: 10, foreL: 6, armR: -10, foreR: -6, legL: 3, shinL: 2, legR: -3, shinR: -2, x: 6 }),
    ],
  },
  'chat-vache': {
    duration: 4, key: 0, props: ['mat'],
    poses: [fours({ torso: -97 }), fours({ torso: -82 })],
  },
  'posture-enfant': {
    duration: 4.5, key: 0, props: ['mat'],
    poses: [
      { torso: -72, armL: -88, foreL: -88, armR: -90, foreR: -90, legL: -55, shinL: 90, legR: -57, shinR: 88 },
      { torso: -80, armL: -84, foreL: -86, armR: -86, foreR: -88, legL: -55, shinL: 90, legR: -57, shinR: 88 },
    ],
  },
  'fente-basse-etirement': {
    duration: 4, key: 1, props: ['mat'],
    poses: [
      stand({ torso: 195, armL: -30, foreL: -20, armR: -34, foreR: -24, legR: -75, shinR: 5, legL: 40, shinL: 88 }),
      stand({ torso: 172, armL: 178, foreL: 180, armR: 176, foreR: 178, legR: -70, shinR: 8, legL: 46, shinL: 90 }),
    ],
  },
  'rotation-thoracique': {
    duration: 3.6, key: 1, props: ['mat'],
    poses: [fours(), fours({ armR: 178, foreR: 180 })],
  },
  'course-facile': {
    duration: 0.9, key: 0, sequence: [0, 1],
    poses: [
      stand({ torso: 188, legR: -40, shinR: 15, legL: 30, shinL: 75, armR: 35, foreR: -50, armL: -35, foreL: -120, lift: 2 }),
      stand({ torso: 188, legL: -40, shinL: 15, legR: 30, shinR: 75, armL: 35, foreL: -50, armR: -35, foreR: -120, lift: 2 }),
    ],
  },
  fractionne: {
    duration: 0.7, key: 0, sequence: [0, 1],
    poses: [
      stand({ torso: 195, legR: -60, shinR: 20, legL: 45, shinL: 100, armR: 50, foreR: -60, armL: -50, foreL: -130, lift: 4 }),
      stand({ torso: 195, legL: -60, shinL: 20, legR: 45, shinR: 100, armL: 50, foreL: -60, armR: -50, foreR: -130, lift: 4 }),
    ],
  },
}

/** Mouvement d'un exercice (debout immobile si l'exercice n'a pas de figurine dédiée). */
export function motionFor(id: string): Motion {
  return MOTIONS[id] ?? { duration: 2, key: 0, poses: [STAND] }
}
