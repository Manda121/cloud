const router = require('express').Router();
const ctrl = require('../controllers/notification.controller');
const auth = require('../middlewares/auth.middleware');

// Toutes les routes nécessitent authentification
router.use(auth);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Liste des notifications de l'utilisateur
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unread
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Filtrer uniquement les non lues
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Liste des notifications
 */
router.get('/', ctrl.list);

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Nombre de notifications non lues
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Compte des non lues
 */
router.get('/unread-count', ctrl.unreadCount);

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   post:
 *     summary: Marquer toutes les notifications comme lues
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications marquées comme lues
 */
router.post('/mark-all-read', ctrl.markAllRead);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Marquer une notification comme lue
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notification marquée comme lue
 */
router.put('/:id/read', ctrl.markRead);

module.exports = router;
