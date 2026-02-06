/**
 * Routes de synchronisation Firebase <-> PostgreSQL
 */

const router = require('express').Router();
const ctrl = require('../controllers/sync.controller');
const auth = require('../middlewares/auth.middleware');

// Toutes les routes de synchronisation nécessitent une authentification
router.use(auth);

/**
 * @swagger
 * tags:
 *   - name: Synchronisation
 *     description: Gestion de la synchronisation Firebase <-> PostgreSQL
 */

/**
 * @swagger
 * /api/sync/pull:
 *   get:
 *     tags: [Synchronisation]
 *     summary: Récupérer les données depuis Firebase
 *     description: Tire les signalements de Firebase Firestore vers la base PostgreSQL locale
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Synchronisation Firebase → Local terminée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     created:
 *                       type: array
 *                       items:
 *                         type: string
 *                     updated:
 *                       type: array
 *                       items:
 *                         type: string
 *                     conflicts:
 *                       type: array
 *                     skipped:
 *                       type: array
 *       500:
 *         description: Erreur serveur
 */
router.get('/pull', ctrl.pullFromFirebase);

/**
 * @swagger
 * /api/sync/push:
 *   post:
 *     tags: [Synchronisation]
 *     summary: Envoyer les données vers Firebase
 *     description: Pousse tous les signalements non synchronisés vers Firebase Firestore
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Synchronisation Local → Firebase terminée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: array
 *                       items:
 *                         type: string
 *                     failed:
 *                       type: array
 *       500:
 *         description: Erreur serveur
 */
router.post('/push', ctrl.pushToFirebase);

/**
 * @swagger
 * /api/sync/trigger:
 *   post:
 *     tags: [Synchronisation]
 *     summary: Déclencher une synchronisation manuelle
 *     description: Lance une synchronisation complète dans la direction spécifiée
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               direction:
 *                 type: string
 *                 enum: [pull, push, both]
 *                 default: both
 *                 description: Direction de la synchronisation
 *     responses:
 *       200:
 *         description: Synchronisation terminée
 *       400:
 *         description: Direction invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/trigger', ctrl.triggerSync);

/**
 * @swagger
 * /api/sync/conflicts:
 *   get:
 *     tags: [Synchronisation]
 *     summary: Récupérer les conflits en attente
 *     description: Liste tous les conflits de synchronisation non résolus
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des conflits
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       id_signalement:
 *                         type: string
 *                       conflict_type:
 *                         type: string
 *                       local_data:
 *                         type: object
 *                       firebase_data:
 *                         type: object
 *                       resolved:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 */
router.get('/conflicts', ctrl.getConflicts);

/**
 * @swagger
 * /api/sync/conflicts/{id}/resolve:
 *   post:
 *     tags: [Synchronisation]
 *     summary: Résoudre un conflit
 *     description: Résout un conflit de synchronisation en choisissant la version à conserver
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID du signalement en conflit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 enum: [LOCAL, FIREBASE]
 *                 description: Version à conserver (LOCAL ou FIREBASE)
 *     responses:
 *       200:
 *         description: Conflit résolu
 *       400:
 *         description: Resolution invalide
 *       500:
 *         description: Erreur serveur
 */
router.post('/conflicts/:id/resolve', ctrl.resolveConflict);

/**
 * @swagger
 * /api/sync/history:
 *   get:
 *     tags: [Synchronisation]
 *     summary: Historique des synchronisations
 *     description: Récupère l'historique des événements de synchronisation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Nombre maximum d'événements à retourner
 *     responses:
 *       200:
 *         description: Liste des événements de synchronisation
 */
router.get('/history', ctrl.getSyncHistory);

/**
 * @swagger
 * /api/sync/errors:
 *   get:
 *     tags: [Synchronisation]
 *     summary: Erreurs de synchronisation
 *     description: Récupère les erreurs de synchronisation récentes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Nombre maximum d'erreurs à retourner
 *     responses:
 *       200:
 *         description: Liste des erreurs de synchronisation
 */
router.get('/errors', ctrl.getSyncErrors);

/**
 * @swagger
 * /api/sync/stats:
 *   get:
 *     tags: [Synchronisation]
 *     summary: Statistiques de synchronisation
 *     description: Récupère les statistiques de synchronisation des dernières 24h
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques de synchronisation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_events:
 *                       type: integer
 *                     success_count:
 *                       type: integer
 *                     error_count:
 *                       type: integer
 *                     last_sync:
 *                       type: string
 *                     synced_signalements:
 *                       type: integer
 *                     unsynced_signalements:
 *                       type: integer
 *                     pending_conflicts:
 *                       type: integer
 */
router.get('/stats', ctrl.getSyncStats);

module.exports = router;
