# Flow Coach — conception

Coach sportif hyper-personnalisé, à usage personnel. Chaque séance est générée le jour même à partir de :
- mon énergie ;
- mon temps disponible ;
- mon matériel ;
- ma phase de cycle, calculée à partir de mes règles notées ;
- mon envie du jour ;
- mon historique.

Il n'y a pas de plan figé, et la séance continue de s'adapter pendant que je la fais.

## Décisions techniques

- Front : React + Vite (TypeScript), dossier `front/`.
- BFF : Node + Express (TypeScript), dossier `back/`. Il sert aussi le front buildé (un seul processus, un seul port).
- Stockage : SQLite côté BFF (`back/data/flow-coach.db`, via le module intégré `node:sqlite`, sans dépendance native). Aucune donnée ne sort du PC.
- Pas de SAR pour l'instant : le moteur de génération et le calcul du cycle restent dans le BFF.
- Port fixe : **4200** (http://localhost:4200). Le port 4100 est déjà pris par `budget`.
- Un seul utilisateur, pas de compte ni d'authentification (usage local).
- Ordinateur d'abord : mise en page pensée pour 1280 px et plus, utilisable jusqu'à 1024 px. Pas de version mobile dédiée.
- Pas d'IA ni d'API externe : la génération repose sur des **règles déterministes** et une **bibliothèque d'exercices** stockée en base.
- Avertissement visible dans le profil et dans le pied de page : « Flow Coach ne remplace pas un avis médical. »

## Design

Style **doux et apaisant**, un seul thème clair :

- Fond crème `#FBF7F4`, cartes blanches, texte principal prune foncé `#3E3A4A`.
- Accent lavande `#9C8BC9` (boutons principaux, navigation active).
- Une couleur pastel par phase du cycle, réutilisée partout (pastilles, frise, graphiques) :
  - menstruelle : rose poudré `#E8B4BC` ;
  - folliculaire : sauge `#A8C5B5` ;
  - ovulatoire : pêche `#F4C7AB` ;
  - lutéale : lavande claire `#C9BEE6`.
- Une couleur par type de séance : renfo (lavande), cardio/HIIT (pêche), mobilité/yoga (sauge), course (bleu ciel `#B5D3E7`).
- Arrondis généreux (16 px pour les cartes, boutons en forme de pilule), ombres très légères.
- Police : Nunito, embarquée localement (pas d'appel à Google Fonts).
- Navigation : barre latérale à gauche avec Aujourd'hui · Cycle · Historique · Tableau de bord · Bibliothèque · Profil.

## Features

### 1. Profil (premier lancement)
- Au premier lancement, l'app ouvre l'assistant de démarrage en 2 étapes : le **Profil**, puis le **Cycle** (feature 2).
- Champs du profil :
  - **objectif principal** : force, endurance, perte de poids, **prise de poids / muscle** ou bien-être ;
  - **niveau de départ** : débutante, intermédiaire ou avancée ;
  - **matériel possédé** (cases à cocher) : haltères, élastiques, tapis, accès à une salle ;
  - **séances visées par semaine** : de 1 à 7 ;
  - **durée habituelle des règles** : 5 jours par défaut, de 2 à 10 jours.
- Ces champs restent modifiables à tout moment depuis la page Profil.
- Contraintes :
  - tous les champs sont obligatoires, sinon le bouton « Continuer » ou « Enregistrer » reste désactivé ;
  - le matériel coché limite les lieux proposés au check-in.

### 2. Suivi du cycle (page Cycle)
- **Initialisation**, à l'étape 2 de l'assistant : je saisis la **date de début de mes 3 dernières règles**. Les 3 dates sont obligatoires pour accéder au reste de l'app.
- **Ensuite** : à chaque nouvelle période, je note moi-même la date de début :
  - via le bouton « 🩸 Mes règles ont commencé » sur la page Aujourd'hui (date du jour par défaut, modifiable vers une date passée) ;
  - ou depuis la page Cycle.
- **Aucune estimation des règles** : l'app ne prédit jamais la date des prochaines règles et n'en ajoute jamais toute seule. Seules les dates que j'ai saisies existent.
- **Calcul de la phase du jour** (côté BFF). On appelle J1 le jour de début des dernières règles notées :
  - **durée moyenne du cycle** = moyenne des écarts entre mes débuts de règles consécutifs réellement notés (au maximum les 6 derniers cycles), arrondie au jour ;
  - jour d'ovulation théorique : **O = durée moyenne − 14** ;
  - **menstruelle** : de J1 à J(durée des règles) ;
  - **folliculaire** : du jour suivant la fin des règles jusqu'à J(O−2) ;
  - **ovulatoire** : de J(O−1) à J(O+1) ;
  - **lutéale** : de J(O+2) jusqu'à ce que je note les règles suivantes. Si elles sont en retard par rapport à la moyenne, on reste en lutéale : rien n'est prédit.
  - Cycles courts : si les règles empiètent sur la fenêtre folliculaire, la phase menstruelle est prioritaire.
- **Page Cycle** :
  - phase actuelle et jour du cycle (ex. « J18 · lutéale ») ;
  - frise du cycle en cours, colorée par phase, avec un repère sur aujourd'hui (la frise s'arrête à aujourd'hui, sans projection) ;
  - durée moyenne des cycles, cycle le plus court et le plus long (pour voir l'irrégularité) ;
  - liste des débuts de règles notés (date, longueur du cycle qui suit), avec modification et suppression (confirmation demandée).
- Contraintes :
  - pas de date dans le futur ;
  - pas de doublon ;
  - deux débuts espacés de moins de 15 jours demandent une confirmation (avertissement, pas de blocage) ;
  - modifier ou supprimer une date recalcule les phases, mais les séances passées gardent la phase enregistrée à leur check-in ;
  - la phase est **uniquement calculée** : aucune saisie ni correction manuelle au check-in.

### 3. Check-in du jour (page Aujourd'hui)
- Formulaire rapide, en une seule carte :
  - **énergie** : de 1 à 5, avec 5 boutons-emojis (😴 🥱 🙂 😊 ⚡) ;
  - **temps disponible** : 10, 20, 30, 45 ou 60 min ;
  - **lieu et matériel** : maison sans matériel, maison avec matériel, salle ou extérieur (seules les options compatibles avec le profil sont proposées) ;
  - **phase du cycle** : affichée en lecture seule (pastille de couleur et « J18 · lutéale »), calculée par la feature 2 ;
  - **envie du jour** : renfo, cardio/HIIT, doux (mobilité/yoga), course ou « laisse le coach décider » (valeur par défaut).
- Bouton « Générer ma séance ».
- La page Aujourd'hui affiche aussi :
  - le bouton « 🩸 Mes règles ont commencé » ;
  - un rappel de la semaine (séances faites par rapport à l'objectif, par exemple 2/3) ;
  - la dernière séance (date, type, RPE).
- Contraintes :
  - un seul check-in « actif » par jour : refaire un check-in remplace la séance non commencée du jour ;
  - une séance terminée n'est jamais écrasée (on peut faire 2 séances dans la même journée) ;
  - noter des règles le jour même recalcule la phase affichée, avant la génération de la séance.

### 4. Moteur de génération (BFF, règles)
Entrées : check-in du jour, phase calculée, profil et historique. Sortie : une séance structurée, accompagnée d'une explication.

1. **Type de séance**
   - Si une envie est donnée, on la respecte. Si l'énergie vaut 1 et que l'envie est cardio, renfo ou course, on garde le type mais on affiche un conseil (« Énergie basse : une séance douce serait aussi une bonne option ») avec un bouton pour basculer en séance douce.
   - Si on laisse le coach décider, on lit la table suivante, puis on corrige selon l'objectif :

     | Énergie \ Phase | Menstruelle | Folliculaire | Ovulatoire | Lutéale |
     |---|---|---|---|---|
     | 1–2 | doux | doux | doux | doux |
     | 3 | doux | renfo | renfo | renfo |
     | 4–5 | renfo | renfo / cardio | cardio / renfo | renfo |

   - Correction selon l'objectif :
     - endurance ou perte de poids : quand la case propose deux types, on privilégie cardio (ou course si le lieu est l'extérieur) ;
     - force : on privilégie renfo ;
     - prise de poids / muscle : on privilégie renfo, et cardio est remplacé par renfo dès que l'énergie est d'au moins 3 (on limite la dépense pour favoriser la prise de masse) ;
     - bien-être : on prend le type le moins fait sur les 7 derniers jours.
   - Lieu « extérieur » : renfo devient renfo au poids du corps, et cardio devient course quand l'énergie est de 3 ou plus.
2. **Intensité** (basse, modérée ou haute)
   - score = énergie + modificateur de phase : menstruelle −1, lutéale −0,5, folliculaire 0, ovulatoire +0,5.
   - Correspondance : score ≤ 2 → basse ; score de 2,5 à 3,5 → modérée ; score ≥ 4 → haute.
   - L'intensité règle le temps de travail et de repos (basse : 30 s / 30 s, modérée : 40 s / 20 s, haute : 45 s / 15 s) ainsi que le nombre de répétitions cibles.
   - Objectif prise de poids / muscle : en renfo, format séries et répétitions (de 8 à 12 répétitions, 60 à 90 s de repos), plutôt qu'un circuit chronométré.
3. **Structure selon le temps disponible**
   - Échauffement : 15 % du temps (minimum 2 min).
   - Corps de séance : le temps restant après l'échauffement et le retour au calme.
   - Retour au calme : 10 % du temps (minimum 1 min).
   - Nombre d'exercices et de tours : calculés pour remplir le corps de séance (10 min ≈ 3 exercices × 2 tours ; 60 min ≈ 6 exercices × 4 tours).
   - Course : blocs marche/course (intensité basse), course continue facile (modérée) ou fractionné (haute).
4. **Choix des exercices**
   - On filtre par type, par matériel disponible pour le lieu choisi, et on exclut ce qui dépasse le niveau du profil.
   - Phase menstruelle avec une énergie ≤ 3 : on exclut les exercices à fort impact (sauts).
   - Variété : on évite les exercices faits lors des 2 dernières séances quand une alternative existe.
   - Équilibre en renfo : on alterne bas du corps, haut du corps et gainage.
5. **Charge par exercice** : répétitions, durée et charge partent de la dernière performance enregistrée pour cet exercice (feature 7). Sans historique, on part de la valeur par défaut liée au niveau.
6. **Explication « Pourquoi cette séance ? »** : 2 ou 3 phrases générées par les règles. Exemple : « J18, phase lutéale, énergie 3/5 : intensité modérée. Tu as demandé du renfo : focus bas du corps, pas fait depuis 4 jours. »
- Contraintes :
  - le moteur est **déterministe** : les mêmes entrées et le même historique donnent la même séance ;
  - un bouton « Une autre proposition » change les exercices (on passe à la variante suivante) sans changer type ni intensité ;
  - les règles et les seuils sont centralisés dans un seul fichier de configuration côté BFF, pour pouvoir les ajuster facilement.

### 5. Aperçu de la séance
- Affiche :
  - le type, l'intensité, la durée totale estimée et la phase ;
  - l'explication « Pourquoi cette séance ? » ;
  - la liste des blocs (échauffement, corps, retour au calme), avec pour chaque exercice sa miniature (figurine fixe), ses répétitions ou sa durée, et sa charge.
- Boutons : « Commencer », « Une autre proposition », « Modifier mon check-in ».

### 6. Séance guidée (avec adaptation en temps réel)
- Affiche un seul exercice à la fois :
  - **figurine animée** en grand, qui montre le mouvement en boucle (voir feature 10) ;
  - nom, consignes clés (3 points maximum), répétitions ou durée cibles, charge ;
  - indicateur de progression (exercice 4/12, tour 2/3) et temps écoulé.
- **Minuteur** :
  - compte à rebours pour l'effort puis pour le repos, avec un bip doux à la fin de chaque phase ;
  - exercices en répétitions : pas de compte à rebours d'effort, un bouton « Fait » passe au repos.
- Pendant le repos, l'exercice suivant est annoncé (avec sa figurine animée).
- **Saisie des performances** : pour les exercices en répétitions, on saisit (ou valide en un clic) les répétitions faites et la charge utilisée.
- **Boutons d'adaptation** :
  - « Trop dur » : les exercices restants sont allégés (−20 % de répétitions ou de durée, +15 s de repos ; variante plus facile si elle existe dans la bibliothèque). Message : « C'est noté, j'allège la suite. » ;
  - « Trop facile » : l'inverse (+15 % de répétitions ou de durée, −10 s de repos avec 10 s minimum ; variante plus difficile si elle existe) ;
  - les ajustements se cumulent, dans une limite de ±2 crans.
- Autres boutons : « Passer » (exercice marqué comme sauté), « Pause / Reprendre » (met aussi l'animation en pause), « Terminer maintenant ».
- Contraintes :
  - les ajustements sont recalculés **côté BFF** (appel API), puis le front met à jour la suite de la séance ;
  - fermer ou quitter la page en cours de séance enregistre la séance comme « interrompue », avec les exercices déjà faits ;
  - le minuteur doit rester juste même si l'onglet passe en arrière-plan (on calcule à partir d'horodatages, pas en comptant des ticks).

### 7. Fin de séance, feedback et progression
- Écran de fin :
  - récapitulatif : durée réelle, exercices faits, sautés, ajustements ;
  - **RPE** (difficulté ressentie, de 1 à 10) obligatoire ;
  - commentaire libre facultatif.
- **Règles de progression**, appliquées à chaque exercice à la séance suivante :
  - RPE ≤ 5 et toutes les répétitions cibles atteintes : +10 % de répétitions ou de durée (ou +1 kg si une charge est utilisée) ;
  - RPE entre 6 et 8 : on garde la cible, ou +5 % si l'exercice a été marqué « trop facile » ;
  - RPE ≥ 9, ou exercice marqué « trop dur » : −10 % ;
  - exercice sauté : cible inchangée.
  - Objectif prise de poids / muscle : on privilégie la hausse de charge (+1 kg) dès que le haut de la fourchette (12 répétitions) est atteint, puis on repart à 8 répétitions.
- Contraintes :
  - la progression est calculée et enregistrée par exercice ;
  - une séance interrompue ne fait pas progresser les cibles, mais elle compte dans l'historique.

### 8. Historique
- Liste des séances, de la plus récente à la plus ancienne. Pour chacune : date, type (pastille de couleur), durée, intensité, phase (et jour du cycle), énergie, RPE et statut (terminée ou interrompue).
- Filtres : type de séance et phase.
- Le clic sur une séance ouvre son détail : check-in, exercices avec cible et réalisé, ajustements faits en cours de séance, commentaire.
- Suppression d'une séance, avec confirmation.

### 9. Tableau de bord
- Période sélectionnable : 4 semaines, 12 semaines ou tout.
- Indicateurs en haut :
  - séances cette semaine par rapport à l'objectif ;
  - série de semaines où l'objectif est atteint ;
  - minutes totales ;
  - RPE moyen.
- Graphiques :
  - **régularité** : séances par semaine (barres), avec la ligne d'objectif ;
  - **volume** : minutes par semaine, empilées par type de séance ;
  - **énergie et RPE moyens par phase du cycle** (barres groupées, couleurs des phases) ;
  - **progression par exercice** : on choisit un exercice dans une liste, puis on voit la courbe des répétitions, de la durée ou de la charge au fil des séances.
- Contrainte : graphiques en SVG, faits maison ou avec une petite librairie (Recharts), sans service externe.

### 10. Bibliothèque d'exercices et figurines animées
- Une vingtaine d'exercices (21), chargés au premier démarrage par un script de seed :
  - **Renfo au poids du corps** : squat, fente avant, pompes, pont fessier, gainage planche, superman.
  - **Renfo avec matériel** : squat goblet (haltère), rowing haltère, développé épaules (haltères), tirage élastique.
  - **Cardio/HIIT** : jumping jacks, montées de genoux, mountain climbers, burpees, pas chassés (sans impact).
  - **Mobilité/yoga** : chat-vache, posture de l'enfant, fente basse d'étirement, rotation thoracique.
  - **Course** : course facile, fractionné.
- Chaque exercice est décrit par :
  - nom, type, matériel requis, niveau (1 à 3), impact (faible ou fort), zone (bas du corps, haut du corps, gainage, corps entier) ;
  - mode (répétitions ou durée), cibles par défaut selon le niveau, consignes (3 points) ;
  - variante plus facile et variante plus difficile (facultatives) ;
  - figurine animée.
- **Figurines** :
  - **silhouette neutre arrondie** : formes douces et pleines, tête ronde, membres épais aux bouts arrondis, sans genre marqué ;
  - aplats pastel selon le type d'exercice ;
  - faites maison en SVG et embarquées dans le front.
- **Animation** :
  - la figurine est articulée (groupes SVG imbriqués : tronc, bras, avant-bras, cuisses, jambes, haltère éventuelle) ;
  - chaque exercice définit **2 ou 3 poses clés** (ex. squat : debout → mi-descente → accroupie) ;
  - une animation CSS en boucle (`@keyframes` sur les rotations des articulations, environ 2 à 3 s par cycle, `ease-in-out`) enchaîne les poses en douceur.
  - Où l'animation apparaît :
    - **animée** dans la séance guidée et sur la fiche exercice ;
    - **fixe** (pose clé principale) dans les listes, l'aperçu et les miniatures.
  - Si le système demande de réduire les animations (`prefers-reduced-motion`), on affiche les poses clés côte à côte, fixes.
- Page Bibliothèque :
  - grille de cartes, avec filtres par type et par matériel ;
  - le clic sur une carte ouvre une fiche avec la figurine animée en grand, les poses clés, les consignes, les variantes et ma meilleure performance.
- Contrainte : la bibliothèque est en lecture seule dans l'interface pour cette version.

### 11. Persistance et API
- Tables SQLite :
  - `profile` ;
  - `periods` : date de début de chaque période de règles ;
  - `exercises` ;
  - `checkins` : avec la phase et le jour du cycle calculés, figés au moment du check-in ;
  - `sessions` : statut, durée, RPE, commentaire ;
  - `session_items` : exercice, cible, réalisé, sauté, ajustements ;
  - `exercise_progress` : cible courante par exercice.
- API REST (préfixe `/api`) :
  - `GET/PUT /profile` ;
  - `GET /periods`, `POST /periods` avec `{ startDate }`, `PUT /periods/:id`, `DELETE /periods/:id` ;
  - `GET /cycle/today` : phase, jour du cycle, durée moyenne, plus court et plus long cycle ;
  - `GET /exercises`, `GET /exercises/:id` ;
  - `POST /checkins` : crée le check-in et renvoie la séance générée ;
  - `POST /sessions/:id/regenerate` : « Une autre proposition » ;
  - `POST /sessions/:id/start` ;
  - `POST /sessions/:id/adjust` avec `{ itemId, feedback: "too_hard" | "too_easy" | "skip" }` : renvoie la suite recalculée ;
  - `PUT /sessions/:id/items/:itemId` : enregistre le réalisé ;
  - `POST /sessions/:id/finish` avec `{ rpe, comment, status }` : applique la progression ;
  - `GET /sessions` (filtres), `GET /sessions/:id`, `DELETE /sessions/:id` ;
  - `GET /stats?period=4w|12w|all`.
- Contraintes :
  - toutes les écritures sont validées côté BFF (bornes : énergie de 1 à 5, RPE de 1 à 10, dates de règles pas dans le futur, etc.) ;
  - la base est créée et migrée automatiquement au démarrage.

## Hors périmètre (cette version)
- Comptes, multi-utilisateurs, synchronisation ou cloud.
- Prédiction des prochaines règles, notifications, suivi des symptômes.
- Saisie ou correction manuelle de la phase.
- Version mobile dédiée, PWA.
- Ajout ou édition d'exercices depuis l'interface.
- Génération par IA.
