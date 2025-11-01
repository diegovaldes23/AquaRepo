// ====== chart.js – inicialización y carga de series ======
import { APP_TZ, API_BASE, parseTS, dayStartDate, dayEndDate, addDaysStr, hasExplicitTZ, normalizeISO, offsetStrFor } from './utils.js';
import { renderSeriesTable } from './ui.js';
import { fetchJSON } from './utils.js';

let chart;

export function ensureChart(){
  if (chart) return chart;
  const ctx = document.getElementById('timeseries');
  const parent = ctx?.parentElement;
  if (parent && !parent.style.height) parent.style.height = '320px';

  chart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [
      { label: 'Nivel (m)',    data: [], yAxisID: 'y',  tension: 0.25, pointRadius: 2 },
      { label: 'Caudal (L/s)', data: [], yAxisID: 'y1', tension: 0.25, pointRadius: 2 }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, parsing: false,
      scales: {
        x: { type: 'time', time: { unit:'hour', displayFormats:{hour:'HH:mm'}, tooltipFormat: 'yyyy-MM-dd HH:mm:ss' },
             ticks:{ color:'#90a0bf', maxRotation:35 }, grid:{ color:'#1f2c48' } },
        y:  { position:'left',  ticks:{ color:'#90a0bf' }, grid:{ color:'#1f2c48' } },
        y1: { position:'right', ticks:{ color:'#90a0bf' }, grid:{ drawOnChartArea:false } }
      },
      plugins: { legend:{ labels:{ color:'#e8eefc' } }, title:{ display:true, text:'Tendencia', color:'#e8eefc', font:{ size:15, weight:'600' } } }
    }
  });
  return chart;
}

// --- helpers locales ---
const isDateOnly = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));
function expandParam(p){
  if (!p) return null;
  const raw = String(p);
  if (isDateOnly(raw)){
    const d = dayStartDate(raw);
    const off = offsetStrFor(d, APP_TZ);
    return `${raw}T00:00:00${off}`;
  }
  if (hasExplicitTZ(raw)) return normalizeISO(raw);
  const d = new Date(normalizeISO(raw));
  const off = offsetStrFor(d || new Date(), APP_TZ);
  return `${normalizeISO(raw)}${off}`;
}

export async function loadSeries(pozo, { start=null, end=null } = {}){
  const c = ensureChart();
  const params = new URLSearchParams({ pozo, limit:'1000' });
  const s = expandParam(start), e = expandParam(end);
  if (s) params.set('start', s);
  if (e) params.set('end', e);

  const url = `${API_BASE}/api/recent?${params.toString()}`;
  c.options.plugins.title.text = `Tendencia – ${pozo.toUpperCase()}${s ? ` (${s} → ${e || '…'})` : ''}`;
  c.update();

  const arr = await fetchJSON(url);
  if (!Array.isArray(arr) || arr.length === 0){
    c.data.datasets[0].data = []; c.data.datasets[1].data = []; c.update();
    renderSeriesTable([]); return;
  }

  arr.sort((a,b)=>parseTS(a.created_at)-parseTS(b.created_at));
  const nivel  = arr.map(r=>({ x: parseTS(r.created_at), y: Number(r.nivel_m) })).filter(p=>p.x && !Number.isNaN(p.x.getTime()));
  const caudal = arr.map(r=>({ x: parseTS(r.created_at), y: Number(r.caudal_lps) })).filter(p=>p.x && !Number.isNaN(p.x.getTime()));

  c.data.datasets[0].data = nivel;
  c.data.datasets[1].data = caudal;
  if (c.options.scales?.x){ c.options.scales.x.min = undefined; c.options.scales.x.max = undefined; }
  c.update();

  renderSeriesTable(arr);
}

export async function loadSeriesDay(pozo, yyyy_mm_dd){
  const c = ensureChart();
  const xMin = dayStartDate(yyyy_mm_dd);
  const xMax = dayEndDate(yyyy_mm_dd);

  const params = new URLSearchParams({ pozo, limit:'2000', start: yyyy_mm_dd, end: addDaysStr(yyyy_mm_dd, 1) });
  const url = `${API_BASE}/api/recent?${params.toString()}`;
  const arr = await fetchJSON(url) || [];

  arr.sort((a,b)=>parseTS(a.created_at)-parseTS(b.created_at));
  const nivel  = arr.map(r=>({ x: parseTS(r.created_at), y: Number(r.nivel_m) })).filter(p=>p.x && !Number.isNaN(p.x.getTime()));
  const caudal = arr.map(r=>({ x: parseTS(r.created_at), y: Number(r.caudal_lps) })).filter(p=>p.x && !Number.isNaN(p.x.getTime()));

  c.data.datasets[0].data = nivel;
  c.data.datasets[1].data = caudal;

  c.options.plugins.title.text = `Tendencia – ${pozo.toUpperCase()} – ${yyyy_mm_dd}`;
  if (c.options.scales?.x){ c.options.scales.x.min = xMin; c.options.scales.x.max = xMax; }

  const allPts = [...nivel, ...caudal].filter(p => p?.x instanceof Date);
  if (allPts.length){
    const minDataX = new Date(Math.min(...allPts.map(p => p.x.getTime())));
    const maxDataX = new Date(Math.max(...allPts.map(p => p.x.getTime())));
    const outside = (maxDataX < xMin) || (minDataX >= xMax);
    if (outside && c.options.scales?.x){
      c.options.scales.x.min = undefined;
      c.options.scales.x.max = undefined;
      c.options.plugins.title.text += " (auto)";
      console.warn('Puntos fuera del día seleccionado → auto-escala', { day: yyyy_mm_dd, xMin, xMax, minDataX, maxDataX });
    }
  }

  c.update();
  renderSeriesTable(arr);
}
