import {
  activeRecipes, activeDestinations, activeGrades,
  startProduction, sellProduct, buyIngredient, hireEmployee, startHarvest,
  availableOptions, currentClientNode, chooseClientOption,
  unlockedSecteurs, lockableSecteurs, secteurUnlockCost, unlockSecteur,
  builtRooms, buildableRoomTypes, buildRoom, activeDecorations, decorateRoom, removeDecoration, roomAmbiance,
  marketPrice, reputationTier,
} from './engine.js';
import { isEmployeeFree } from './state.js';
import { COUCHE_ACTIVE, byCouche } from './data.js';

export function focusPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  panel.classList.add('panel-flash');
  setTimeout(() => panel.classList.remove('panel-flash'), 1200);
}

function el(tag, cls, html) {
  const e = document.createElement('div');
  if (tag) e.className = cls || '';
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function freeEmployeeOptions(state, secteurId) {
  return state.employees.filter((e) => isEmployeeFree(e));
}

export function render(state) {
  document.getElementById('money').textContent = Math.floor(state.money);
  document.getElementById('reputation').textContent = Math.round(state.reputation);
  const tier = reputationTier(state.reputation);
  document.getElementById('reputation-tier').textContent = `(${tier.nom})`;

  const eco = state.data.economie.temps;
  const dayLen = eco.duree_jour_secondes;
  const day = Math.floor(state.timeSeconds / dayLen) + 1;
  const secIntoDay = state.timeSeconds % dayLen;
  const hh = String(Math.floor((secIntoDay / dayLen) * 24)).padStart(2, '0');
  const mm = String(Math.floor(((secIntoDay / dayLen) * 24 * 60) % 60)).padStart(2, '0');
  document.getElementById('day').textContent = day;
  document.getElementById('clock').textContent = `${hh}:${mm}`;

  document.querySelectorAll('[data-speed]').forEach((btn) => {
    btn.classList.toggle('active-speed', Number(btn.dataset.speed) === state.speed && !state.paused);
  });
  document.getElementById('pauseBtn').textContent = state.paused ? '▶' : '⏸';

  renderSectors(state);
  renderRecipes(state);
  renderEmployees(state);
  renderHarvest(state);
  renderRooms(state);
  renderMarket(state);
  renderLog(state);
  renderClientModal(state);
}

function renderSectors(state) {
  const root = document.getElementById('sector-list');
  root.innerHTML = '';

  unlockedSecteurs(state).forEach((secteur) => {
    root.appendChild(el('div', 'card-row', `<span>✅ ${secteur.nom}</span><span class="muted">débloqué</span>`));
  });

  lockableSecteurs(state).forEach((secteur) => {
    const cout = secteurUnlockCost(state, secteur.id);
    const salle = state.data.salles.types_salles.find((s) => s.id === secteur.salle_privilegiee_id);
    const card = el('div', 'card', `
      <div class="card-row"><span class="card-title">🔒 ${secteur.nom}</span><span class="muted">${cout}p</span></div>
      <div class="muted">${secteur.description}</div>
      <div class="muted">Construit : ${salle?.nom}</div>
    `);
    const btn = document.createElement('button');
    btn.textContent = 'Débloquer';
    btn.disabled = state.money < cout;
    btn.onclick = () => { unlockSecteur(state, secteur.id); render(state); };
    card.appendChild(btn);
    root.appendChild(card);
  });
}

function renderRecipes(state) {
  const root = document.getElementById('recipes');
  root.innerHTML = '';
  const freeEmployees = freeEmployeeOptions(state);
  activeRecipes(state).forEach((recipe) => {
    const card = el('div', 'card');
    const ingredientsTxt = recipe.ingredients_requis
      .map((r) => `${r.quantite}x ${state.data.ingredients.ingredients.find((i) => i.id === r.ingredient_id)?.nom}`)
      .join(', ');
    const have = (state.products || {})[recipe.id] || 0;

    const needed = recipe.necessite_employes_simultanes || 1;

    card.innerHTML = `
      <div class="card-row">
        <span class="card-title">${recipe.nom}</span>
        <span class="muted">vente ${recipe.prix_vente_base}p · stock ${have}</span>
      </div>
      <div class="muted">Besoin : ${ingredientsTxt}${needed > 1 ? ` · ${needed} employés simultanés` : ''}</div>
      <div>${recipe.tags_ambiance.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
    `;

    const row = el('div', 'card-row');
    const employeeSelects = [];
    for (let i = 0; i < needed; i += 1) {
      const select = document.createElement('select');
      freeEmployees.forEach((emp) => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = `${emp.nom} (q${emp.qualite.toFixed(1)})`;
        select.appendChild(opt);
      });
      employeeSelects.push(select);
    }
    const roomSelect = document.createElement('select');
    builtRooms(state).forEach(({ room, type }) => {
      const { dominant } = roomAmbiance(state, room);
      const opt = document.createElement('option');
      opt.value = room.id;
      opt.textContent = `${type.nom}${dominant.length ? ` [${dominant.join(', ')}]` : ''}`;
      roomSelect.appendChild(opt);
    });
    const craftBtn = document.createElement('button');
    craftBtn.textContent = 'Produire';
    craftBtn.disabled = freeEmployees.length < needed;
    craftBtn.onclick = () => {
      startProduction(state, recipe.id, employeeSelects.map((s) => s.value), roomSelect.value);
      render(state);
    };

    const sellBtn = document.createElement('button');
    sellBtn.textContent = 'Vendre 1';
    sellBtn.disabled = have === 0;
    sellBtn.onclick = () => { sellProduct(state, recipe.id, 1); render(state); };

    row.append(...employeeSelects, roomSelect, craftBtn, sellBtn);
    card.appendChild(row);
    root.appendChild(card);
  });

  document.querySelectorAll('#prod-jobs').forEach((n) => n.remove());
  if (state.productionJobs.length) {
    const jobsBox = el('div', '', '<h3>En production</h3>');
    jobsBox.id = 'prod-jobs';
    state.productionJobs.forEach((job) => {
      const recipe = state.data.recettes.recettes.find((r) => r.id === job.recipeId);
      const noms = job.employeeIds.map((id) => state.employees.find((e) => e.id === id)?.nom).join(', ');
      const pct = Math.min(100, ((state.timeSeconds - job.startedAt) / (job.endsAt - job.startedAt)) * 100);
      const card = el('div', 'card', `
        <div class="card-row"><span>${recipe.nom}</span><span class="muted">${noms}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      `);
      jobsBox.appendChild(card);
    });
    document.getElementById('recipes').appendChild(jobsBox);
  }
}

