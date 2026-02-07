const router = require('express').Router();
const ctrl = require('../controllers/signalement.controller');
const auth = require('../middlewares/auth.middleware');

// Toutes les routes de signalements nécessitent un utilisateur authentifié
router.use(auth);

/**
 * @swagger
 * components:
 *   schemas:
 *     Signalement:
 *       type: object
 *       properties:
 *         id_signalement:
 *           type: string
 *           format: uuid
 *         id_user:
 *           type: integer
 *         id_statut:
 *           type: integer
 *           description: 1=NOUVEAU, 2=EN_COURS, 3=TERMINE
 *         id_entreprise:
 *           type: integer
 *         description:
 *           type: string
 *         surface_m2:
 *           type: number
 *         budget:
 *           type: number
 *         date_signalement:
 *           type: string
 *           format: date
 *         latitude:
 *           type: number
 *         longitude:
 *           type: number
 *         source:
 *           type: string
 *           enum: [LOCAL, FIREBASE]
 *         synced:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *     SignalementCreate:
 *       type: object
 *       required:
        photos:
          type: array
          items:
            type: object
            properties:
              filename:
                type: string
              url:
                type: string
              created_at:
                type: string
                format: date-time
 *         - description
 *       properties:
 *         id_user:
 *           type: integer
 *           description: ID utilisateur (pris depuis le token si omis)
 *         id_statut:
 *           type: integer
 *           description: ID du statut (défaut 1 = NOUVEAU)
 *         id_entreprise:
 *           type: integer
 *         description:
 *           type: string
 *           description: Description de la route dégradée
 *         surface_m2:
 *           type: number
 *         budget:
 *           type: number
 *         date_signalement:
 *           type: string
 *           format: date
 *         latitude:
 *           type: number
 *           description: Latitude du point cliqué sur la carte
 *         longitude:
 *           type: number
 *           description: Longitude du point cliqué sur la carte
        photos:
          type: array
          items:
            type: string
            description: "Data URL (base64) ou chemin relatif d'une image"
 *         source:
 *           type: string
 *           enum: [LOCAL, FIREBASE]
 *         synced:
 *           type: boolean
 *     GeoJSONFeatureCollection:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           example: FeatureCollection
 *         features:
 *           type: array
 *           items:
 *             type: object
 *     Stats:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *         par_statut:
 *           type: object
 *           properties:
 *             nouveau:
 *               type: integer
 *             en_cours:
 *               type: integer
 *             termine:
 *               type: integer
 *         surface_totale:
 *           type: number
 *         budget_total:
 *           type: number
 *         synchronisation:
 *           type: object
 *           properties:
 *             synced:
 *               type: integer
 *             not_synced:
 *               type: integer
 */

// =============================================
// ROUTES SPÉCIFIQUES (AVANT /:id)
// =============================================

/**
 * @swagger
 * /api/signalements/stats:
 *   get:
 *     summary: Statistiques des signalements
 *     tags: [Signalements]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Stats'
 */
router.get('/stats', ctrl.getStats);

/**
 * @swagger
 * /api/signalements/geo/bbox:
 *   get:
 *     summary: Signalements dans une bounding box (pour Leaflet)
 *     tags: [Signalements - Geo]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: minLat
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: minLng
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxLat
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxLng
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Liste des signalements dans la zone
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Signalement'
 */
router.get('/geo/bbox', ctrl.findInBbox);

/**
 * @swagger
 * /api/signalements/geo/nearby:
 *   get:
 *     summary: Signalements proches d'un point (rayon en mètres)
 *     tags: [Signalements - Geo]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 1000
 *         description: Rayon en mètres (défaut 1000)
 *     responses:
 *       200:
 *         description: Liste des signalements proches avec distance
 */
router.get('/geo/nearby', ctrl.findNearby);

/**
 * @swagger
 * /api/signalements/geo/geojson:
 *   get:
 *     summary: Signalements au format GeoJSON (pour Leaflet)
 *     tags: [Signalements - Geo]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: statutId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: GeoJSON FeatureCollection
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GeoJSONFeatureCollection'
 */
router.get('/geo/geojson', ctrl.getGeoJSON);

/**
 * @swagger
 * /api/signalements/sync/unsynced:
 *   get:
 *     summary: Signalements non synchronisés (pour sync mobile)
 *     tags: [Signalements - Sync]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des signalements non synchronisés
 */
router.get('/sync/unsynced', ctrl.getUnsynced);

/**
 * @swagger
 * /api/signalements/sync/mark:
 *   post:
 *     summary: Marquer des signalements comme synchronisés
 *     tags: [Signalements - Sync]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Signalements marqués comme synchronisés
 */
router.post('/sync/mark', ctrl.markSynced);

// =============================================
// ROUTES CRUD GÉNÉRIQUES
// =============================================

/**
 * @swagger
 * /api/signalements:
 *   get:
 *     summary: Liste tous les signalements
 *     tags: [Signalements]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filtrer par id_user
 *     responses:
 *       200:
 *         description: Liste des signalements
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Signalement'
 */
router.get('/', ctrl.list);

/**
 * @swagger
 * /api/signalements:
 *   post:
 *     summary: Créer un nouveau signalement (route dégradée)
 *     tags: [Signalements]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignalementCreate'
 *           example:
 *             description: "Route dégradée avec nids de poule"
 *             latitude: -18.8792
 *             longitude: 47.5079
 *             surface_m2: 50
 *             budget: 200000
 *             source: "LOCAL"
 *     responses:
 *       201:
 *         description: Signalement créé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Signalement'
 */
// Middleware léger pour logger les créations de signalements (pour capture/debug)
const logCreate = (req, res, next) => {
  try {
    console.log('[Signalements] create request', {
      time: new Date().toISOString(),
      user: req.user || null,
      body: req.body,
      headers: {
        authorization: req.headers.authorization,
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
      },
    });
  } catch (e) {
    // Ne pas casser la route si le log échoue
    console.warn('[Signalements] logging failed', e && e.message);
  }
  next();
};

router.post('/', logCreate, ctrl.create);

/**
 * @swagger
 * /api/signalements/{id}:
 *   get:
 *     summary: Récupérer un signalement par ID
 *     tags: [Signalements]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Signalement trouvé
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Signalement'
 *       404:
 *         description: Signalement introuvable
 */
router.get('/:id', ctrl.getOne);

/**
 * @swagger
 * /api/signalements/{id}:
 *   put:
 *     summary: Mettre à jour un signalement
 *     tags: [Signalements]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignalementCreate'
 *     responses:
 *       200:
 *         description: Signalement mis à jour
 *       404:
 *         description: Signalement introuvable
 */
router.put('/:id', ctrl.update);

/**
 * @swagger
 * /api/signalements/{id}:
 *   delete:
 *     summary: Supprimer un signalement
 *     tags: [Signalements]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Supprimé
 */
router.delete('/:id', ctrl.remove);

module.exports = router;
