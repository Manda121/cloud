/**
 * Routes de synchronisation Firebase <-> PostgreSQL
 */

const router = require('express').Router();
const ctrl = require('../controllers/sync.controller');

/**
 * @swagger
 * /api/sync/pull:
 *   get:
 *     summary: Récupérer les signalements depuis Firebase vers PostgreSQL
 *     tags: [Sync]
 *     responses:
 *       200:
 *         description: Synchronisation réussie
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
 *                     skipped:
 *                       type: array
 *                       items:
 *                         type: string
 *       503:
 *         description: Firebase non accessible
 */
router.get('/pull', ctrl.pull);

/**
 * @swagger
 * /api/sync/push:
 *   post:
 *     summary: Pousser les signalements PostgreSQL vers Firebase
 *     tags: [Sync]
 *     responses:
 *       200:
 *         description: Push réussi
 *       503:
 *         description: Firebase non accessible
 */
router.post('/push', ctrl.push);

/**
 * @swagger
 * /api/sync/trigger:
 *   post:
 *     summary: Déclencher une synchronisation manuelle
 *     tags: [Sync]
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
 *     responses:
 *       200:
 *         description: Synchronisation terminée
 *       503:
 *         description: Firebase non accessible
 */
router.post('/trigger', ctrl.trigger);

/**
 * @swagger
 * /api/sync/stats:
 *   get:
 *     summary: Statistiques de synchronisation
 *     tags: [Sync]
 *     responses:
 *       200:
 *         description: Statistiques récupérées
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
 *                     total:
 *                       type: integer
 *                     synced_count:
 *                       type: integer
 *                     unsynced_count:
 *                       type: integer
 *                     from_firebase:
 *                       type: integer
 *                     from_local:
 *                       type: integer
 */
router.get('/stats', ctrl.stats);

module.exports = router;