function renderEmployees(state) {
  const list = document.getElementById('employee-list');
  list.innerHTML = '';
  state.employees.forEach((emp) => {
    const status = emp.isPlayer ? '' : emp.busy
      ? (emp.busy.type === 'recovery' ? '🩹 en convalescence' : '⏳ occupé')
      : '✅ disponible';
    const card = el('div', 'card', `
      <div class="card-row"><span class="card-title">${emp.nom}</span><span class="muted">qualité ${emp.qualite.toFixed(1)}</span></div>
      <div class="muted">${emp.specialite_id || 'sorcier polyvalent'} ${status}</div>
    `);
    list.appendChild(card);
  });

  const recruit = document.getElementById('recruit-list');
  recruit.innerHTML = '';
  const secteursDisponibles = unlockedSecteurs(state);
  activeGrades(state).forEach((grade) => {
    const card = el('div', 'card', `
      <div class="card-row">
        <span class="card-title">${grade.nom}</span>
        <span class="muted">coût ${grade.cout_recrutement}p · salaire ${grade.salaire_base}p/j</span>
      </div>
      <div class="muted">Qualité de départ ${grade.qualite_depart_min}–${grade.qualite_depart_max}</div>
    `);
    const row = el('div', 'card-row');
    const select = document.createElement('select');
    secteursDisponibles.forEach((secteur) => {
      const opt = document.createElement('option');
      opt.value = secteur.id;
      opt.textContent = secteur.nom;
      select.appendChild(opt);
    });
    const btn = document.createElement('button');
    btn.textContent = 'Embaucher';
    btn.disabled = state.money < grade.cout_recrutement || secteursDisponibles.length === 0;
    btn.onclick = () => { hireEmployee(state, grade.id, select.value); render(state); };
    row.append(select, btn);
    card.appendChild(row);
    recruit.appendChild(card);
  });
}

function renderHarvest(state) {
  const root = document.getElementById('harvest-list');
  root.innerHTML = '';
  const freeEmployees = freeEmployeeOptions(state);
  activeDestinations(state).forEach((dest) => {
    const card = el('div', 'card', `
      <div class="card-row"><span class="card-title">${dest.nom}</span><span class="muted">${dest.duree_secondes}s</span></div>
      <div class="muted">${dest.description}</div>
    `);
    const row = el('div', 'card-row');
    const select = document.createElement('select');
    freeEmployees.forEach((emp) => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = `${emp.nom} (q${emp.qualite.toFixed(1)})`;
      select.appendChild(opt);
    });
    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Envoyer';
    sendBtn.disabled = freeEmployees.length === 0;
    sendBtn.onclick = () => { startHarvest(state, dest.id, select.value); render(state); };
    row.append(select, sendBtn);
    card.appendChild(row);
    root.appendChild(card);
  });

  const active = document.getElementById('harvest-active');
  active.innerHTML = '';
  state.harvestJobs.forEach((job) => {
    const dest = state.data.missions_recolte.destinations.find((d) => d.id === job.destinationId);
    const emp = state.employees.find((e) => e.id === job.employeeId);
    const pct = Math.min(100, ((state.timeSeconds - job.startedAt) / (job.endsAt - job.startedAt)) * 100);
    const card = el('div', 'card', `
      <div class="card-row"><span>${dest.nom}</span><span class="muted">${emp?.nom}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    `);
    active.appendChild(card);
  });
}

