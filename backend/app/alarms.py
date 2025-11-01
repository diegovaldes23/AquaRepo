from .db import Alarm, SessionLocal

# Umbrales simples; ajústalos luego con datos reales
THRESHOLDS = {
    "nivel_low_m": 0.9,
    "nivel_high_m": 2.5,
    "cloro_min_mgL": 0.2,
    "cloro_max_mgL": 1.5,
    "presion_min_bar": 1.0
}

def evaluate_and_store(pozo: str, nivel_m: float, cloro_mgL: float, presion_bar: float):
    findings = []
    if nivel_m < THRESHOLDS["nivel_low_m"]:
        findings.append(("LVL_LOW", f"Nivel bajo: {nivel_m} m", "warn"))
    if nivel_m > THRESHOLDS["nivel_high_m"]:
        findings.append(("LVL_HIGH", f"Nivel alto: {nivel_m} m", "warn"))
    if cloro_mgL < THRESHOLDS["cloro_min_mgL"]:
        findings.append(("CL_LOW", f"Cloro bajo: {cloro_mgL} mg/L", "warn"))
    if cloro_mgL > THRESHOLDS["cloro_max_mgL"]:
        findings.append(("CL_HIGH", f"Cloro alto: {cloro_mgL} mg/L", "warn"))
    if presion_bar < THRESHOLDS["presion_min_bar"]:
        findings.append(("PRESS_LOW", f"Presión baja: {presion_bar} bar", "warn"))

    if not findings:
        return []

    db = SessionLocal()
    try:
        created = []
        for code, msg, sev in findings:
            row = Alarm(pozo=pozo, code=code, message=msg, severity=sev)
            db.add(row)
            db.commit()
            db.refresh(row)
            created.append(row)
        return created
    finally:
        db.close()
