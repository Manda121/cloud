# Travaux Routiers - Antananarivo

Application de suivi des travaux routiers sur la ville d'Antananarivo.

## Architecture

Le projet est composé de 2 modules principaux :

```
cloud/
├── docker-compose.yml          # Compose principal (démarre tout)
├── identity-provider/          # Module Authentification (Node.js/Express)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── src/
└── web-map/                    # Module Web (React)
    ├── Dockerfile
    ├── docker-compose.yml
    └── src/
```

## Modules

### 1. Identity Provider (Port 3001)
- API REST d'authentification
- Support Firebase (online) et PostgreSQL (offline)
- Endpoints: `/api/auth/login`, `/api/auth/register`, `/api/auth/unblock`

### 2. Web Map (Port 3000)
- Application React avec Leaflet
- Affichage de la carte d'Antananarivo
- 2 profils : Visiteur et Manager

### 3. Tile Server (Port 8080)
- Serveur de tuiles OpenStreetMap offline
- Nécessite l'import des données d'Antananarivo

## Démarrage rapide

### Avec Docker (recommandé)

```bash
# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter tous les services
docker-compose down
```

### En développement

```bash
# Identity Provider
cd identity-provider
npm install
npm run dev

# Web Map (dans un autre terminal)
cd web-map
npm install
npm start
```

## Configuration du serveur de tuiles offline

### 1. Télécharger les données d'Antananarivo

```bash
# Télécharger l'extrait d'Antananarivo depuis Geofabrik
wget https://download.geofabrik.de/africa/madagascar-latest.osm.pbf

# Ou utiliser un extrait plus petit si disponible
```

### 2. Importer les données

```bash
# Démarrer le conteneur tile-server en mode import
docker-compose run tile-server import

# Cela peut prendre plusieurs heures selon la taille des données
```

### 3. Alternative : Utiliser OpenStreetMap online

Si le serveur offline n'est pas configuré, l'application utilise automatiquement les tuiles OpenStreetMap en ligne.

Modifier `.env` dans web-map :
```
REACT_APP_TILE_SERVER_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

## Fonctionnalités

### Visiteurs
- ✅ Voir la carte avec les points des problèmes routiers
- ✅ Survoler un point pour voir les infos (date, statut, surface, budget, entreprise)
- ✅ Voir le tableau de récapitulation (Nb points, surface totale, avancement %, budget total)

### Managers
- ✅ Création de compte utilisateur
- ✅ Bouton synchronisation Firebase
- ✅ Page pour débloquer les utilisateurs bloqués
- ✅ Gestion des infos sur chaque signalement (surface, budget, entreprise)
- ✅ Modification des statuts des signalements

## Variables d'environnement

### Web Map (.env)
```env
REACT_APP_API_AUTH_URL=http://localhost:3001/api/auth
REACT_APP_API_SIGNALEMENTS_URL=http://localhost:3001/api
REACT_APP_TILE_SERVER_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

### Identity Provider (.env)
```env
PORT=3001
USE_FIREBASE=true
AUTH_MODE=auto
DATABASE_URL=postgresql://user:pass@host:5432/db
```

## Ports utilisés

| Service | Port |
|---------|------|
| Web Map (React) | 3000 |
| Identity Provider (API) | 3001 |
| Tile Server | 8080 |
| PostgreSQL | 5432 |

## TODO - À faire manuellement

1. **API Signalements** : Créer les endpoints REST pour gérer les signalements dans `identity-provider`:
   - `GET /api/signalements` - Liste des signalements
   - `PUT /api/signalements/:id` - Modifier un signalement
   - `GET /api/entreprises` - Liste des entreprises
   - `GET /api/users/blocked` - Utilisateurs bloqués

2. **Synchronisation Firebase** : Implémenter la vraie synchronisation bidirectionnelle avec Firebase Firestore

3. **Données Antananarivo** : Télécharger et importer les tuiles OSM d'Antananarivo

4. **Sécurité** : Ajouter la vérification du token JWT sur les routes protégées

5. **Mobile** : Créer l'application mobile qui communique avec les mêmes APIs
