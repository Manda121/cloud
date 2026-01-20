# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le code source
COPY . .

# Définir les variables d'environnement pour le build
ARG REACT_APP_API_AUTH_URL
ARG REACT_APP_API_SIGNALEMENTS_URL
ARG REACT_APP_TILE_SERVER_URL

ENV REACT_APP_API_AUTH_URL=$REACT_APP_API_AUTH_URL
ENV REACT_APP_API_SIGNALEMENTS_URL=$REACT_APP_API_SIGNALEMENTS_URL
ENV REACT_APP_TILE_SERVER_URL=$REACT_APP_TILE_SERVER_URL

# Build de l'application
RUN npm run build

# Production stage avec nginx
FROM nginx:alpine

# Copier la configuration nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés
COPY --from=build /app/build /usr/share/nginx/html

# Exposer le port
EXPOSE 80

# Démarrer nginx
CMD ["nginx", "-g", "daemon off;"]
