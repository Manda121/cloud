# Suivi des Travaux Routiers - Antananarivo

Application de suivi des travaux routiers sur la ville d'Antananarivo.

## Architecture

Le projet est composé de plusieurs modules :

```
cloud/
├── docker-compose.yml        # Orchestration de tous les services
├── db/
│   └── base.sql              # Script d'initialisation de la base de données
├── identity-provider/        # API d'authentification (Node.js/Express)
└── web-map/                  # Application Web (React + Leaflet)
```

## Prérequis

- Docker et Docker Compose
- Node.js 18+ (pour le développement local)

## Démarrage rapide

### Avec Docker (recommandé)

```bash
# Lancer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arrêter les services
docker-compose down
```

Les services seront disponibles sur :
- **Web Map** : http://localhost (port 80)
- **Identity Provider API** : http://localhost:3000
- **PostgreSQL** : localhost:5432

### Développement local

#### Identity Provider
```bash
cd identity-provider
npm install
npm start
```

#### Web Map
```bash
cd web-map
npm install
npm start
```

## Fonctionnalités

### Visiteur (sans compte)
- ✅ Voir la carte avec les points représentant les problèmes routiers
- ✅ Survol des marqueurs pour voir les informations :
  - Date du signalement
  - Statut (Nouveau, En cours, Terminé)
  - Surface en m²
  - Budget
  - Entreprise concernée
- ✅ Tableau récapitulatif :
  - Nombre de signalements
  - Surface totale
  - Avancement en %
  - Budget total

### Manager (compte requis)
- ✅ Création de compte utilisateur
- ✅ Connexion/Déconnexion
- ✅ Bouton de synchronisation avec Firebase
- ✅ Page pour débloquer les utilisateurs bloqués
- ✅ Gestion des informations des signalements :
  - Surface en m²
  - Budget
  - Entreprise concernée
  - Description
- ✅ Modification des statuts des signalements

## API Authentification

Endpoints disponibles :

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | /api/auth/register | Inscription |
| POST | /api/auth/login | Connexion |
| POST | /api/auth/unblock | Débloquer un compte |
| GET | /api/auth/status | Statut de connectivité |
| POST | /api/auth/refresh-connectivity | Rafraîchir le cache |

## Configuration des cartes offline

Pour utiliser les cartes offline :

1. Télécharger les tuiles d'Antananarivo (voir section suivante)
2. Décommenter le service `tile-server` dans `docker-compose.yml`
3. Modifier `REACT_APP_TILE_SERVER_URL` pour pointer vers le serveur de tuiles local

### Téléchargement des tuiles

```bash
# Créer le dossier pour les tuiles
mkdir -p tiles

# Télécharger les tuiles (exemple avec tilemaker ou autre outil)
# Les tuiles doivent être au format MBTiles ou dans une structure z/x/y
```

## TODO

- [ ] Installer un serveur de tuiles offline (tileserver-gl)
- [ ] Télécharger les tuiles de la ville d'Antananarivo avec les rues
- [ ] Ajouter les routes API pour les signalements dans identity-provider :
  - GET /api/signalements
  - GET /api/signalements/:id
  - POST /api/signalements
  - PUT /api/signalements/:id
  - PATCH /api/signalements/:id/status
  - GET /api/signalements/stats
  - POST /api/signalements/sync
  - GET /api/entreprises
  - GET /api/users/blocked

## Variables d'environnement

### Web Map (.env)
```
REACT_APP_API_AUTH_URL=http://localhost:3000/api/auth
REACT_APP_API_SIGNALEMENTS_URL=http://localhost:3000/api
REACT_APP_TILE_SERVER_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
PORT=3001
```

### Identity Provider (.env)
```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cloud_db
DB_USER=postgres
DB_PASSWORD=postgres
```

## Licence

Projet universitaire - L3
