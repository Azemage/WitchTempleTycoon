import { loadData } from './data.js';
import { createInitialState, addLog } from './state.js';
import { tick, dailySalaries } from './engine.js';
import { render, focusPanel } from './ui.js';
import { initTemple } from './templeScene.js';

async function main() {
  const data = await loadData();
  const state = createInitialState(data);
  addLog(state, 'Bienvenue dans votre temple. Le laboratoire de potions vous attend.');

  initTemple(state, {
    onInteract: () => focusPanel('lab'),
    onMarket: () => focusPanel('market'),
  });

  let lastPaidDay = 0;
  const dayLen = data.economie.temps.duree_jour_secondes;

  document.querySelectorAll('[data-speed]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.speed = Number(btn.dataset.speed);
      state.paused = false;
      render(state);
    });
  });

  document.getElementById('pauseBtn').addEventListener('click', () => {
    if (state.forcedPause) return;
    state.paused = !state.paused;
    render(state);
  });

  let lastFrame = performance.now();
  let lastRender = 0;
  const RENDER_INTERVAL = 250; // ms — évite de reconstruire tout le DOM à 60fps

  function loop(now) {
    const dtReal = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;

    if (!state.paused) {
      const dtGame = dtReal * state.speed;
      tick(state, dtGame);

      const currentDay = Math.floor(state.timeSeconds / dayLen);
      if (currentDay > lastPaidDay) {
        lastPaidDay = currentDay;
        const total = dailySalaries(state);
        if (total > 0) {
          state.money -= total;
          addLog(state, `📜 Salaires payés : -${total} pièces.`);
        }
      }
    }

    if (now - lastRender >= RENDER_INTERVAL) {
      lastRender = now;
      render(state);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main().catch((err) => {
  document.body.innerHTML = `<pre style="color:#f88;padding:20px">${err.stack || err}</pre>`;
});
