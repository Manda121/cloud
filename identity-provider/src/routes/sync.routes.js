const router = require('express').Router();
const ctrl = require('../controllers/sync.controller');

/**
 * @swagger
 * components:
 *   schemas:
 *     SyncReport:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         report:
 *           type: object
 *           properties:
 *             firebaseToLocal:
 *               type: object
 *               properties:
 *                 added:
 *                   type: integer
 *                 skipped:
 *                   type: integer
 *                 errors:
 *                   type: integer
 *             localToFirebase:
 *               type: object
 *               properties:
 *                 added:
 *                   type: integer
 *                 skipped:
 *                   type: integer
 *                 errors:
 *                   type: integer
 *             totalFirebaseUsers:
 *               type: integer
 *             totalLocalUsers:
 *               type: integer
 *             syncedAt:
 *               type: string
 *               format: date-time
 */

/**
 * @swagger
 * /api/sync:
 *   post:
 *     summary: Synchronisation bidirectionnelle complète (Firebase <-> PostgreSQL)
 *     description: |
 *       Synchronise les utilisateurs entre Firebase et PostgreSQL.
 *       - Les utilisateurs Firebase absents de PostgreSQL sont ajoutés localement
 *       - Les utilisateurs PostgreSQL (sans firebase_uid) sont créés dans Firebase
 *       - Les utilisateurs existants dans les deux ne sont pas dupliqués
 *     responses:
 *       200:
 *         description: Synchronisation réussie
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SyncReport'
 *       503:
 *         description: Firebase inaccessible (mode hors ligne)
 */
router.post('/', ctrl.syncAll);

/**
 * @swagger
 * /api/sync/from-firebase:
 *   post:
 *     summary: Synchronisation Firebase -> PostgreSQL uniquement
 *     description: Importe les utilisateurs Firebase dans PostgreSQL (sans envoyer vers Firebase)
 *     responses:
 *       200:
 *         description: Synchronisation réussie
 *       503:
 *         description: Firebase inaccessible
 */
router.post('/from-firebase', ctrl.syncFromFirebase);

/**
 * @swagger
 * /api/sync/to-firebase:
 *   post:
 *     summary: Synchronisation PostgreSQL -> Firebase uniquement
 *     description: Exporte les utilisateurs locaux (sans firebase_uid) vers Firebase
 *     responses:
 *       200:
 *         description: Synchronisation réussie
 *       503:
 *         description: Firebase inaccessible
 */
router.post('/to-firebase', ctrl.syncToFirebase);

/**
 * @swagger
 * /api/sync/status:
 *   get:
 *     summary: Afficher les statistiques de synchronisation
 *     description: |
 *       Retourne les statistiques sur les utilisateurs locaux et Firebase:
 *       - Nombre total d'utilisateurs dans chaque base
 *       - Utilisateurs synchronisés vs non synchronisés
 *       - Comparaison entre les deux bases
 *     responses:
 *       200:
 *         description: Statistiques de synchronisation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 online:
 *                   type: boolean
 *                 localUsers:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     withFirebaseUid:
 *                       type: integer
 *                     withoutFirebaseUid:
 *                       type: integer
 *                     syncedFromFirebase:
 *                       type: integer
 *                 firebaseUsers:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                 comparison:
 *                   type: object
 *                   properties:
 *                     onlyInFirebase:
 *                       type: integer
 *                     onlyInLocal:
 *                       type: integer
 *                     inBoth:
 *                       type: integer
 */
router.get('/status', ctrl.syncStatus);

module.exports = router;
