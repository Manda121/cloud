const notificationService = require('../services/notification.service');
const localAuth = require('../services/auth.local.service');
const firebaseAuth = require('../services/auth.firebase.service');

/**
 * Résoudre l'ID utilisateur local (local JWT → id, Firebase → uid → lookup)
 */
async function resolveUserId(req) {
  if (req.user?.id) return req.user.id;
  if (req.user?.uid) {
    let localUser = await localAuth.findByFirebaseUid(req.user.uid);
    if (!localUser) {
      localUser = await firebaseAuth.saveUserToLocalDb({
        uid: req.user.uid,
        email: req.user.email,
        password: null,
        firstname: req.user.name?.split(' ')[0] || '',
        lastname: req.user.name?.split(' ').slice(1).join(' ') || '',
      });
    }
    return localUser?.id || null;
  }
  return null;
}

/**
 * Récupérer les notifications de l'utilisateur connecté
 */
exports.list = async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Utilisateur non identifié' });

    const unreadOnly = req.query.unread === 'true';
    const limit = parseInt(req.query.limit, 10) || 50;

    const notifications = await notificationService.getNotificationsByUser(userId, { limit, unreadOnly });
    res.json(notifications);
  } catch (e) {
    console.error('[Notifications] list error:', e.message);
    res.status(500).json({ error: e.message });
  }
};

/**
 * Compter les notifications non lues
 */
exports.unreadCount = async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Utilisateur non identifié' });

    const count = await notificationService.getUnreadCount(userId);
    res.json({ count });
  } catch (e) {
    console.error('[Notifications] unreadCount error:', e.message);
    res.status(500).json({ error: e.message });
  }
};

/**
 * Marquer une notification comme lue
 */
exports.markRead = async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Utilisateur non identifié' });

    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, userId);
    if (!notification) return res.status(404).json({ error: 'Notification introuvable' });
    res.json(notification);
  } catch (e) {
    console.error('[Notifications] markRead error:', e.message);
    res.status(500).json({ error: e.message });
  }
};

/**
 * Marquer toutes les notifications comme lues
 */
exports.markAllRead = async (req, res) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) return res.status(401).json({ error: 'Utilisateur non identifié' });

    const count = await notificationService.markAllAsRead(userId);
    res.json({ marked: count });
  } catch (e) {
    console.error('[Notifications] markAllRead error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
