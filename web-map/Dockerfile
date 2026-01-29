# Development stage pour le web-map
FROM node:18-bullseye

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install --legacy-peer-deps

# Exposer le port 3001 (port de développement React)
EXPOSE 3001

# Commande pour lancer l'application en mode développement
CMD ["npm", "start"]
