/**
 * Routes des notifications
 */

const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const auth = require('../middlewares/auth.middleware');

// Toutes les routes de notifications nécessitent une authentification
router.use(auth);

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: Gestion des notifications utilisateur
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Récupérer les notifications de l'utilisateur
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Liste des notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 unreadCount:
 *                   type: integer
 *                 count:
 *                   type: integer
 *                 data:
 *                   type: array
 */
router.get('/', ctrl.getNotifications);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Nombre de notifications non lues
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nombre de notifications non lues
 */
router.get('/unread-count', ctrl.getUnreadCount);

/**
 * @swagger
 * /api/notifications/register-token:
 *   post:
 *     tags: [Notifications]
 *     summary: Enregistrer un token FCM pour les notifications push
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fcmToken
 *             properties:
 *               fcmToken:
 *                 type: string
 *                 description: Token Firebase Cloud Messaging
 *               deviceType:
 *                 type: string
 *                 enum: [mobile, web]
 *                 default: mobile
 *     responses:
 *       200:
 *         description: Token enregistré
 *       400:
 *         description: Token manquant
 */
router.post('/register-token', ctrl.registerToken);

/**
 * @swagger
 * /api/notifications/token:
 *   delete:
 *     tags: [Notifications]
 *     summary: Supprimer un token FCM (déconnexion)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fcmToken
 *             properties:
 *               fcmToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token supprimé
 */
router.delete('/token', ctrl.removeToken);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     tags: [Notifications]
 *     summary: Marquer une notification comme lue
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notification marquée comme lue
 *       404:
 *         description: Notification introuvable
 */
router.put('/:id/read', ctrl.markAsRead);

/**
 * @swagger
 * /api/notifications/read-all:
 *   put:
 *     tags: [Notifications]
 *     summary: Marquer toutes les notifications comme lues
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Toutes les notifications marquées comme lues
 */
router.put('/read-all', ctrl.markAllAsRead);

/**
 * @swagger
 * /api/notifications/signalement/{id}/status:
 *   put:
 *     tags: [Notifications]
 *     summary: (BackOffice) Modifier le statut d'un signalement et notifier
 *     description: Endpoint pour les managers - met à jour le statut et envoie une notification à l'utilisateur
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID du signalement
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newStatus
 *             properties:
 *               newStatus:
 *                 type: integer
 *                 description: Nouveau statut (1=NOUVEAU, 2=EN_COURS, 3=TERMINE)
 *     responses:
 *       200:
 *         description: Statut mis à jour et notification envoyée
 *       400:
 *         description: newStatus manquant
 *       404:
 *         description: Signalement introuvable
 */
router.put('/signalement/:id/status', ctrl.updateStatusAndNotify);

module.exports = router;
