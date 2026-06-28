const FILES = [
  'secteurs', 'employes', 'ingredients', 'recettes', 'salles',
  'objets_decoration', 'missions_recolte', 'clients_missions', 'economie'
];

export async function loadData() {
  const entries = await Promise.all(
    FILES.map(async (name) => {
      const res = await fetch(`data/${name}.json`);
      if (!res.ok) throw new Error(`Impossible de charger data/${name}.json`);
      return [name, await res.json()];
    })
  );
  return Object.fromEntries(entries);
}

// Couche 3 (Salles et décoration) : on filtre tout le contenu prévu pour plus tard.
export const COUCHE_ACTIVE = 3;

export function byCouche(list, max = COUCHE_ACTIVE) {
  return list.filter((item) => (item.couche ?? 1) <= max);
}
