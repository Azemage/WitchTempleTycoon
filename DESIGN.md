# Sorcier Tycoon — Document de Design

## Pitch

Un jeu de gestion en 2D (vue plan/dessus, façon Game Dev Tycoon) où le joueur
incarne un sorcier qui développe son atelier/temple. Il peut se spécialiser
dans plusieurs domaines (potions, sorts, baguettes, talismans, divination...),
embaucher d'autres magiciens spécialisés, et doit répondre à des demandes de
clients qui nécessitent parfois du diagnostic (divination) avant d'agir.

Inspirations : Game Dev Tycoon (boucle de gestion, secteurs, recherche),
Fallout Shelter (assistants envoyés en mission, rapport au retour),
jeux de gestion de taverne (récolte d'ingrédients, artisanat par étapes).

## Boucle de jeu

- **Temps réel avec pause.** Le jeu tourne en continu (production, clients qui
  arrivent, assistants en mission qui avancent).
- **Pause narrative forcée.** Certains événements (client qui arrive, attaque
  spirituelle, incident) interrompent le temps réel et ouvrent une séquence de
  dialogue à choix. Le joueur choisit des options (parfois après une étape de
  divination), puis le temps réel reprend.
- **Hors événement = temps libre.** Le joueur gère son atelier, ses employés,
  ses salles, ses recherches, ses stocks.

## Piliers de gameplay

1. **Secteurs de production** (potions, sorts, baguettes, talismans, divination,
   rituels...) — chacun a ses propres recettes, ingrédients, temps de
   production, niveau de difficulté.
2. **Employés hybrides** — spécialité fixe à l'embauche (ex: "Potionniste"),
   mais une statistique de **qualité** qui progresse lentement avec
   l'expérience/le temps (pas un vrai système XP/niveaux RPG, plus un
   glissement progressif borné).
3. **Salles modulaires** — chaque type de salle a un nombre de cases au sol
   fixe et prédéterminé à la construction. Le joueur **décore** ensuite la
   salle avec des objets ayant des **tags d'ambiance** (ex: "séduction",
   "ténèbres", "nature", "précision"). Une recette qui partage des tags avec
   l'ambiance dominante de la salle obtient un bonus de qualité/vitesse.
4. **Missions de récolte façon Fallout Shelter** — on envoie un assistant
   (employé ou recrue dédiée) chercher des ingrédients. On ne contrôle pas le
   trajet : on choisit qui part, où, avec quel équipement, puis on attend un
   rapport de mission (succès/échec partiel/échec, butin, incidents).
5. **Missions clients narratives** — un client arrive (pause forcée), expose
   un besoin, le joueur peut/doit passer par une étape de diagnostic
   (divination) puis choisir une réponse. Mauvais diagnostic ou mauvais choix
   = conséquences cohérentes (client mécontent, effet secondaire, retour
   plus tard).

## Construction par couches

On documente le système complet dans les JSON dès maintenant, mais on
construit **couche par couche**, chaque couche étant un jeu jouable de bout
en bout.

### Couche 1 — Noyau jouable
- 1 secteur complet : **Potions**
- 1 sorcier joueur + jusqu'à 2 employés embauchables
- 1 salle de base (pas de décoration encore, juste les 4 murs et la
  production)
- Missions de récolte simplifiées (texte + temps + rapport, pas de carte)
- Missions clients narratives basiques (dialogue à choix, divination simple
  = un seul jet/probabilité, pas un mini-jeu)
- Économie minimale : argent, réputation, temps qui passe

### Couche 2 — Extension des secteurs
- Ajout des secteurs : Sorts, Baguettes, Talismans, Divination (en tant que
  secteur de production, pas juste mécanique de diagnostic)
- Plus d'employés, plus de recettes, arbre de débogage des recettes ratées

### Couche 3 — Salles et décoration
- Construction de nouvelles salles (cases au sol prédéterminées)
- Système de décoration : objets, tags d'ambiance, calcul de bonus
- Une salle spécialisée et bien décorée surclasse la salle générique

### Couche 4 — Profondeur
- Recherche/déblocage de nouvelles recettes
- Progression de la qualité des employés affinée
- Événements spéciaux, incidents, clients récurrents, réputation qui influence
  le type de clients qui arrivent

### Couches suivantes (à définir après la couche 4)
- Carte d'exploration réelle pour les missions de récolte (au lieu de
  texte/temps)
- Concurrence, autres ateliers
- À réévaluer avec le joueur/designer après retour sur les couches 1-4.

## Convention des fichiers JSON

Chaque fichier de `data/` est une **bibliothèque de définitions** (pas de
sauvegarde de partie). Claude Code doit lire ces fichiers comme la source de
vérité du contenu du jeu, et écrire le moteur de jeu (logique, état, UI)
autour. Les fichiers utilisent des `id` en `snake_case` stables, référencés
entre fichiers (ex: une recette référence des `ingredient_id`).

Champ `couche` présent sur la plupart des entrées : indique à partir de quelle
couche de construction cet élément doit être actif. Permet à Claude Code de
filtrer facilement ce qui est "actif" en V1 vs prévu pour plus tard.

## Fichiers de données

- `secteurs.json` — les domaines de spécialisation (potions, sorts...)
- `employes.json` — types de magiciens recrutables, spécialités, courbes de
  qualité
- `ingredients.json` — matières premières, rareté, sources
- `recettes.json` — quoi produire, avec quoi, combien de temps, quel secteur
- `salles.json` — types de salles, taille, cases au sol, slots de déco
- `objets_decoration.json` — meubles/objets, tags d'ambiance, coût
- `missions_recolte.json` — missions d'envoi d'assistants, durées, risques
- `clients_missions.json` — trame narrative des demandes clients, embranchements
- `economie.json` — prix de base, salaires, réputation, paramètres globaux
