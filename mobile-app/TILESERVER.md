# Serveur de tuiles OSM (offline) — Antananarivo

Ce guide décrit les commandes PowerShell et Docker pour :

- télécharger un extrait OSM pour Antananarivo,
- importer les données dans `overv/openstreetmap-tile-server`,
- lancer le serveur de tuiles et l'utiliser depuis Leaflet.

> Remarque : ces commandes sont écrites pour PowerShell (Windows). Adapte les chemins si tu utilises Linux/macOS.

---

## 1) Préparer un dossier local

```powershell
mkdir C:\maps\antananarivo
cd C:\maps\antananarivo
```

## 2) Télécharger l'extrait OSM (Madagascar → découper Antananarivo)

Geofabrik propose des extraits par pays/region. Nous téléchargeons Madagascar puis extrayons la zone d'Antananarivo.

```powershell
# téléchargement (gros fichier)
Invoke-WebRequest -Uri "https://download.geofabrik.de/africa/madagascar-latest.osm.pbf" -OutFile "madagascar.osm.pbf"

# alternative : laisser le conteneur télécharger directement le fichier (importe ensuite le .pbf)
# ⚠️ ici tu importes Madagascar entier (gros) — pour Antananarivo, préfère la découpe bbox ci-dessous
docker run --rm -e DOWNLOAD_PBF="https://download.geofabrik.de/africa/madagascar-latest.osm.pbf" -v osm-data:/data/database/ -v osm-tiles:/data/tiles/ overv/openstreetmap-tile-server import

# découper la bbox d'Antananarivo (adapter les coordonnées si besoin)
docker run --rm -v ${PWD}:/data osmium/osmium-tool extract -b 47.43,-18.98,47.60,-18.82 /data/madagascar.osm.pbf -o /data/antananarivo.osm.pbf
```

- Si tu préfères laisser le conteneur télécharger le fichier pour toi, il est possible d'utiliser `DOWNLOAD_PBF` (voir section "Letting the container download the file" dans le repo `overv/openstreetmap-tile-server`).

## 3) Créer les volumes Docker persistants

```powershell
docker volume create osm-data
docker volume create osm-tiles
```

## 4) Importer l'extrait dans la base (process long, nécessite de la RAM/CPU)

```powershell
docker run --rm -v ${PWD}\antananarivo.osm.pbf:/data/region.osm.pbf -v osm-data:/data/database/ -v osm-tiles:/data/tiles/ overv/openstreetmap-tile-server import
```

- Cette étape peut durer de plusieurs minutes à plusieurs heures selon la machine.
- Si ça échoue pour cause de mémoire, regarde l'option `FLAT_NODES=enabled` dans la doc.

## 5) Lancer le serveur de tuiles

```powershell
docker run -d -p 8080:80 -e ALLOW_CORS=enabled -v osm-data:/data/database/ -v osm-tiles:/data/tiles/ overv/openstreetmap-tile-server run
```

- Tes tuiles seront disponibles : `http://localhost:8080/tile/{z}/{x}/{y}.png`
- Le demo leaflet est disponible sur `http://localhost:8080`.

## 6) Docker Compose (optionnel)

Tu peux ajouter un service `tiles` dans ton `docker-compose.yml` :

```yaml
services:
  tiles:
    image: overv/openstreetmap-tile-server
    volumes:
      - osm-data:/data/database/
      - osm-tiles:/data/tiles/
    environment:
      - ALLOW_CORS=enabled
    ports:
      - '8080:80'
volumes:
  osm-data:
  osm-tiles:
```

- Pour importer avec le compose :
  `docker compose run --rm tiles import` (exécuter depuis le dossier contenant le `docker-compose.yml`)
  Puis : `docker compose up -d tiles`

## 7) Utiliser les tuiles dans Leaflet (exemple)

```js
L.tileLayer('http://localhost:8080/tile/{z}/{x}/{y}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);
```

## 8) Conseils et bonnes pratiques

- Active `ALLOW_CORS=enabled` pour autoriser ton front (dev) à charger les tuiles.
- Conserver `osm-data` et `osm-tiles` dans des volumes pour persister l'import.
- Pour une machine isolée, importe sur une machine avec Internet, exporte le volume `osm-data` (tar) puis restaure sur la cible.
- Ajuste la bbox si tu veux une zone plus précise autour d'Antananarivo.

---

Si tu veux, je peux :

- ajouter le service `tiles` dans ton `docker-compose.yml` du projet, ou
- générer un petit script PowerShell (`import-tiles.ps1`) pour automatiser le téléchargement + import + run.
  Dis-moi ce que tu préfères.



-- Commande pour le map sur docker 
docker pull maptiler/tileserver-gl

-- Commande pour lancer le serveur de tuiles
docker run --rm -it -v C:\maps\antananarivo:/data -p 8080:80 maptiler/tileserver-gl

---Accéder au serveur de tuiles
http://localhost:8080

---Utilisation de leaflet
L.tileLayer('http://localhost:8080/data/{z}/{x}/{y}.png', {
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);



Oui : le Web (manager) peut fonctionner offline et créer des signalements localement (Postgres Docker).
Le bouton Synchronisation (sur le Web) 
doit lancer une procédure qui fait pull (récupère ce qui vient du mobile/Firebase) 
et push (envoie les signalements enrichis faits par le Web vers Firebase) pour que le mobile voit les changements.
En pratique : il faut une synchronisation bidirectionnelle Postgres ↔ Firebase + règles de résolution de conflits.