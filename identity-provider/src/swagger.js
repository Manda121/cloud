const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Identity Provider & Signalements API',
      version: '1.0.0',
      description: 'API pour la gestion des utilisateurs et des signalements de routes dégradées (mobile Leaflet & web)',
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token Bearer (Firebase idToken ou JWT local)',
        },
      },
    },
    security: [
      { BearerAuth: [] }
    ],
    tags: [
      { name: 'Auth', description: 'Authentification (Firebase/Local)' },
      { name: 'Signalements', description: 'CRUD signalements de routes' },
      { name: 'Signalements - Geo', description: 'Requêtes géospatiales pour Leaflet' },
      { name: 'Signalements - Sync', description: 'Synchronisation offline/online' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
