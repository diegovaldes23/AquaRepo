# feed_telemetry.py  (versión que manda ts como int epoch)
import time, random
from datetime import datetime, timezone
import requests, yaml

API_BASE = 'http://localhost:8000'   # backend real
PROFILE_PATH = 'simulator_profile.yaml'

def epoch_now():
    return int(datetime.now(timezone.utc).timestamp())

def within(rng):
    lo, hi = float(rng[0]), float(rng[1])
    return round(random.uniform(lo, hi), 2)

def main():
    with open(PROFILE_PATH, 'r', encoding='utf-8') as f:
        cfg = yaml.safe_load(f)

    site = cfg.get('site', 'SITE-DEFAULT')
    pozos = cfg.get('pozos', [])
    period = int(cfg.get('period_seconds', 5))

    if not pozos:
        print('No hay pozos en el YAML.')
        return

    print(f'Enviando telemetría a {API_BASE}/api/telemetry cada {period}s para sitio={site}…')
    while True:
        for p in pozos:
            name = p['name']
            nivel_m     = within(p['nivel_m'])
            caudal_lps  = within(p['caudal_lps'])
            cloro_mgL   = within(p['cloro_mgL'])
            presion_bar = within(p['presion_bar'])
            bomba_on    = nivel_m < 1.4

            payload = {
                "site": site,
                "pozo": name,
                "nivel_m": nivel_m,
                "caudal_lps": caudal_lps,
                "cloro_mgL": cloro_mgL,
                "presion_bar": presion_bar,
                "bomba_on": bomba_on,
                "ts": epoch_now()  # <-- entero epoch
            }

            try:
                r = requests.post(f"{API_BASE}/api/telemetry", json=payload, timeout=5)
                if r.status_code not in (200, 201):
                    print(f"[{name}] HTTP {r.status_code}: {r.text[:180]}")
                else:
                    print(f"[OK {name}] {payload}")
            except Exception as e:
                print(f"[ERR {name}] {e}")

        time.sleep(period)

if __name__ == "__main__":
    main()
