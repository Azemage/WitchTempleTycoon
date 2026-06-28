let nextId = 1;
export function uid(prefix) { return `${prefix}_${nextId++}`; }

export function createInitialState(data) {
  const eco = data.economie;
  const startSector = eco.demarrage.secteur_debloque_depart;

  return {
    data,
    money: eco.demarrage.argent_depart,
    reputation: eco.reputation.valeur_depart,
    secteursDebloques: new Set(startSector),
    timeSeconds: 0,
    speed: 1,
    paused: false,

    employees: [
      {
        id: 'player',
        nom: 'Vous (le sorcier)',
        isPlayer: true,
        specialite_id: null,
        secteur_id: null,
        qualite: data.employes.employe_joueur.qualite_depart_tous_secteurs,
        busy: null,
      },
    ],

    inventory: {},

    rooms: [
      { id: 'room_start', typeId: eco.demarrage.salle_depart_id, objects: [] },
    ],

    productionJobs: [],
    harvestJobs: [],

    pendingClient: null,
    nextClientAt: rollNextClientTime(eco, eco.reputation.valeur_depart),

    log: [],
  };
}

export function rollNextClientTime(eco, reputation) {
  const r = eco.reputation;
  const intervalle = Math.min(180, Math.max(30, 180 - reputation * 1.2));
  // varie un peu autour de l'intervalle moyen pour éviter le côté trop mécanique
  const jitter = intervalle * (0.5 + Math.random());
  return jitter;
}

export function addLog(state, message) {
  state.log.push(message);
  if (state.log.length > 200) state.log.shift();
}

export function getEmployee(state, id) {
  return state.employees.find((e) => e.id === id);
}

export function isEmployeeFree(emp) {
  return !emp.busy;
}

export function addItem(state, ingredientId, qty) {
  state.inventory[ingredientId] = (state.inventory[ingredientId] || 0) + qty;
}

export function removeItem(state, ingredientId, qty) {
  state.inventory[ingredientId] = Math.max(0, (state.inventory[ingredientId] || 0) - qty);
}

export function hasItems(state, requis) {
  return requis.every((r) => (state.inventory[r.ingredient_id] || 0) >= r.quantite);
}
