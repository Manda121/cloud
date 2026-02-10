#!/bin/bash
set -e

# Script d'entrée pour le serveur de tuiles
# Vérifie si l'import a déjà été fait, sinon l'exécute automatiquement

IMPORT_MARKER="/data/database/.import_done"
PBF_FILE=""

echo "=== Serveur de tuiles OpenStreetMap ==="
echo "Recherche du fichier PBF..."

# Chercher le fichier PBF dans différents emplacements
for f in /data/map/*.pbf /data/map/*.osm.pbf /data/*.pbf /data/region.osm.pbf; do
    if [ -f "$f" ]; then
        PBF_FILE="$f"
        echo "Fichier PBF trouvé: $PBF_FILE"
        break
    fi
done

# Si le fichier PBF n'existe pas, erreur
if [ -z "$PBF_FILE" ] || [ ! -f "$PBF_FILE" ]; then
    echo "ERREUR: Aucun fichier .osm.pbf trouvé!"
    echo "Placez votre fichier .osm.pbf dans le dossier ./map/"
    echo "Téléchargez-le depuis: https://download.geofabrik.de/"
    exit 1
fi

# Créer un lien symbolique vers l'emplacement attendu
if [ "$PBF_FILE" != "/data/region.osm.pbf" ]; then
    ln -sf "$PBF_FILE" /data/region.osm.pbf
fi

# Vérifier si l'import a déjà été fait
if [ -f "$IMPORT_MARKER" ]; then
    echo "Import déjà effectué. Démarrage du serveur..."
    exec /run.sh run
else
    echo "Première exécution détectée. Lancement de l'import..."
    echo "Cela peut prendre plusieurs minutes selon la taille du fichier PBF."
    
    # Exécuter l'import
    /run.sh import
    
    # Créer les tables manquantes pour le style openstreetmap-carto
    echo "Création des tables externes manquantes..."
    service postgresql start
    sleep 5
    
    sudo -u postgres psql -d gis -c "
        CREATE TABLE IF NOT EXISTS icesheet_polygons (way geometry);
        CREATE TABLE IF NOT EXISTS icesheet_outlines (way geometry, ice_edge boolean);
        CREATE TABLE IF NOT EXISTS water_polygons (way geometry);
        CREATE TABLE IF NOT EXISTS ne_110m_admin_0_boundary_lines_land (way geometry(LineString, 3857));
        CREATE TABLE IF NOT EXISTS ne_10m_admin_0_boundary_lines_land (way geometry(LineString, 3857));
        CREATE TABLE IF NOT EXISTS ne_10m_admin_1_states_provinces_lines (way geometry(LineString, 3857));
        
        ALTER TABLE icesheet_polygons OWNER TO renderer;
        ALTER TABLE icesheet_outlines OWNER TO renderer;
        ALTER TABLE water_polygons OWNER TO renderer;
        ALTER TABLE ne_110m_admin_0_boundary_lines_land OWNER TO renderer;
        ALTER TABLE ne_10m_admin_0_boundary_lines_land OWNER TO renderer;
        ALTER TABLE ne_10m_admin_1_states_provinces_lines OWNER TO renderer;
        
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO renderer;
    " || true
    
    service postgresql stop
    
    # Marquer l'import comme terminé
    touch "$IMPORT_MARKER"
    echo "Import terminé avec succès!"
    
    # Démarrer le serveur
    echo "Démarrage du serveur de tuiles..."
    exec /run.sh run
fi
