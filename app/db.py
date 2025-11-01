import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base

DB_URL = os.getenv("DB_URL", "sqlite:///./telemetry.db")
engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

class Telemetry(Base):
    __tablename__ = "telemetry"
    id = Column(Integer, primary_key=True, index=True)
    site = Column(String, index=True)
    pozo = Column(String, index=True)
    nivel_m = Column(Float)
    caudal_lps = Column(Float)
    cloro_mgL = Column(Float)
    presion_bar = Column(Float)
    bomba_on = Column(Integer)
    ts = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class Alarm(Base):
    __tablename__ = "alarms"
    id = Column(Integer, primary_key=True, index=True)
    pozo = Column(String, index=True)
    code = Column(String)          # e.g. LVL_LOW, CL_FREE, PRESS_LOW
    message = Column(String)
    severity = Column(String)      # info | warn | crit
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

def init_db():
    Base.metadata.create_all(bind=engine)
