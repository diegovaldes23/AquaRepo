from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone


class TelemetryIn(BaseModel):
    site: str = Field(..., example="SSR-LoOvalle")
    pozo: str = Field(..., example="pozo1")
    nivel_m: float
    caudal_lps: float
    cloro_mgL: float
    presion_bar: float
    bomba_on: int
    ts: Optional[int] = None

class TelemetryOut(TelemetryIn):
    id: int
    created_at: datetime

class AlarmOut(BaseModel):
    id: int
    pozo: str
    code: str
    message: str
    severity: str
    created_at: datetime
