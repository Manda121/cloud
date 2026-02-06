/**
 * Contrôleur des notifications
 * Gère les endpoints pour les notifications utilisateur
 */

const notificationService = require('../services/notification.service');

/**
 * Enregistrer un token FCM pour les notifications push
 * POST /api/notifications/register-token
 */
exports.registerToken = async (req, res) => {
  try {
    const { fcmToken, deviceType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    if (!fcmToken) {
      return res.status(400).json({ error: 'Token FCM requis' });
    }

    const result = await notificationService.registerFcmToken(userId, fcmToken, deviceType);
    
    res.json({
      success: true,
      message: 'Token FCM enregistré',
      data: result,
    });
  } catch (error) {
    console.error('[Notifications] Register token error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Supprimer un token FCM (déconnexion)
 * DELETE /api/notifications/token
 */
exports.removeToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    if (!fcmToken) {
      return res.status(400).json({ error: 'Token FCM requis' });
    }

    await notificationService.removeFcmToken(userId, fcmToken);
    
    res.json({
      success: true,
      message: 'Token FCM supprimé',
    });
  } catch (error) {
    console.error('[Notifications] Remove token error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Récupérer les notifications de l'utilisateur connecté
 * GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const { limit, offset, unreadOnly } = req.query;
    
    const notifications = await notificationService.getUserNotifications(userId, {
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      unreadOnly: unreadOnly === 'true',
    });

    const unreadCount = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      unreadCount,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.error('[Notifications] Get notifications error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Récupérer le nombre de notifications non lues
 * GET /api/notifications/unread-count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    console.error('[Notifications] Get unread count error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Marquer une notification comme lue
 * PUT /api/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    const notification = await notificationService.markAsRead(id, userId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification introuvable' });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('[Notifications] Mark as read error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Marquer toutes les notifications comme lues
 * PUT /api/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Utilisateur non authentifié' });
    }

    await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'Toutes les notifications ont été marquées comme lues',
    });
  } catch (error) {
    console.error('[Notifications] Mark all as read error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Endpoint BackOffice: Modifier le statut d'un signalement et notifier
 * PUT /api/notifications/signalement/:id/status
 * Body: { newStatus: number, managerId?: number }
 */
exports.updateStatusAndNotify = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus } = req.body;
    const managerId = req.user?.id;

    if (!newStatus) {
      return res.status(400).json({ error: 'newStatus requis' });
    }

    // 1. Récupérer l'ancien statut
    const db = require('../config/database');
    const oldStatusResult = await db.query(
      'SELECT id_statut FROM signalements WHERE id_signalement = $1',
      [id]
    );

    if (oldStatusResult.rows.length === 0) {
      return res.status(404).json({ error: 'Signalement introuvable' });
    }

    const oldStatus = oldStatusResult.rows[0].id_statut;

    // 2. Mettre à jour le statut
    await db.query(
      'UPDATE signalements SET id_statut = $1, synced = false WHERE id_signalement = $2',
      [newStatus, id]
    );

    // 3. Notifier le changement (crée la notification + push + historique)
    const notification = await notificationService.notifyStatusChange(
      id,
      oldStatus,
      newStatus,
      managerId
    );

    res.json({
      success: true,
      message: 'Statut mis à jour et notification envoyée',
      data: {
        id_signalement: id,
        old_status: oldStatus,
        new_status: newStatus,
        notification,
      },
    });
  } catch (error) {
    console.error('[Notifications] Update status error:', error.message);
    res.status(500).json({ error: error.message });
  }
};
