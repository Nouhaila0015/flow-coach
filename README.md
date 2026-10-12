# Flow Coach

Coach sportif personnel, en local. Chaque séance est générée le jour même à partir de l'énergie, du temps disponible, du matériel, de la phase du cycle (calculée à partir des règles notées), de l'envie du jour et de l'historique. La séance continue de s'adapter pendant qu'on la fait.

Aucune donnée ne sort du PC : pas de compte, pas d'IA, pas d'API externe. Flow Coach ne remplace pas un avis médical.

## Fonctionnalités

- **Profil et cycle** : assistant de démarrage, suivi des règles, phase du jour calculée (aucune prédiction).
- **Check-in du jour** : énergie, temps, lieu et envie, puis séance générée avec l'explication « Pourquoi cette séance ? ».
- **Séance guidée** : un exercice à la fois, figurine animée, minuteur, boutons « Trop dur », « Trop facile » et « Passer ».
- **Fin de séance** : difficulté ressentie (RPE), commentaire, progression des cibles par exercice.
- **Historique** : liste filtrable, détail de chaque séance, suppression.
- **Tableau de bord** : régularité, volume, énergie et RPE par phase, progression par exercice.
- **Bibliothèque** : 21 exercices avec figurines animées, consignes et variantes.

Le détail des règles et des contraintes est dans [CLAUDE.md](CLAUDE.md) (la conception de l'app).

## Prérequis

- Node.js 24 ou plus récent (le BFF utilise le module intégré `node:sqlite`).
- macOS ou Linux pour les scripts `.sh`.

## Lancer l'app

```sh
./start.sh   # construit si besoin, puis lance l'app en arrière-plan
./stop.sh    # arrête l'app
./build.sh   # réinstalle les dépendances et reconstruit le front et le BFF
```

L'app est disponible sur **http://localhost:4200**. Un seul processus sert l'API et le front buildé. Les journaux sont écrits dans `flow-coach.log`.

Après une modification du code, relance `./build.sh`, puis `./stop.sh` et `./start.sh`.

## Développement

Dans deux terminaux :

```sh
cd back && npm install && npm run dev    # BFF sur le port 4200, rechargé à chaque modification
cd front && npm install && npm run dev   # front Vite, les appels /api sont transmis au BFF
```

Tests du BFF :

```sh
cd back && npm test
```

Il n'y a pas de tests automatisés côté front.

## Configuration

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `4200` | Port d'écoute du BFF |
| `FLOW_COACH_DB` | `back/data/flow-coach.db` | Fichier de la base SQLite |

La base est créée et migrée au démarrage, et les exercices y sont chargés automatiquement. Pour repartir de zéro, arrête l'app et supprime `back/data/`.

## Structure

```
flow-coach/
├── CLAUDE.md        conception de l'app (features, règles, contraintes)
├── back/            BFF : Node, Express, TypeScript, SQLite
│   └── src/
│       ├── rules.ts         règles et seuils du coach, centralisés
│       ├── engine.ts        moteur de génération des séances
│       ├── cycle.ts         calcul de la phase du cycle
│       ├── progression.ts   progression et ajustements en cours de séance
│       └── *.ts             routes de l'API (profil, règles, séances, historique, stats)
├── front/           front : React, Vite, TypeScript
│   └── src/
│       ├── pages/           une page par écran
│       ├── components/      composants partagés, figurines, graphiques SVG
│       └── figures/         squelette et poses des figurines
└── build.sh, start.sh, stop.sh
```

Le front n'appelle que son BFF (préfixe `/api`). Les règles du coach se règlent dans `back/src/rules.ts`.
