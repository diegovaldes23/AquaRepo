// ====== ui.js – render DOM, plantillas y modal ======
import { $, fmt, parseTS, toDateKey } from './utils.js';

export function cardTemplate(pozo, data, th){
  if (!data){
    return `<div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <h3>${pozo.toUpperCase()}</h3>
        <button class="info-btn" data-pozo="${pozo}" title="Rangos de operación">i</button>
      </div>
      <p>Sin datos disponibles</p>
    </div>`;
  }
  const defaults = { nivel_low_m:0.9, nivel_high_m:2.5, cloro_min_mgL:0.2, cloro_max_mgL:1.5, presion_min_bar:1.0 };
  th = th || defaults;

  const bomba = data?.bomba_on ? 'Encendida' : 'Apagada';
  const badgeClass = data?.bomba_on ? 'ok' : 'off';

  const nivelState = data.nivel_m < th.nivel_low_m ? 'crit' : (data.nivel_m > th.nivel_high_m ? 'crit' : 'ok');
  const nivelHint  = nivelState==='crit' ? (data.nivel_m < th.nivel_low_m ? `Nivel bajo (< ${th.nivel_low_m} m)` : `Nivel alto (> ${th.nivel_high_m} m)`) : '';

  const cloroState = (data.cloro_mgL < th.cloro_min_mgL || data.cloro_mgL > th.cloro_max_mgL) ? 'crit' : 'ok';
  const cloroHint  = cloroState==='crit' ? (data.cloro_mgL < th.cloro_min_mgL ? `Cloro bajo (< ${th.cloro_min_mgL} mg/L)` : `Cloro alto (> ${th.cloro_max_mgL} mg/L)`) : '';

  const presionState = data.presion_bar < th.presion_min_bar ? 'crit' : 'ok';
  const presionHint  = presionState==='crit' ? `Presión baja (< ${th.presion_min_bar} bar)` : '';

  return `
  <div class="card">
    <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <h3>${pozo.toUpperCase()}</h3>
      <div style="display:flex;gap:8px;align-items:center;">
        <span class="badge ${badgeClass}">${bomba}</span>
        <button class="info-btn" data-pozo="${pozo}" title="Rangos de operación">i</button>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi ${nivelState}">
        <label>Nivel del estanque</label>
        <strong>${fmt(data.nivel_m, " m")}</strong>
        ${nivelHint ? `<div class="note">${nivelHint}</div>` : ''}
      </div>

      <div class="kpi">
        <label>Caudal de salida</label>
        <strong>${fmt(data.caudal_lps, " L/s")}</strong>
      </div>

      <div class="kpi ${cloroState}">
        <label>Cloro residual</label>
        <strong>${fmt(data.cloro_mgL, " mg/L")}</strong>
        ${cloroHint ? `<div class="note">${cloroHint}</div>` : ''}
      </div>

      <div class="kpi ${presionState}">
        <label>Presión</label>
        <strong>${fmt(data.presion_bar, " bar")}</strong>
        ${presionHint ? `<div class="note">${presionHint}</div>` : ''}
      </div>
    </div>
  </div>`;
}

export function renderCards(containerEl, pozoDataPairs, thresholds){
  containerEl.innerHTML = pozoDataPairs.map(([pozo, data]) => cardTemplate(pozo, data, thresholds)).join('');
}

export function alarmItem(a){
  const sevClass = a.severity === 'crit' ? 'crit' : (a.severity === 'warn' ? 'warn' : 'ok');
  const d = parseTS(a.created_at);
  const ts = d ? d.toLocaleTimeString() : '—';
  let mensaje = a.message;
  if (a.code === "LVL_LOW")   mensaje = "Nivel bajo en el estanque";
  if (a.code === "LVL_HIGH")  mensaje = "Nivel alto en el estanque";
  if (a.code === "CL_LOW")    mensaje = "Cloro bajo";
  if (a.code === "CL_HIGH")   mensaje = "Cloro alto";
  if (a.code === "PRESS_LOW") mensaje = "Presión baja";

  return `<div class="item ${sevClass}">
    <div class="msg">${mensaje}</div>
    <div class="meta"><span>${a.pozo.toUpperCase()}</span><span>${ts}</span></div>
  </div>`;
}

