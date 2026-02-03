const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy pour les signalements, stats, entreprises (serveur local web-map sur le port 3002)
  app.use(
    ['/api/signalements', '/api/stats', '/api/entreprises', '/api/statuts'],
    createProxyMiddleware({
      target: 'http://localhost:3002',
      changeOrigin: true,
    })
  );

  // Proxy pour l'authentification (identity-provider sur le port 3000)
  app.use(
    '/api/auth',
    createProxyMiddleware({
      target: 'http://identity-provider:3000',
      changeOrigin: true,
    })
  );
};
