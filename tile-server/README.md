# Serveur de Tuiles Offline

Ce module fournit un serveur de tuiles OpenStreetMap offline basé sur le fichier `region.osm.pbf`.

## Fonctionnement

Le serveur utilise l'image Docker `overv/openstreetmap-tile-server` avec un script d'entrée personnalisé qui:
- **Détecte automatiquement** si l'import a déjà été effectué
- **Importe les données** au premier lancement (peut prendre 15-30 min)
- **Démarre le serveur** immédiatement si les données existent déjà

## Utilisation

### Lancement (automatique)

```bash
# Depuis la racine du projet - tout se fait automatiquement
docker-compose up -d
```

Au premier lancement, surveillez les logs pour voir la progression de l'import:
```bash
docker logs -f cloud-tile-server
```

### URLs disponibles

- **Tuiles**: `http://localhost:8080/tile/{z}/{x}/{y}.png`
- **Interface web**: `http://localhost:8080`

## Volumes Docker

| Volume | Description |
|--------|-------------|
| `tile_data` | Base de données PostgreSQL avec les données OSM |
| `tile_rendered` | Cache des tuiles générées |
| `tile_style` | Style de rendu Mapnik |

## Régénérer les données

Pour forcer un nouvel import (après mise à jour du fichier PBF):

```bash
# Supprimer les volumes existants
docker-compose down -v

# Relancer (l'import se fera automatiquement)
docker-compose up -d
```

## Fichier PBF source

Le fichier `region.osm.pbf` doit être placé dans le dossier `map/`:
- **Emplacement**: `./map/region.osm.pbf`
- **Format**: OpenStreetMap PBF
- **Source recommandée**: [Geofabrik](https://download.geofabrik.de/)