export function renderAlarms(containerEl, arr){
  const groups = {};
  for (const a of arr){
    const key = toDateKey(parseTS(a.created_at));
    (groups[key] ||= []).push(a);
  }
  const days = Object.keys(groups).sort((a,b) => b.localeCompare(a));
  const html = days.map(day => {
    const items = groups[day].sort((a,b)=>parseTS(b.created_at)-parseTS(a.created_at)).map(a=>alarmItem(a)).join('');
    return `<div class="group"><div class="day">${day}</div>${items || `<div class="item"><div class="msg">Sin alarmas.</div></div>`}</div>`;
  }).join('');
  containerEl.innerHTML = html || `<div class="item"><div class="msg">No hay alarmas para los filtros seleccionados.</div></div>`;
}

export function buildInfoHTML(pozo, th){
  const cards = [
    { title: "Nivel (m)",  normal: `Entre ${th.nivel_low_m} y ${th.nivel_high_m}`, alerta: `Bajo < ${th.nivel_low_m} · Alto > ${th.nivel_high_m}`, nota:"Evitar sobrellenado o vaciado." },
    { title: "Cloro (mg/L)", normal: `Entre ${th.cloro_min_mgL} y ${th.cloro_max_mgL}`, alerta:`Bajo < ${th.cloro_min_mgL} · Alto > ${th.cloro_max_mgL}`, nota:"Mantener dentro de norma sanitaria." },
    { title: "Presión (bar)", normal:`≥ ${th.presion_min_bar}`, alerta:`Baja < ${th.presion_min_bar}`, nota:"Revisar presurizadora o demanda alta." }
  ];
  const htmlCards = cards.map(c => `
    <div class="stat">
      <h4>${c.title} <span class="pill ok">Normal</span></h4>
      <div class="row"><div>Rango</div><div class="value">${c.normal}</div></div>
      <div class="row"><span class="pill warn">Alerta</span><div class="value">${c.alerta}</div></div>
      <div class="note">${c.nota}</div>
    </div>`).join("");
  return `<p class="small">Pozo: <strong>${pozo.toUpperCase()}</strong>. Rangos definidos por el servidor.</p>
          <div class="stats-grid">${htmlCards}</div>`;
}

export function openInfoModal(pozo, th){
  $('#infoTitle').textContent = `Rangos de operación – ${pozo.toUpperCase()}`;
  $('#infoBody').innerHTML = buildInfoHTML(pozo, th);
  const modal = $('#infoModal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}
export function closeInfoModal(){
  const modal = $('#infoModal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

export function renderSeriesTable(arr){
  const tbody = document.getElementById('seriesTableBody');
  if (!tbody) return;
  const MAX_ROWS = 100;
  const rows = arr.slice(-MAX_ROWS);
  const html = rows.map((r, idx) => {
    const d = parseTS(r.created_at);
    const hora  = d ? d.toLocaleTimeString()  : '—';
    const fecha = d ? d.toLocaleDateString() : '';
    const nivel = (r.nivel_m ?? '—');
    const caudal = (r.caudal_lps ?? '—');
    return `<tr>
      <td>${arr.length - rows.length + idx + 1}</td>
      <td>${hora} ${fecha ? `<small style="opacity:.7">(${fecha})</small>` : ''}</td>
      <td>${nivel}</td>
      <td>${caudal}</td>
    </tr>`;
  }).join('');
  tbody.innerHTML = html || `<tr><td colspan="4" style="color:#9fb4de">Sin datos para los filtros actuales.</td></tr>`;
}
