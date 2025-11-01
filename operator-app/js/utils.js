// ====== utils.js – constantes y utilidades comunes ======
export const APP_TZ = (
  localStorage.getItem('APP_TZ') ||
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  'America/Santiago'
);

export const API_BASE = (localStorage.getItem('API_BASE') || 'http://localhost:8000').replace(/\/$/, '');
export const POZOS = JSON.parse(localStorage.getItem('POZOS') || '["pozo1","pozo2"]');
export const REFRESH_MS = 5000;
export const ALARM_LIMIT = 500;

export const $  = (sel) => document.querySelector(sel);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));
export const fmt = (n, unit="") => (n == null ? "—" : `${n}${unit}`);

export function setApiBadge(){ const el = $('#apiBase'); if (el) el.textContent = API_BASE; }

export async function fetchJSON(url){
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn("Fallo conexión con backend:", e.message);
    const badge = $('#apiBase'); if (badge) badge.style.color = '#ff6b6b';
    return null;
  }
}

// --- Fechas/tiempo ---
export const normalizeISO = (ts) => (typeof ts === 'string' && ts.includes(' ') ? ts.replace(' ','T') : ts);
export const hasExplicitTZ = (s) => /[Zz]|[+\-]\d{2}:\d{2}$/.test(String(s));

export function parseTS(ts){
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  const iso = normalizeISO(String(ts));
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function ymdInTZ(date, tz = APP_TZ){
  const d = (date instanceof Date) ? date : parseTS(date);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
}
export function timeInTZ(date, tz = APP_TZ){
  const d = (date instanceof Date) ? date : parseTS(date);
  return d ? d.toLocaleTimeString('es-CL', { timeZone: tz }) : '';
}

export function dayStartDate(ymd){ const [y,m,d] = ymd.split('-').map(Number); return new Date(y, m-1, d, 0,0,0,0); }
export function dayEndDate(ymd){ const s = dayStartDate(ymd); return new Date(s.getTime() + 24*60*60*1000); }
export function addDaysStr(ymd, delta){
  const s = dayStartDate(ymd); const t = new Date(s.getTime() + delta*24*60*60*1000);
  const yy=t.getFullYear(), mm=String(t.getMonth()+1).padStart(2,'0'), dd=String(t.getDate()).padStart(2,'0');
  return `${yy}-${mm}-${dd}`;
}
export function toDateKey(d){ if (!(d instanceof Date)) d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export const endOfDayISO = (ymd) => addDaysStr(ymd, 1);

export function tzOffsetMinutes(date, timeZone = APP_TZ){
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, hour12:false, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const parts = Object.fromEntries(dtf.formatToParts(date).map(p => [p.type, p.value]));
  const asUTC = Date.UTC(parts.year, parts.month-1, parts.day, parts.hour, parts.minute, parts.second);
  return (asUTC - date.getTime())/60000;
}
export function offsetStrFor(date, timeZone = APP_TZ){
  const off = tzOffsetMinutes(date, timeZone);
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  const hh = String(Math.trunc(abs/60)).padStart(2,'0');
  const mm = String(abs%60).padStart(2,'0');
  return `${sign}${hh}:${mm}`;
}
