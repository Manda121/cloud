# Serveur de tuiles OpenStreetMap avec import automatique
FROM overv/openstreetmap-tile-server:2.3.0

# Configuration
ENV THREADS=4
ENV OSM2PGSQL_EXTRA_ARGS=""
ENV UPDATES=disabled

# Copier le script d'entrée personnalisé et convertir les fins de ligne
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 80

# Le script gère automatiquement l'import au premier lancement
ENTRYPOINT ["/entrypoint.sh"]
