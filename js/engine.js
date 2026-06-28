import { byCouche } from './data.js';
import {
  addLog, addItem, removeItem, hasItems, getEmployee, isEmployeeFree,
  rollNextClientTime,
} from './state.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function activeRecipes(state) {
  return byCouche(state.data.recettes.recettes).filter((r) =>
    state.secteursDebloques.has(r.secteur_id));
}

export function activeDestinations(state) {
  return byCouche(state.data.missions_recolte.destinations);
}

export function activeGrades(state) {
  return byCouche(state.data.employes.grades_recrutement);
}

export function unlockedSecteurs(state) {
  return byCouche(state.data.secteurs.secteurs).filter((s) => state.secteursDebloques.has(s.id));
}

export function lockableSecteurs(state) {
  return byCouche(state.data.secteurs.secteurs).filter((s) => !state.secteursDebloques.has(s.id));
}

export function secteurUnlockCost(state, secteurId) {
  const secteur = state.data.secteurs.secteurs.find((s) => s.id === secteurId);
  const salle = state.data.salles.types_salles.find((s) => s.id === secteur?.salle_privilegiee_id);
  return salle ? salle.cout_construction : 0;
}

export function unlockSecteur(state, secteurId) {
  const secteur = state.data.secteurs.secteurs.find((s) => s.id === secteurId);
  if (!secteur || state.secteursDebloques.has(secteurId)) return false;
  const cout = secteurUnlockCost(state, secteurId);
  if (state.money < cout) return false;
  state.money -= cout;
  state.secteursDebloques.add(secteurId);
  const salle = state.data.salles.types_salles.find((s) => s.id === secteur.salle_privilegiee_id);
  state.rooms.push({ id: `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`, typeId: salle.id, objects: [] });
  addLog(state, `🏗️ Secteur "${secteur.nom}" débloqué (construction : ${salle?.nom}, ${cout} pièces).`);
  return true;
}

function roomType(state, typeId) {
  return state.data.salles.types_salles.find((t) => t.id === typeId);
}

export function builtRooms(state) {
  return state.rooms.map((room) => ({ room, type: roomType(state, room.typeId) }));
}

export function buildableRoomTypes(state) {
  return byCouche(state.data.salles.types_salles).filter((t) =>
    !t.secteur_associe_id || state.secteursDebloques.has(t.secteur_associe_id));
}

export function buildRoom(state, typeId) {
  const type = roomType(state, typeId);
  if (!type) return false;
  if (type.secteur_associe_id && !state.secteursDebloques.has(type.secteur_associe_id)) return false;
  if (state.money < type.cout_construction) return false;
  state.money -= type.cout_construction;
  state.rooms.push({ id: `room_${Date.now()}_${Math.floor(Math.random() * 1000)}`, typeId, objects: [] });
  addLog(state, `🏛️ Nouvelle salle construite : ${type.nom} (${type.cout_construction} pièces).`);
  return true;
}

export function activeDecorations(state) {
  return byCouche(state.data.objets_decoration.objets);
}

export function decorateRoom(state, roomId, objectId) {
  const room = state.rooms.find((r) => r.id === roomId);
  const type = room && roomType(state, room.typeId);
  const obj = state.data.objets_decoration.objets.find((o) => o.id === objectId);
  if (!room || !type || !obj) return false;
  if (room.objects.length >= type.slots_decoration) return false;
  if (state.money < obj.cout) return false;
  state.money -= obj.cout;
  room.objects.push(objectId);
  addLog(state, `🪄 ${obj.nom} installé dans ${type.nom} (${obj.cout} pièces).`);
  return true;
}

export function removeDecoration(state, roomId, index) {
  const room = state.rooms.find((r) => r.id === roomId);
  if (!room || index < 0 || index >= room.objects.length) return false;
  room.objects.splice(index, 1);
  addLog(state, '🧹 Objet de décoration retiré.');
  return true;
}

export function roomAmbiance(state, room) {
  const regles = state.data.salles.regles_ambiance;
  const scores = {};
  room.objects.forEach((objId) => {
    const obj = state.data.objets_decoration.objets.find((o) => o.id === objId);
    obj?.tags_ambiance.forEach(({ tag, poids }) => { scores[tag] = (scores[tag] || 0) + poids; });
  });
  const dominant = Object.entries(scores)
    .filter(([, score]) => score >= regles.seuil_dominance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, regles.max_tags_dominants_simultanes)
    .map(([tag]) => tag);
  return { scores, dominant };
}

