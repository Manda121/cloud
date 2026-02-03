# Serveur de Tuiles Offline

Ce module fournit un serveur de tuiles OpenStreetMap offline basé sur le fichier `region.osm.pbf`.

## Architecture

Le serveur utilise l'image Docker `overv/openstreetmap-tile-server` qui inclut:
- **PostgreSQL + PostGIS** pour stocker les données OSM
- **osm2pgsql** pour importer les données PBF
- **Mapnik** pour le rendu des tuiles
- **mod_tile + renderd** pour servir les tuiles

## Première utilisation (Import initial)

**⚠️ IMPORTANT**: Lors du premier lancement, vous devez d'abord importer le fichier PBF. Cette opération peut prendre plusieurs minutes selon la taille du fichier.

### Étape 1: Lancer l'import

```bash
# Depuis la racine du projet
docker-compose --profile import run --rm tile-server-import
```

Surveillez les logs pour voir la progression. L'import est terminé quand vous voyez:
```
Importing OSM data... done.
Creating indexes on planet_osm_roads...
All indexes on planet_osm_roads created in XXs
```

### Étape 2: Lancer le serveur de tuiles

Une fois l'import terminé:
```bash
docker-compose up tile-server -d
```

## Utilisation

Une fois l'import terminé, les tuiles sont disponibles à:
- **URL des tuiles**: `http://localhost:8080/tile/{z}/{x}/{y}.png`
- **Interface web**: `http://localhost:8080`

## Configuration

| Variable | Description | Défaut |
|----------|-------------|--------|
| `THREADS` | Nombre de threads pour l'import | 4 |
| `UPDATES` | Activer les mises à jour OSM | disabled |

## Volumes Docker

- `tile_data`: Base de données PostgreSQL avec les données OSM
- `tile_rendered`: Cache des tuiles générées

## Régénérer les données

Pour réimporter le fichier PBF (après mise à jour):

```bash
# Supprimer les volumes existants
docker-compose down -v

# Relancer l'import
docker-compose --profile import run --rm tile-server-import

# Lancer le serveur
docker-compose up tile-server -d
```

## Fichier PBF source

Le fichier `region.osm.pbf` doit être placé dans le dossier `map/`:
- Emplacement: `./map/region.osm.pbf`
- Format: OpenStreetMap PBF
- Source recommandée: [Geofabrik](https://download.geofabrik.de/)

## Intégration avec l'application

Le `docker-compose.yml` principal inclut automatiquement ce serveur. L'application web-map est configurée pour utiliser les tuiles locales via:

```javascript
REACT_APP_TILE_SERVER_URL: http://localhost:8080/tile/{z}/{x}/{y}.png
```
