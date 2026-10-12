import { Router } from 'express';
import type { Db } from './db.js';
import { notFound } from './http.js';

export type SessionType = 'renfo' | 'cardio' | 'doux' | 'course';
export type ExerciseEquipment = 'none' | 'dumbbells' | 'band' | 'outdoor';
export type Zone = 'bas' | 'haut' | 'gainage' | 'corps';

export interface Exercise {
  id: string;
  name: string;
  type: SessionType;
  equipment: ExerciseEquipment;
  level: 1 | 2 | 3;
  impact: 'faible' | 'fort';
  zone: Zone;
  mode: 'reps' | 'time';
  perSide: boolean;
  /** Répétitions (mode reps) ou secondes (mode time), par niveau 1 → 3. */
  defaults: [number, number, number];
  /** Charge par défaut en kg, par niveau (exercices avec haltères). */
  defaultLoads: [number, number, number] | null;
  cues: [string, string, string];
  easier: string | null;
  harder: string | null;
  matAdvised: boolean;
}

type Seed = Omit<Exercise, 'perSide' | 'defaultLoads' | 'easier' | 'harder' | 'matAdvised'> &
  Partial<Pick<Exercise, 'perSide' | 'defaultLoads' | 'easier' | 'harder' | 'matAdvised'>>;