function roomModifiers(state, room, recipe) {
  const type = roomType(state, room.typeId);
  const regles = state.data.salles.regles_ambiance;
  const malusInfo = state.data.salles.malus_hors_salle_specialisee;
  const { dominant } = roomAmbiance(state, room);
  const matches = recipe.tags_ambiance.filter((t) => dominant.includes(t)).length;
  const bonusQualite = matches * regles.bonus_par_tag_correspondant.bonus_qualite;
  const bonusVitessePct = matches * regles.bonus_par_tag_correspondant.bonus_vitesse_pourcent;
  const horsSpecialite = type.secteur_associe_id !== recipe.secteur_id;
  const malusQualite = horsSpecialite ? malusInfo.malus_qualite : 0;
  const malusVitessePct = horsSpecialite ? malusInfo.malus_vitesse_pourcent : 0;
  return { qualiteDelta: bonusQualite + malusQualite, vitessePct: bonusVitessePct + malusVitessePct, matches, dominant };
}

export function specialiteForSecteur(state, secteurId) {
  return state.data.employes.specialites.find((s) => s.secteur_id === secteurId);
}

function malusHorsSpecialite(emp, recipe) {
  if (emp.isPlayer) return 0;
  if (!emp.secteur_id) return 0;
  return emp.secteur_id === recipe.secteur_id ? 0 : 2;
}

function vitesseMultiplicateur(emp, recipe) {
  const malus = emp.secteur_id && emp.secteur_id !== recipe.secteur_id ? -0.2 : 0;
  return 1 - malus;
}

export function startProduction(state, recipeId, employeeId, roomId) {
  const recipe = state.data.recettes.recettes.find((r) => r.id === recipeId);
  const emp = getEmployee(state, employeeId);
  const room = state.rooms.find((r) => r.id === roomId);
  if (!recipe || !emp || !room || !isEmployeeFree(emp)) return false;
  if (!hasItems(state, recipe.ingredients_requis)) return false;

  recipe.ingredients_requis.forEach((r) => removeItem(state, r.ingredient_id, r.quantite));

  const { vitessePct } = roomModifiers(state, room, recipe);
  const tempsReel = recipe.temps_base_secondes
    * (1 - (emp.qualite - 5) * 0.05)
    * vitesseMultiplicateur(emp, recipe)
    * (1 - vitessePct / 100);

  const job = {
    id: `prod_${recipeId}_${state.timeSeconds}`,
    recipeId,
    employeeId,
    roomId,
    startedAt: state.timeSeconds,
    endsAt: state.timeSeconds + Math.max(5, tempsReel),
  };
  emp.busy = { type: 'production', jobId: job.id };
  state.productionJobs.push(job);
  return true;
}

function finishProduction(state, job) {
  const recipe = state.data.recettes.recettes.find((r) => r.id === job.recipeId);
  const emp = getEmployee(state, job.employeeId);
  const room = state.rooms.find((r) => r.id === job.roomId);
  if (!emp) return;

  const regles = state.data.employes.regles_progression_qualite;
  const malus = malusHorsSpecialite(emp, recipe);
  const { qualiteDelta } = room ? roomModifiers(state, room, recipe) : { qualiteDelta: 0 };
  const qualiteResultat = clamp(emp.qualite - malus + qualiteDelta, 1, 10);
  const succes = qualiteResultat >= recipe.seuil_reussite_min;
  const memeSecteur = !emp.isPlayer && emp.secteur_id === recipe.secteur_id;

  if (succes) {
    state.products = state.products || {};
    state.products[recipe.id] = (state.products[recipe.id] || 0) + 1;
    if (memeSecteur) {
      emp.qualite = clamp(emp.qualite + regles.gain_par_tache_reussie_dans_specialite, regles.qualite_min, regles.qualite_max);
    }
    addLog(state, `✅ ${emp.nom} a produit avec succès : ${recipe.nom}.`);
  } else {
    if (memeSecteur) {
      emp.qualite = clamp(emp.qualite - regles.perte_par_tache_ratee_dans_specialite, regles.qualite_min, regles.qualite_max);
    }
    addLog(state, `❌ ${emp.nom} a raté la production de ${recipe.nom} (ingrédients perdus).`);
    addLog(state, `   ↳ ${diagnosticEchec(state, emp, recipe, malus, qualiteResultat, room)}`);
  }
  emp.busy = null;
}

