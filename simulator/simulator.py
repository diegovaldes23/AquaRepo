# simulator.py
# -----------------------------------------------------------------------------
# AQUA365 – Simulador (FEEDER) que envía datos al BACKEND REAL para persistirlos.
# Ejecuta:  python simulator.py
#
# Envía POST /api/telemetry con payloads realistas cada STEP_SEC segundos.
# Config por ENV o argumentos:
#   API_BASE=http://localhost:8000   # URL del backend real
#   SITE=LO-OVALLE
#   POZOS=pozo1,pozo2
#   STEP_SEC=5                       # periodo de envío por pozo (s)
#   TS_MODE=epoch|iso                # cómo marcar el tiempo; default: epoch
#   JITTER=1                         # agrega aleatoriedad leve al periodo (s)
#   LOG=1                            # imprime cada envío
#
# Si tu backend espera 'created_at' ISO en vez de 'ts' epoch, usa: TS_MODE=iso
# -----------------------------------------------------------------------------

import os, sys, time, math, random, argparse
from datetime import datetime, timezone
import requests

def env_str(key, default): return os.getenv(key, default)
def env_int(key, default): return int(os.getenv(key, str(default)))

def now_epoch() -> int:
    return int(datetime.now(timezone.utc).timestamp())

def now_iso() -> str:
    # ISO sin microsegundos, con offset local si quisieras; para backend suele dar igual
    return datetime.now().replace(microsecond=0).isoformat()

def clamp(v, lo, hi): return max(lo, min(hi, v))

def gen_point(base_t: datetime, pozo: str):
    """Genera un punto 'realista' en base a ondas + ruido."""
    # Fase por pozo
    phase = (abs(hash(pozo)) % 360) * math.pi / 180.0
    minutes = base_t.hour * 60 + base_t.minute

    nivel = 1.8 + 0.7 * math.sin((minutes / 120.0) * 2 * math.pi + phase) + random.uniform(-0.10, 0.10)
    nivel = round(clamp(nivel, 0.3, 3.2), 2)

    caudal = 4.0 + 2.0 * math.sin((minutes / 90.0) * 2 * math.pi + phase/2) + random.uniform(-0.4, 0.4)
    caudal = round(clamp(caudal, 0.0, 12.0), 2)

    cloro = 0.8 + 0.3 * math.sin((minutes / 60.0) * 2 * math.pi + phase/3) + random.uniform(-0.15, 0.15)
    cloro = round(clamp(cloro, 0.0, 2.5), 2)

    presion = 0.9 + 0.3 * (caudal / 4.0) + random.uniform(-0.05, 0.05)
    presion = round(presion, 2)

    bomba_on = nivel < 1.4
    return nivel, caudal, cloro, presion, bomba_on

def build_payload(site, pozo, ts_mode):
    now = datetime.now()
    nivel, caudal, cloro, presion, bomba_on = gen_point(now, pozo)
    payload = {
        "site": site,
        "pozo": pozo,
        "nivel_m": nivel,
        "caudal_lps": caudal,
        "cloro_mgL": cloro,
        "presion_bar": presion,
        "bomba_on": bomba_on,
    }
    if ts_mode == "iso":
        payload["created_at"] = now_iso()
    else:
        payload["ts"] = now_epoch()
    return payload

def main():
    parser = argparse.ArgumentParser(description="AQUA365 feeder → backend real")
    parser.add_argument("--api", default=env_str("API_BASE", "http://localhost:8000"))
    parser.add_argument("--site", default=env_str("SITE", "LO-OVALLE"))
    parser.add_argument("--pozos", default=env_str("POZOS", "pozo1,pozo2"))
    parser.add_argument("--step", type=int, default=env_int("STEP_SEC", 5))
    parser.add_argument("--ts-mode", choices=["epoch", "iso"], default=env_str("TS_MODE", "epoch"))
    parser.add_argument("--jitter", type=float, default=float(os.getenv("JITTER", "1")))  # +- segundos aleatorios
    parser.add_argument("--log", type=int, default=env_int("LOG", 1))
    args = parser.parse_args()

    api_base = args.api.rstrip("/")
    post_url = f"{api_base}/api/telemetry"
    pozos = [p.strip() for p in args.pozos.split(",") if p.strip()]
    if not pozos:
        print("No hay pozos definidos. Usa --pozos=pozo1,pozo2 o POZOS env.")
        sys.exit(1)

    print(f"Feeder iniciado → {post_url}")
    print(f"Site={args.site}  Pozos={pozos}  STEP={args.step}s  TS_MODE={args.ts_mode}")

    # Probar conectividad
    try:
        r = requests.get(f"{api_base}/api/health", timeout=5)
        if r.status_code >= 400:
            print(f"Advertencia: /api/health devolvió HTTP {r.status_code}: {r.text[:150]}")
    except Exception as e:
        print(f"Advertencia: no se pudo consultar /api/health ({e}). Continuando de todos modos…")

    while True:
        start = time.time()
        for pozo in pozos:
            payload = build_payload(args.site, pozo, args.ts_mode)
            try:
                resp = requests.post(post_url, json=payload, timeout=5)
                if resp.status_code not in (200, 201):
                    print(f"[{pozo}] HTTP {resp.status_code}: {resp.text[:180]}")
                elif args.log:
                    print(f"[OK {pozo}] {payload}")
            except Exception as e:
                print(f"[ERR {pozo}] {e}")

        # Espera con jitter para que no caigan todos en el mismo segundo exacto
        elapsed = time.time() - start
        period = max(0.1, args.step - elapsed)
        if args.jitter:
            period += random.uniform(-args.jitter, +args.jitter)
            period = max(0.1, period)
        time.sleep(period)

if __name__ == "__main__":
    random.seed(42)  # quítalo si quieres mayor aleatoriedad
    main()
