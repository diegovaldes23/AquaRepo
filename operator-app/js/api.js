// ====== api.js – acceso a backend y cache de umbrales ======
import { API_BASE, ALARM_LIMIT, fetchJSON } from './utils.js';

let THRESHOLDS_CACHE = null;

export async function loadThresholds(){
  if (THRESHOLDS_CACHE) return THRESHOLDS_CACHE;
  try { THRESHOLDS_CACHE = await fetchJSON(`${API_BASE}/api/thresholds`); }
  catch { THRESHOLDS_CACHE = null; }
  return THRESHOLDS_CACHE;
}

export async function fetchLatest(pozo){
  return await fetchJSON(`${API_BASE}/api/latest?pozo=${encodeURIComponent(pozo)}`);
}

export async function fetchRecent(params){
  // params: { pozo, limit?, start?, end? } ya con offsets si aplica.
  const qs = new URLSearchParams({ limit:'1000', ...params });
  return await fetchJSON(`${API_BASE}/api/recent?${qs.toString()}`);
}

export async function fetchAlarms({ pozo='', date='' } = {}){
  let url = `${API_BASE}/api/alarms?limit=${ALARM_LIMIT}`;
  if (pozo) url += `&pozo=${encodeURIComponent(pozo)}`;
  if (date){
    const end = new Date(date); end.setDate(end.getDate()+1);
    const endStr = end.toISOString().slice(0,10);
    url += `&start=${date}&end=${endStr}`;
  }
  return (await fetchJSON(url)) || [];
}
