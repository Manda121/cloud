# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le code source
COPY . .

# Build arguments pour les variables d'environnement
ARG REACT_APP_API_AUTH_URL=http://identity-provider:3000/api/auth
ARG REACT_APP_API_SIGNALEMENTS_URL=http://identity-provider:3000/api
ARG REACT_APP_TILE_SERVER_URL=http://tile-server:8080/tile/{z}/{x}/{y}.png

# Définir les variables d'environnement pour le build
ENV REACT_APP_API_AUTH_URL=$REACT_APP_API_AUTH_URL
ENV REACT_APP_API_SIGNALEMENTS_URL=$REACT_APP_API_SIGNALEMENTS_URL
ENV REACT_APP_TILE_SERVER_URL=$REACT_APP_TILE_SERVER_URL

# Build de l'application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copier la configuration nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés
COPY --from=build /app/build /usr/share/nginx/html

# Exposer le port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