// Bibliothèque de départ (21 exercices), insérée au premier démarrage.
const SEED: Seed[] = [
  // Renfo au poids du corps
  {
    id: 'squat', name: 'Squat', type: 'renfo', equipment: 'none', level: 1, impact: 'faible', zone: 'bas',
    mode: 'reps', defaults: [10, 12, 15], harder: 'squat-goblet',
    cues: ['Pieds largeur d\'épaules, pointes légèrement ouvertes', 'Pousse les fesses en arrière, poids dans les talons', 'Dos droit, genoux dans l\'axe des pieds'],
  },
  {
    id: 'fente-avant', name: 'Fente avant', type: 'renfo', equipment: 'none', level: 1, impact: 'faible', zone: 'bas',
    mode: 'reps', perSide: true, defaults: [8, 10, 12], easier: 'squat',
    cues: ['Grand pas en avant, buste droit', 'Descends jusqu\'à frôler le sol avec le genou arrière', 'Repousse avec le talon avant pour revenir'],
  },
  {
    id: 'pompes', name: 'Pompes', type: 'renfo', equipment: 'none', level: 1, impact: 'faible', zone: 'haut',
    mode: 'reps', defaults: [6, 10, 15], matAdvised: true,
    cues: ['Mains sous les épaules, corps gainé', 'Version facile : genoux au sol', 'Descends la poitrine, coudes à 45°'],
  },
  {
    id: 'pont-fessier', name: 'Pont fessier', type: 'renfo', equipment: 'none', level: 1, impact: 'faible', zone: 'bas',
    mode: 'reps', defaults: [12, 15, 20], matAdvised: true,
    cues: ['Allongée sur le dos, pieds à plat près des fesses', 'Monte le bassin en serrant les fessiers', 'Redescends lentement sans poser les fesses'],
  },
  {
    id: 'gainage-planche', name: 'Gainage planche', type: 'renfo', equipment: 'none', level: 1, impact: 'faible', zone: 'gainage',
    mode: 'time', defaults: [25, 40, 60], matAdvised: true,
    cues: ['Avant-bras au sol, coudes sous les épaules', 'Corps aligné de la tête aux talons', 'Rentre le nombril et respire calmement'],
  },
  {
    id: 'superman', name: 'Superman', type: 'renfo', equipment: 'none', level: 1, impact: 'faible', zone: 'gainage',
    mode: 'reps', defaults: [10, 12, 15], matAdvised: true,
    cues: ['Allongée sur le ventre, bras tendus devant', 'Décolle bras et jambes en même temps', 'Regard vers le sol, nuque longue'],
  },
  // Renfo avec matériel
  {
    id: 'squat-goblet', name: 'Squat goblet', type: 'renfo', equipment: 'dumbbells', level: 1, impact: 'faible', zone: 'bas',
    mode: 'reps', defaults: [10, 12, 15], defaultLoads: [6, 8, 12], easier: 'squat',
    cues: ['Haltère contre la poitrine, coudes vers le bas', 'Pieds largeur d\'épaules, poids dans les talons', 'Descends hanches sous les genoux, dos droit'],
  },
  {
    id: 'rowing-haltere', name: 'Rowing haltère', type: 'renfo', equipment: 'dumbbells', level: 1, impact: 'faible', zone: 'haut',
    mode: 'reps', perSide: true, defaults: [10, 12, 12], defaultLoads: [4, 6, 8],
    cues: ['Buste penché, dos plat, genoux souples', 'Tire le coude vers la hanche', 'Redescends lentement, bras tendu'],
  },
  {
    id: 'developpe-epaules', name: 'Développé épaules', type: 'renfo', equipment: 'dumbbells', level: 1, impact: 'faible', zone: 'haut',
    mode: 'reps', defaults: [8, 10, 12], defaultLoads: [3, 5, 7],
    cues: ['Haltères à hauteur d\'épaules, paumes vers l\'avant', 'Pousse vers le plafond sans cambrer', 'Redescends en contrôlant'],
  },
  {
    id: 'tirage-elastique', name: 'Tirage élastique', type: 'renfo', equipment: 'band', level: 1, impact: 'faible', zone: 'haut',
    mode: 'reps', defaults: [12, 15, 15],
    cues: ['Élastique accroché devant toi, bras tendus', 'Tire les coudes vers l\'arrière, omoplates serrées', 'Reviens lentement en gardant la tension'],
  },
  // Cardio / HIIT
  {
    id: 'jumping-jacks', name: 'Jumping jacks', type: 'cardio', equipment: 'none', level: 1, impact: 'fort', zone: 'corps',
    mode: 'time', defaults: [30, 40, 45], easier: 'pas-chasses', harder: 'burpees',
    cues: ['Saute en écartant bras et jambes', 'Reviens pieds joints, bras le long du corps', 'Atterris en douceur sur l\'avant du pied'],
  },
  {
    id: 'montees-genoux', name: 'Montées de genoux', type: 'cardio', equipment: 'none', level: 1, impact: 'fort', zone: 'corps',
    mode: 'time', defaults: [30, 40, 45], easier: 'pas-chasses', harder: 'mountain-climbers',
    cues: ['Monte les genoux à hauteur de hanches', 'Bras qui accompagnent le mouvement', 'Reste sur l\'avant des pieds'],
  },
  {
    id: 'mountain-climbers', name: 'Mountain climbers', type: 'cardio', equipment: 'none', level: 2, impact: 'faible', zone: 'corps',
    mode: 'time', defaults: [25, 35, 45], easier: 'pas-chasses', harder: 'burpees', matAdvised: true,
    cues: ['Position de pompe, mains sous les épaules', 'Ramène un genou vers la poitrine, puis l\'autre', 'Bassin bas, rythme régulier'],
  },
  {
    id: 'burpees', name: 'Burpees', type: 'cardio', equipment: 'none', level: 2, impact: 'fort', zone: 'corps',
    mode: 'time', defaults: [20, 30, 40], easier: 'mountain-climbers',
    cues: ['Accroupis-toi et pose les mains au sol', 'Saute les pieds en planche, puis reviens', 'Relève-toi en sautant, bras au ciel'],
  },
  {
    id: 'pas-chasses', name: 'Pas chassés', type: 'cardio', equipment: 'none', level: 1, impact: 'faible', zone: 'corps',
    mode: 'time', defaults: [30, 40, 45], harder: 'jumping-jacks',
    cues: ['Pas sur le côté, puis rejoins les pieds', 'Genoux souples, buste droit', 'Sans sauter : idéal à faible impact'],
  },
  // Mobilité / yoga
  {
    id: 'chat-vache', name: 'Chat-vache', type: 'doux', equipment: 'none', level: 1, impact: 'faible', zone: 'corps',
    mode: 'time', defaults: [45, 60, 60], matAdvised: true,
    cues: ['À quatre pattes, mains sous les épaules', 'Inspire : creuse le dos, regard devant', 'Expire : arrondis le dos, menton vers la poitrine'],
  },
  {
    id: 'posture-enfant', name: 'Posture de l\'enfant', type: 'doux', equipment: 'none', level: 1, impact: 'faible', zone: 'corps',
    mode: 'time', defaults: [45, 60, 60], matAdvised: true,
    cues: ['Assise sur les talons, genoux écartés', 'Allonge les bras devant, front au sol', 'Respire lentement dans le dos'],
  },
  {
    id: 'fente-basse-etirement', name: 'Fente basse d\'étirement', type: 'doux', equipment: 'none', level: 1, impact: 'faible', zone: 'bas',
    mode: 'time', perSide: true, defaults: [30, 45, 45], matAdvised: true,
    cues: ['Genou arrière au sol, pied avant devant', 'Avance doucement le bassin', 'Bras vers le ciel pour étirer l\'avant de la hanche'],
  },
  {
    id: 'rotation-thoracique', name: 'Rotation thoracique', type: 'doux', equipment: 'none', level: 1, impact: 'faible', zone: 'haut',
    mode: 'time', perSide: true, defaults: [30, 40, 45], matAdvised: true,
    cues: ['À quatre pattes, une main au sol', 'Ouvre l\'autre bras vers le ciel en suivant du regard', 'Reviens lentement, sans bouger le bassin'],
  },
  // Course
  {
    id: 'course-facile', name: 'Course facile', type: 'course', equipment: 'outdoor', level: 1, impact: 'fort', zone: 'corps',
    mode: 'time', defaults: [300, 600, 900], harder: 'fractionne',
    cues: ['Allure où tu peux parler', 'Foulée courte, posture droite', 'Respire par le ventre'],
  },
  {
    id: 'fractionne', name: 'Fractionné', type: 'course', equipment: 'outdoor', level: 2, impact: 'fort', zone: 'corps',
    mode: 'time', defaults: [45, 60, 90], easier: 'course-facile',
    cues: ['Accélère franchement sur la durée d\'effort', 'Récupère en marchant ou trottinant', 'Garde des épaules relâchées'],
  },
];

