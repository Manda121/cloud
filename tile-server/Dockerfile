# Serveur de tuiles offline basé sur OpenMapTiles
FROM overv/openstreetmap-tile-server:2.3.0

# Ce serveur utilise mod_tile + renderd pour générer des tuiles raster
# à partir d'un fichier OSM PBF

ENV THREADS=4
ENV OSM2PGSQL_EXTRA_ARGS=""

# Le fichier PBF sera monté via docker-compose
