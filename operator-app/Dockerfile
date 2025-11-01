# operator-app/Dockerfile
FROM nginx:alpine

# Copiamos el front a la raíz del servidor
COPY . /usr/share/nginx/html

# Opcional: cabeceras para tipado y compresión básica
RUN mkdir -p /etc/nginx/conf.d
# Usamos la default de nginx (sirve estático). Si quieres headers custom:
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
