==========================================================
         COMANDOS PRINCIPALES – AQUA365
==========================================================

📦 OPCIÓN 1 – USANDO DOCKER COMPOSE
----------------------------------------------------------
# Construir imágenes
docker compose build

# Levantar todo (backend + feeder + frontend)
docker compose up

# O en segundo plano
docker compose up -d

# Ver contenedores activos
docker ps

# Ver logs en tiempo real
docker logs -f aqua365_backend
docker logs -f aqua365_feeder
docker logs -f aqua365_frontend

# Reiniciar servicios
docker compose restart backend
docker compose restart feeder
docker compose restart frontend

# Apagar contenedores
docker compose down

# Apagar y borrar volúmenes (base de datos)
docker compose down -v

# Eliminar contenedores viejos (huérfanos)
docker compose down --remove-orphans

# Reconstruir desde cero
docker compose build --no-cache
docker compose up -d

# Comprobar backend
curl http://localhost:8000/api/health
curl http://localhost:8000/api/latest?pozo=pozo1

# Abrir interfaz web
http://localhost:8080


==========================================================
📡 OPCIÓN 2 – EJECUCIÓN MANUAL (SIN DOCKER)
==========================================================

1️⃣  BACKEND (FastAPI)
----------------------------------------------------------
# Inicia el backend en puerto 8000
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Si quieres usar otro puerto (por ejemplo 5000)
uvicorn app.main:app --reload --host 0.0.0.0 --port 5000


2️⃣  FRONTEND (Operador Web)
----------------------------------------------------------
# Inicia un servidor HTTP local en puerto 5500
cd operator-app
python3 -m http.server 5500

# Luego abre el navegador en:
http://localhost:5500

# Si el frontend no se conecta al backend:
# Configura la API base en la consola del navegador:
localStorage.setItem('API_BASE', 'http://localhost:8000');
location.reload();


3️⃣  SIMULADOR / FEEDER
----------------------------------------------------------
# Ejecuta el simulador que genera datos y los envía al backend
cd simulator
python simulator.py

# Si el backend usa otro puerto:
API_BASE=http://localhost:5000 python simulator.py

# Si deseas cambiar frecuencia, pozos, etc.:
POZOS="pozo1,pozo2,pozo3" STEP_SEC=5 LOG=1 python simulator.py


==========================================================
🧰 COMANDOS ÚTILES GENERALES
==========================================================

# Ver procesos Python corriendo
ps aux | grep python

# Detener un proceso manualmente (reemplaza PID)
kill -9 PID

# Limpiar caché de Docker (opcional)
docker system prune -af

==========================================================
          ✅ AQUA365 LISTO PARA FUNCIONAR
==========================================================
