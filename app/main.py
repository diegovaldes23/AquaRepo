# =============================================================================
# AQUA365 – Telemetry API (FastAPI)
# Archivo: main.py
# =============================================================================

from datetime import datetime, timedelta, timezone  # <-- ahora importamos timezone

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from .alarms import THRESHOLDS, evaluate_and_store
from .db import Alarm, SessionLocal, Telemetry, init_db
from .models import AlarmOut, TelemetryIn, TelemetryOut
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

origins = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ... tus rutas /api/thresholds, /api/latest, /api/recent, /api/alarms ...

# -----------------------------------------------------------------------------
# Utilidades de tiempo (UTC)
# -----------------------------------------------------------------------------
def ensure_utc(dt: datetime | None) -> datetime | None:
    """
    Asegura que el datetime salga con zona UTC.
    - Si viene naive (sin tzinfo), lo interpretamos como UTC.
    - Si viene con otra zona, lo convertimos a UTC.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


# -----------------------------------------------------------------------------
# Instancia de la aplicación
# -----------------------------------------------------------------------------
app = FastAPI(title="AQUA365 Telemetry API", version="1.0.0")

# CORS (permite orígenes cruzados; ajustar allow_origins en prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # TODO: restringir a dominios conocidos en producción
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Dependencias
# -----------------------------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------------------------------------------------------
# Eventos del ciclo de vida
# -----------------------------------------------------------------------------
@app.on_event("startup")
def startup() -> None:
    init_db()


# -----------------------------------------------------------------------------
# Endpoints – Salud y configuración
# -----------------------------------------------------------------------------
@app.get("/api/health")
def health() -> dict:
    # Ahora devolvemos un ISO con zona UTC explícita
    return {"status": "ok", "utc": datetime.now(timezone.utc).isoformat()}


@app.get("/api/thresholds")
def thresholds() -> dict:
    return THRESHOLDS


# -----------------------------------------------------------------------------
# Endpoints – Telemetría
# -----------------------------------------------------------------------------
@app.post("/api/telemetry", response_model=TelemetryOut, status_code=201)
def ingest(data: TelemetryIn, db: Session = Depends(get_db)) -> TelemetryOut:
    """
    Ingesta una lectura de telemetría y evalúa reglas de alarma.
    """
    row = Telemetry(
        site=data.site,
        pozo=data.pozo,
        nivel_m=data.nivel_m,
        caudal_lps=data.caudal_lps,
        cloro_mgL=data.cloro_mgL,
        presion_bar=data.presion_bar,
        bomba_on=data.bomba_on,
        ts=data.ts,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    # Reglas simples de alarma (persisten en tabla Alarm si corresponde)
    evaluate_and_store(row.pozo, row.nivel_m, row.cloro_mgL, row.presion_bar)

    # IMPORTANTE: created_at sale con zona UTC explícita
    return TelemetryOut(
        id=row.id,
        site=row.site,
        pozo=row.pozo,
        nivel_m=row.nivel_m,
        caudal_lps=row.caudal_lps,
        cloro_mgL=row.cloro_mgL,
        presion_bar=row.presion_bar,
        bomba_on=row.bomba_on,
        ts=row.ts,
        created_at=ensure_utc(row.created_at),
    )


@app.get("/api/recent", response_model=List[TelemetryOut])
def recent(
    limit: int = 50,
    pozo: str | None = None,
    start: str | None = Query(default=None, description="YYYY-MM-DD"),
    end: str | None = Query(default=None, description="YYYY-MM-DD (exclusive)"),
    db: Session = Depends(get_db),
) -> List[TelemetryOut]:
    """
    Devuelve lecturas recientes, con soporte opcional de rango de fechas (UTC).
    - start y end se interpretan como fechas Y-m-d (00:00 inclusivo / exclusivo).
    - Orden ascendente por created_at para un eje X coherente.
    """
    q = db.query(Telemetry)

    if pozo:
        q = q.filter(Telemetry.pozo == pozo)

    # Filtro por rango de fechas (si viene)
    def parse_day(d: str | None):
        if not d:
            return None
        try:
            # interpretamos YYYY-MM-DD como 00:00 UTC del día indicado
            return datetime.fromisoformat(d).replace(tzinfo=timezone.utc)
        except Exception:
            return None

    start_dt = parse_day(start)
    end_dt   = parse_day(end)

    if start_dt:
        q = q.filter(Telemetry.created_at >= start_dt)
    if end_dt:
        q = q.filter(Telemetry.created_at < end_dt)

    rows = q.order_by(Telemetry.created_at.asc()).limit(limit).all()

    return [
        TelemetryOut(
            id=r.id,
            site=r.site,
            pozo=r.pozo,
            nivel_m=r.nivel_m,
            caudal_lps=r.caudal_lps,
            cloro_mgL=r.cloro_mgL,
            presion_bar=r.presion_bar,
            bomba_on=r.bomba_on,
            ts=r.ts,
            created_at=ensure_utc(r.created_at),
        )
        for r in rows
    ]


# -----------------------------------------------------------------------------
# Endpoints – Alarmas
# -----------------------------------------------------------------------------
@app.get("/api/alarms", response_model=List[AlarmOut])
def alarms(
    limit: int = 50,
    pozo: str | None = None,
    start: str | None = Query(default=None, description="YYYY-MM-DD"),
    end: str | None = Query(default=None, description="YYYY-MM-DD (exclusive)"),
    db: Session = Depends(get_db),
) -> List[AlarmOut]:
    """
    Lista alarmas recientes con filtros opcionales por pozo y rango de fechas (UTC).
    """
    q = db.query(Alarm)

    if pozo:
        q = q.filter(Alarm.pozo == pozo)

    # Filtrado por fecha (UTC) si viene start/end
    def parse_day(d: str | None):
        if not d:
            return None
        try:
            return datetime.fromisoformat(d).replace(tzinfo=timezone.utc)
        except Exception:
            return None

    start_dt = parse_day(start)
    end_dt   = parse_day(end)

    if start_dt:
        q = q.filter(Alarm.created_at >= start_dt)
    if end_dt:
        q = q.filter(Alarm.created_at < end_dt)

    rows = q.order_by(Alarm.created_at.desc()).limit(limit).all()

    return [
        AlarmOut(
            id=a.id,
            pozo=a.pozo,
            code=a.code,
            message=a.message,
            severity=a.severity,
            created_at=ensure_utc(a.created_at),
        )
        for a in rows
    ]


# -----------------------------------------------------------------------------
# Endpoints – Última lectura por pozo
# -----------------------------------------------------------------------------
@app.get("/api/latest", response_model=TelemetryOut | None)
def latest(pozo: str, db: Session = Depends(get_db)) -> TelemetryOut | None:
    """
    Devuelve la última lectura disponible para un pozo dado.
    """
    r = (
        db.query(Telemetry)
        .filter(Telemetry.pozo == pozo)
        .order_by(Telemetry.id.desc())
        .first()
    )
    if not r:
        return None

    return TelemetryOut(
        id=r.id,
        site=r.site,
        pozo=r.pozo,
        nivel_m=r.nivel_m,
        caudal_lps=r.caudal_lps,
        cloro_mgL=r.cloro_mgL,
        presion_bar=r.presion_bar,
        bomba_on=r.bomba_on,
        ts=r.ts,
        created_at=ensure_utc(r.created_at),
    )