function diagnosticEchec(state, emp, recipe, malus, qualiteResultat, room) {
  const manque = (recipe.seuil_reussite_min - qualiteResultat).toFixed(1);
  if (malus > 0) {
    return `Cause probable : ${emp.nom} travaille hors de sa spécialité (-${malus} qualité). `
      + `Confiez plutôt cette recette à un(e) spécialiste du secteur "${recipe.secteur_id}".`;
  }
  if (room) {
    const type = roomType(state, room.typeId);
    if (type.secteur_associe_id && type.secteur_associe_id !== recipe.secteur_id) {
      return `Cause probable : production hors de la salle spécialisée (${type.nom} ne convient pas au secteur "${recipe.secteur_id}"). `
        + `Construisez ou utilisez une salle adaptée.`;
    }
  }
  return `Cause probable : qualité insuffisante (manque ${manque} point(s) par rapport au seuil de ${recipe.seuil_reussite_min}). `
    + `Laissez l'employé progresser, décorez la salle pour un bonus d'ambiance, ou confiez la recette à quelqu'un de plus expérimenté.`;
}

export function sellProduct(state, recipeId, qty = 1) {
  state.products = state.products || {};
  const recipe = state.data.recettes.recettes.find((r) => r.id === recipeId);
  const have = state.products[recipeId] || 0;
  if (!recipe || have < qty) return false;
  state.products[recipeId] -= qty;
  state.money += recipe.prix_vente_base * qty;
  addLog(state, `💰 Vendu ${qty}x ${recipe.nom} pour ${recipe.prix_vente_base * qty} pièces.`);
  return true;
}

export function buyIngredient(state, ingredientId, qty = 1) {
  const ing = state.data.ingredients.ingredients.find((i) => i.id === ingredientId);
  if (!ing) return false;
  const cost = ing.prix_marche_unitaire * qty;
  if (state.money < cost) return false;
  state.money -= cost;
  addItem(state, ingredientId, qty);
  addLog(state, `🛒 Acheté ${qty}x ${ing.nom} pour ${cost} pièces.`);
  return true;
}

export function hireEmployee(state, gradeId, secteurId) {
  const grade = state.data.employes.grades_recrutement.find((g) => g.id === gradeId);
  const specialite = specialiteForSecteur(state, secteurId);
  if (!grade || !specialite || !state.secteursDebloques.has(secteurId)) return false;
  if (state.money < grade.cout_recrutement) return false;
  state.money -= grade.cout_recrutement;
  const qualite = grade.qualite_depart_min
    + Math.random() * (grade.qualite_depart_max - grade.qualite_depart_min);
  const secteur = state.data.secteurs.secteurs.find((s) => s.id === secteurId);
  const emp = {
    id: `emp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    nom: `${grade.nom} (${secteur.nom}) #${state.employees.length}`,
    isPlayer: false,
    specialite_id: specialite.id,
    secteur_id: secteurId,
    grade_id: grade.id,
    qualite,
    salaire: grade.salaire_base,
    busy: null,
  };
  state.employees.push(emp);
  addLog(state, `🧑‍🎓 Nouveau ${grade.nom} (${secteur.nom}) embauché (qualité ${qualite.toFixed(1)}).`);
  return true;
}

export function startHarvest(state, destinationId, employeeId) {
  const dest = state.data.missions_recolte.destinations.find((d) => d.id === destinationId);
  const emp = getEmployee(state, employeeId);
  if (!dest || !emp || !isEmployeeFree(emp)) return false;

  const job = {
    id: `harvest_${destinationId}_${state.timeSeconds}`,
    destinationId,
    employeeId,
    startedAt: state.timeSeconds,
    endsAt: state.timeSeconds + dest.duree_secondes,
  };
  emp.busy = { type: 'mission', jobId: job.id };
  state.harvestJobs.push(job);
  return true;
}

function pickReportMessage(state, issue, employeNom) {
  const pool = state.data.missions_recolte.messages_rapport[issue];
  const text = pool[Math.floor(Math.random() * pool.length)];
  return text.replace('{employe}', employeNom);
}

function finishHarvest(state, job) {
  const dest = state.data.missions_recolte.destinations.find((d) => d.id === job.destinationId);
  const emp = getEmployee(state, job.employeeId);
  if (!dest || !emp) return;

  const riskReel = clamp(dest.risque_base - (emp.qualite - 5) * 0.04, 0.02, 0.9);
  const r = Math.random();
  let issue;
  if (r < riskReel * 0.5) issue = 'echec_avec_incident';
  else if (r < riskReel) issue = 'echec_sans_perte';
  else if (r < riskReel + (1 - riskReel) * 0.6) issue = 'succes_partiel';
  else issue = 'succes_total';

  if (issue === 'succes_total' || issue === 'succes_partiel') {
    const facteur = (1 + (emp.qualite - 5) * 0.08) * (issue === 'succes_partiel' ? 0.5 : 1);
    dest.table_butin.forEach((entry) => {
      if (Math.random() <= entry.probabilite) {
        const qty = Math.max(1, Math.round(entry.quantite_base * facteur));
        addItem(state, entry.ingredient_id, qty);
      }
    });
  }

  addLog(state, pickReportMessage(state, issue, emp.nom));

  if (issue === 'echec_avec_incident') {
    emp.busy = { type: 'recovery', untilTime: state.timeSeconds + 60 };
  } else {
    emp.busy = null;
  }
}

