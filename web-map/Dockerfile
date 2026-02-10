# Development stage pour le web-map
FROM node:18-bullseye

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install --legacy-peer-deps

# Exposer les ports (3001 pour React, 3002 pour le serveur backend)
EXPOSE 3001 3002

COPY start.sh ./
RUN chmod +x start.sh

# Commande pour lancer l'application (start.sh gère l'installation si nécessaire)
CMD ["./start.sh"]