function renderRooms(state) {
  const root = document.getElementById('room-list');
  root.innerHTML = '';
  const decorations = activeDecorations(state);

  builtRooms(state).forEach(({ room, type }) => {
    const { scores, dominant } = roomAmbiance(state, room);
    const card = el('div', 'card');
    const tagsTxt = Object.keys(scores).length
      ? Object.entries(scores).map(([tag, score]) =>
          `<span class="tag${dominant.includes(tag) ? ' tag-dominant' : ''}">${tag} (${score})</span>`).join('')
      : '<span class="muted">aucune ambiance</span>';

    card.innerHTML = `
      <div class="card-row"><span class="card-title">${type.nom}</span><span class="muted">${room.objects.length}/${type.slots_decoration} déco</span></div>
      <div class="muted">Secteur : ${type.secteur_associe_id || 'générique'}</div>
      <div>${tagsTxt}</div>
    `;

    if (room.objects.length) {
      const objList = el('div', '');
      room.objects.forEach((objId, idx) => {
        const obj = state.data.objets_decoration.objets.find((o) => o.id === objId);
        const objRow = el('div', 'card-row', `<span>${obj?.nom || objId}</span>`);
        const rmBtn = document.createElement('button');
        rmBtn.textContent = 'Retirer';
        rmBtn.onclick = () => { removeDecoration(state, room.id, idx); render(state); };
        objRow.appendChild(rmBtn);
        objList.appendChild(objRow);
      });
      card.appendChild(objList);
    }

    if (room.objects.length < type.slots_decoration && decorations.length) {
      const addRow = el('div', 'card-row');
      const select = document.createElement('select');
      decorations.forEach((obj) => {
        const opt = document.createElement('option');
        opt.value = obj.id;
        opt.textContent = `${obj.nom} (${obj.cout}p)`;
        select.appendChild(opt);
      });
      const addBtn = document.createElement('button');
      addBtn.textContent = 'Installer';
      addBtn.onclick = () => { decorateRoom(state, room.id, select.value); render(state); };
      addRow.append(select, addBtn);
      card.appendChild(addRow);
    }

    root.appendChild(card);
  });

  const buildRoot = document.getElementById('room-build-list');
  buildRoot.innerHTML = '';
  buildableRoomTypes(state).forEach((type) => {
    const card = el('div', 'card', `
      <div class="card-row"><span class="card-title">${type.nom}</span><span class="muted">${type.cout_construction}p</span></div>
      <div class="muted">Secteur : ${type.secteur_associe_id || 'générique'} · ${type.slots_decoration} slots déco</div>
    `);
    const btn = document.createElement('button');
    btn.textContent = 'Construire';
    btn.disabled = state.money < type.cout_construction;
    btn.onclick = () => { buildRoom(state, type.id); render(state); };
    card.appendChild(btn);
    buildRoot.appendChild(card);
  });
}

function renderMarket(state) {
  const root = document.getElementById('market-list');
  root.innerHTML = '';
  byCouche(state.data.ingredients.ingredients, COUCHE_ACTIVE)
    .filter((i) => i.sources.includes('marche'))
    .forEach((ing) => {
      const prix = marketPrice(state, ing.id);
      const card = el('div', 'card-row', `<span>${ing.nom}</span><span class="muted">${prix}p</span>`);
      const btn = document.createElement('button');
      btn.textContent = 'Acheter x1';
      btn.disabled = state.money < prix;
      btn.onclick = () => { buyIngredient(state, ing.id, 1); render(state); };
      card.appendChild(btn);
      root.appendChild(card);
    });

  const inv = document.getElementById('inventory-list');
  inv.innerHTML = '';
  const entries = Object.entries(state.inventory).filter(([, qty]) => qty > 0);
  if (entries.length === 0) inv.innerHTML = '<div class="muted">Stock vide.</div>';
  entries.forEach(([id, qty]) => {
    const ing = state.data.ingredients.ingredients.find((i) => i.id === id);
    inv.appendChild(el('div', 'card-row', `<span>${ing?.nom || id}</span><span class="muted">x${qty}</span>`));
  });
}

function renderLog(state) {
  const root = document.getElementById('log-list');
  root.innerHTML = '';
  state.log.slice(-50).forEach((line) => root.appendChild(el('div', '', line)));
}

function renderClientModal(state) {
  const modal = document.getElementById('client-modal');
  if (!state.pendingClient) { modal.classList.add('hidden'); return; }
  modal.classList.remove('hidden');

  const tierTxt = state.pendingClient.tier ? ` (${state.pendingClient.tier.nom})` : '';
  document.getElementById('client-title').textContent = `${state.pendingClient.missionDef.nom}${tierTxt}`;
  const node = currentClientNode(state);
  document.getElementById('client-text').textContent = node.texte;

  const optionsRoot = document.getElementById('client-options');
  optionsRoot.innerHTML = '';
  availableOptions(state).forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt.texte;
    btn.onclick = () => { chooseClientOption(state, opt); render(state); };
    optionsRoot.appendChild(btn);
  });
}
