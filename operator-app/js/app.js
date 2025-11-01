// ====== app.js – orquestación de UI ======
import { APP_TZ, POZOS, REFRESH_MS, $, setApiBadge, ymdInTZ, addDaysStr, toDateKey } from './utils.js';
import { loadThresholds, fetchLatest, fetchAlarms } from './api.js';
import { renderCards, renderAlarms, openInfoModal, closeInfoModal } from './ui.js';
import { ensureChart, loadSeries, loadSeriesDay } from './chart.js';

// --- Cards (estado por pozo) ---
async function loadCardsSection(){
  const container = $('#cards');
  const th = await loadThresholds().catch(()=>null);
  const pairs = [];
  for (const pozo of POZOS){
    const data = await fetchLatest(pozo);
    pairs.push([pozo, data]);
  }
  renderCards(container, pairs, th);
}

// --- Alarmas ---
async function loadAlarmsSection(){
  const pozo = $('#alarmPozo')?.value || '';
  const date = $('#alarmDate')?.value || '';
  const arr = await fetchAlarms({ pozo, date });
  renderAlarms($('#alarms'), arr);
}

// --- Controles de tendencia (día/pozo) ---
function applySeriesDay(){
  const sel = document.querySelector('#seriesPozo');
  const dayInput = document.querySelector('#seriesDay');
  const pozo = (sel && sel.value) || POZOS[0];
  const ymd  = (dayInput && dayInput.value) || ymdInTZ(new Date());
  loadSeriesDay(pozo, ymd);
}
function buildSeriesControls(){
  const sel = $('#seriesPozo');
  const dayInput = $('#seriesDay');
  if (!sel || !dayInput) return;

  sel.innerHTML = POZOS.map(p => `<option value="${p}">${p}</option>`).join('');
  sel.addEventListener('change', applySeriesDay);

  const fp = flatpickr('#seriesDay', { locale: 'es', dateFormat: 'Y-m-d', allowInput: false, theme: 'dark' });
  const todayLocal = new Date().toLocaleDateString('en-CA');
  fp.setDate(todayLocal, true);

  $('#seriesApply')?.addEventListener('click', applySeriesDay);
  $('#seriesPrev')?.addEventListener('click', () => {
    const cur = dayInput.value || toDateKey(new Date());
    const prev = addDaysStr(cur, -1);
    dayInput._flatpickr.setDate(prev, true);
    applySeriesDay();
  });
  $('#seriesNext')?.addEventListener('click', () => {
    const cur = dayInput.value || toDateKey(new Date());
    const next = addDaysStr(cur, +1);
    dayInput._flatpickr.setDate(next, true);
    applySeriesDay();
  });
}

// --- Datepicker de alarmas ---
function initAlarmDatePicker(){
  const input = document.getElementById('alarmDate');
  if (!input) return;
  flatpickr(input, { locale:'es', dateFormat:'Y-m-d', allowInput:false, defaultDate:null, theme:'dark' });
}

// --- Modal umbrales ---
function wireModal(){
  const closeBtn = document.getElementById('infoClose');
  if (closeBtn) closeBtn.addEventListener('click', closeInfoModal);

  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('.info-btn');
    if (!btn) return;
    const pozo = btn.dataset.pozo || 'pozo1';
    const th = await loadThresholds();
    if (!th) return alert('No se pudieron cargar los umbrales.');
    openInfoModal(pozo, th);
  });

  const modal = document.getElementById('infoModal');
  if (modal){
    modal.addEventListener('click', (e) => { if (e.target.id === 'infoModal') closeInfoModal(); });
  }
}

// --- Refresco global ---
async function refreshAll(){
  await Promise.all([ loadCardsSection(), loadAlarmsSection() ]);
  const lu = document.getElementById('lastUpdate');
  if (lu) lu.textContent = "Última actualización: " + new Date().toLocaleTimeString('es-CL', { timeZone: APP_TZ });
}

(function init(){
  let refreshTimer = null;

  async function firstPaint(){
    setApiBadge();

    if (document.querySelector('#seriesPozo')) buildSeriesControls();
    initAlarmDatePicker();
    wireModal();

    await refreshAll();

    if (document.querySelector('#seriesPozo') && document.querySelector('#seriesDay')) {
      applySeriesDay();
    } else {
      const current = (document.querySelector('#pozoSelect') && document.querySelector('#pozoSelect').value) || POZOS[0];
      ensureChart();
      await loadSeries(current);
    }

    startAutoRefresh();
  }

  function startAutoRefresh(){
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      if (document.hidden) return;
      if (!navigator.onLine) return;
      refreshAll().catch(e=>console.warn('refreshAll falló:', e));
      applySeriesDay(); // refresca la serie del día si está visible
    }, REFRESH_MS);
  }
  function stopAutoRefresh(){ if (refreshTimer){ clearInterval(refreshTimer); refreshTimer = null; } }

  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAutoRefresh(); else startAutoRefresh(); });
  window.addEventListener('online',  startAutoRefresh);
  window.addEventListener('offline', stopAutoRefresh);

  window.addEventListener('DOMContentLoaded', async () => {
    try { await firstPaint(); }
    catch (err) { console.error('Error inicializando UI:', err); const lu = document.getElementById('lastUpdate'); if (lu) lu.textContent = 'Error de inicialización'; }
  });
})();