interface ExerciseRow {
  id: string;
  name: string;
  type: SessionType;
  equipment: ExerciseEquipment;
  level: 1 | 2 | 3;
  impact: 'faible' | 'fort';
  zone: Zone;
  mode: 'reps' | 'time';
  per_side: number;
  defaults: string;
  default_loads: string | null;
  cues: string;
  easier: string | null;
  harder: string | null;
  mat_advised: number;
}

function fromRow(r: ExerciseRow): Exercise {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    equipment: r.equipment,
    level: r.level,
    impact: r.impact,
    zone: r.zone,
    mode: r.mode,
    perSide: r.per_side === 1,
    defaults: JSON.parse(r.defaults),
    defaultLoads: r.default_loads ? JSON.parse(r.default_loads) : null,
    cues: JSON.parse(r.cues),
    easier: r.easier,
    harder: r.harder,
    matAdvised: r.mat_advised === 1,
  };
}

/** Insère la bibliothèque de départ si la table est vide. */
export function seedExercises(db: Db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM exercises').get() as { n: number };
  if (n > 0) return;
  const insert = db.prepare(
    `INSERT INTO exercises (id, position, name, type, equipment, level, impact, zone, mode, per_side,
       defaults, default_loads, cues, easier, harder, mat_advised)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  SEED.forEach((e, i) =>
    insert.run(
      e.id, i, e.name, e.type, e.equipment, e.level, e.impact, e.zone, e.mode, e.perSide ? 1 : 0,
      JSON.stringify(e.defaults), e.defaultLoads ? JSON.stringify(e.defaultLoads) : null,
      JSON.stringify(e.cues), e.easier ?? null, e.harder ?? null, e.matAdvised ? 1 : 0,
    ),
  );
}

export function listExercises(db: Db): Exercise[] {
  return (db.prepare('SELECT * FROM exercises ORDER BY position').all() as unknown as ExerciseRow[]).map(fromRow);
}

export function getExercise(db: Db, id: string): Exercise | null {
  const row = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id) as ExerciseRow | undefined;
  return row ? fromRow(row) : null;
}

/** Meilleure performance réalisée sur un exercice (charge, puis répétitions ou durée). */
function bestPerformance(db: Db, id: string) {
  return (
    (db
      .prepare(
        `SELECT s.date, i.done_reps AS reps, i.done_duration AS duration, i.done_load AS load
         FROM session_items i JOIN sessions s ON s.id = i.session_id
         WHERE i.exercise_id = ? AND i.status = 'done'
         ORDER BY COALESCE(i.done_load, 0) DESC, COALESCE(i.done_reps, i.done_duration, 0) DESC, s.date DESC
         LIMIT 1`,
      )
      .get(id) as { date: string; reps: number | null; duration: number | null; load: number | null } | undefined) ?? null
  );
}

export function exercisesRouter(db: Db) {
  const r = Router();

  r.get('/exercises', (_req, res) => {
    res.json(listExercises(db));
  });

  r.get('/exercises/:id', (req, res) => {
    const exercise = getExercise(db, req.params.id);
    if (!exercise) throw notFound('Exercice introuvable');
    res.json({ ...exercise, best: bestPerformance(db, exercise.id) });
  });

  return r;
}