export function tick(state, dtSeconds) {
  if (state.paused) return;
  state.timeSeconds += dtSeconds;

  state.productionJobs = state.productionJobs.filter((job) => {
    if (state.timeSeconds >= job.endsAt) { finishProduction(state, job); return false; }
    return true;
  });

  state.harvestJobs = state.harvestJobs.filter((job) => {
    if (state.timeSeconds >= job.endsAt) { finishHarvest(state, job); return false; }
    return true;
  });

  state.employees.forEach((emp) => {
    if (emp.busy?.type === 'recovery' && state.timeSeconds >= emp.busy.untilTime) {
      emp.busy = null;
    }
  });

  if (!state.pendingClient) {
    state.nextClientAt -= dtSeconds;
    if (state.nextClientAt <= 0) triggerClientMission(state);
  }
}

export function triggerClientMission(state) {
  const missions = byCouche(state.data.clients_missions.missions);
  if (missions.length === 0) return;
  const missionDef = missions[Math.floor(Math.random() * missions.length)];
  state.pendingClient = { missionDef, currentKey: 'intro' };
  state.paused = true;
  state.forcedPause = true;
}

export function currentClientNode(state) {
  const { missionDef, currentKey } = state.pendingClient;
  return currentKey === 'intro' ? missionDef.intro : missionDef.noeuds[currentKey];
}

export function availableOptions(state) {
  const node = currentClientNode(state);
  return node.options.filter((opt) =>
    !opt.requiert_secteur_debloque || state.secteursDebloques.has(opt.requiert_secteur_debloque));
}

function applyReputationForIssue(state, issue) {
  const gains = state.data.economie.reputation.gains;
  const map = {
    succes_total: gains.succes_total,
    succes_partiel: gains.succes_partiel,
    succes_total_chance: gains.succes_chance,
    succes_court_terme: gains.succes_partiel,
    echec_diagnostic_errone: gains.echec_diagnostic_errone,
    echec_sans_consequence: gains.echec_sans_consequence,
  };
  const delta = map[issue] ?? 0;
  const rep = state.data.economie.reputation;
  state.reputation = clamp(state.reputation + delta, rep.valeur_min, rep.valeur_max);
  return delta;
}

function finalizeClientMission(state, consequence) {
  const recipe = state.data.recettes.recettes.find((r) => r.id === consequence.produit_requis_id);
  state.products = state.products || {};
  const have = recipe ? (state.products[recipe.id] || 0) : 0;
  let issue = consequence.issue;

  if (recipe && have > 0) {
    state.products[recipe.id] -= 1;
    state.money += recipe.prix_vente_base;
    addLog(state, `🤝 Client servi (${issue}) : ${recipe.nom} vendu pour ${recipe.prix_vente_base} pièces.`);
  } else if (recipe) {
    issue = 'echec_sans_consequence';
    addLog(state, `⚠️ Vous n'aviez pas "${recipe.nom}" en stock, le client repart les mains vides.`);
  }

  const delta = applyReputationForIssue(state, issue);
  addLog(state, `${delta >= 0 ? '⭐' : '💔'} Réputation ${delta >= 0 ? '+' : ''}${delta}.`);

  state.pendingClient = null;
  state.forcedPause = false;
  state.paused = false;
  state.nextClientAt = rollNextClientTime(state.data.economie, state.reputation);
}

export function chooseClientOption(state, option) {
  const c = option.consequence;
  if (c.type === 'aller_a_noeud') {
    state.pendingClient.currentKey = c.noeud;
  } else if (c.type === 'lancer_divination') {
    const devins = state.employees.filter((e) => e.secteur_id === 'divination' && isEmployeeFree(e));
    const meilleur = devins.sort((a, b) => b.qualite - a.qualite)[0];
    const qualiteDevin = meilleur ? meilleur.qualite : state.employees.find((e) => e.isPlayer).qualite;
    const proba = clamp(0.3 + qualiteDevin * 0.07, 0.1, 0.95);
    state.pendingClient.currentKey = Math.random() < proba ? c.noeud_succes : c.noeud_echec;
  } else if (c.type === 'fin_mission') {
    finalizeClientMission(state, c);
  }
}

export function dailySalaries(state) {
  return state.employees.reduce((sum, e) => sum + (e.salaire || 0), 0);
}
